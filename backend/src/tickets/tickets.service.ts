import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TicketStatus } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class TicketsService {
  private readonly appTimeZone = process.env.APP_TIMEZONE || process.env.TZ || 'Asia/Qyzylorda';

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private queueService: QueueService,
  ) {}

  private getCurrentTimeParts() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.appTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const values = new Map(parts.map((part) => [part.type, part.value]));

    return {
      year: Number(values.get('year')),
      month: Number(values.get('month')),
      day: Number(values.get('day')),
      hour: Number(values.get('hour')),
      minute: Number(values.get('minute')),
    };
  }

  private getTodayBusinessDate(): Date {
    const now = this.getCurrentTimeParts();

    // businessDate хранится как DATE в Postgres; полдень в UTC не переедет на предыдущий день
    // при сериализации из локального времени в Prisma.
    return new Date(Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0, 0));
  }

  private parseTimeToMinutes(value?: string | null): number | null {
    if (!value) {
      return null;
    }

    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      return null;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  private isWithinRoomWorkHours(workingStartTime?: string | null, workingEndTime?: string | null): boolean {
    const startMinutes = this.parseTimeToMinutes(workingStartTime);
    const endMinutes = this.parseTimeToMinutes(workingEndTime);

    if (startMinutes === null && endMinutes === null) {
      return true;
    }

    const now = this.getCurrentTimeParts();
    const currentMinutes = now.hour * 60 + now.minute;
    const ticketIssueStartMinutes = startMinutes === null
      ? null
      : (startMinutes - 60 + (24 * 60)) % (24 * 60);

    if (ticketIssueStartMinutes !== null && endMinutes !== null) {
      if (ticketIssueStartMinutes <= endMinutes) {
        return currentMinutes >= ticketIssueStartMinutes && currentMinutes <= endMinutes;
      }

      return currentMinutes >= ticketIssueStartMinutes || currentMinutes <= endMinutes;
    }

    if (ticketIssueStartMinutes !== null) {
      return currentMinutes >= ticketIssueStartMinutes;
    }

    return currentMinutes <= (endMinutes as number);
  }

  private normalizeTicketPrefixChar(value: string): string {
    const upperChar = value.trim().charAt(0).toLocaleUpperCase('ru-RU');

    const kazakhToRussianPrefixMap: Record<string, string> = {
      Ә: 'А',
      Ғ: 'Г',
      Қ: 'К',
      Ң: 'Н',
      Ө: 'О',
      Ұ: 'У',
      Ү: 'У',
      Һ: 'Х',
      І: 'И',
    };

    const normalizedChar = kazakhToRussianPrefixMap[upperChar] ?? upperChar;

    if (normalizedChar === 'С' || normalizedChar === 'C') {
      return 'К';
    }

    if (/^[А-ЯЁ]$/u.test(normalizedChar)) {
      return normalizedChar;
    }

    if (/^[A-Z]$/.test(normalizedChar)) {
      return normalizedChar;
    }

    return 'Т';
  }

  private resolveTicketPrefix(serviceTypeName: string): string {
    const normalizedName = serviceTypeName.toLocaleLowerCase('ru-RU').trim();

    const prefixMap: Record<string, string> = {
      'консультация': 'К',
      'оплата услуг': 'П',
      'рентген': 'Р',
      'лабораторные анализы': 'А',
      'справки и документы': 'Д',
      'другое': 'О',
      'флюорография': 'Ф',
      'узи': 'У',
      'мрт': 'М',
      'экг': 'Э',
    };

    return prefixMap[normalizedName] ?? this.normalizeTicketPrefixChar(normalizedName);
  }

  private async generateTicketNumber(serviceTypeId: number): Promise<string> {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { name: true, ticketPrefix: true },
    });

    const name = serviceType?.name?.toLowerCase().trim() ?? '';
    const prefix = serviceType?.ticketPrefix?.trim()
      ? serviceType.ticketPrefix.trim().toLocaleUpperCase('ru-RU')
      : this.resolveTicketPrefix(name);
    const today = this.getTodayBusinessDate();
    const todayTickets = await this.prisma.ticket.findMany({
      where: { businessDate: today },
      select: { number: true },
    });
    const nextSequence = todayTickets
      .map((ticket) => {
        const match = ticket.number.match(/^(.+?)(\d+)$/);

        if (!match || match[1] !== prefix) {
          return 0;
        }

        return Number(match[2]) || 0;
      })
      .reduce((max, current) => Math.max(max, current), 0) + 1;

    return `${prefix}${String(nextSequence).padStart(3, '0')}`;
  }

  async create(serviceTypeId: number, priority: number = 1, roomId?: number, language?: string) {
    const today = this.getTodayBusinessDate();

    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
    });
    const room = await this.resolveCreateRoom(serviceTypeId, roomId);

    if (!room) {
      throw new BadRequestException('Выдача талонов для этой услуги сейчас недоступна.');
    }

    const queueMetrics = await this.queueService.getRoomQueueMetrics(room.id, { priority });
    const etaMinutes = queueMetrics.etaMinutes;
    const peopleAhead = queueMetrics.peopleAhead;
    let ticket: Awaited<ReturnType<typeof this.prisma.ticket.create>> | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const number = await this.generateTicketNumber(serviceTypeId);

      try {
        ticket = await this.prisma.ticket.create({
          data: {
            number,
            serviceTypeId,
            roomId: room?.id ?? null,
            priority,
            language: language || null,
            status: 'waiting',
            etaMinutes,
          },
          include: { serviceType: true, room: true },
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes('number') &&
          error.meta.target.includes('businessDate')
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!ticket) {
      throw new BadRequestException('Не удалось сгенерировать уникальный номер талона.');
    }

    await this.prisma.queueEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'ticket_created',
        newStatus: 'waiting',
        payload: { etaMinutes, roomId: room?.id },
      },
    });

    this.realtime.sendStatusUpdate(ticket.number, 'waiting', room?.name ?? '');

    await this.queueService.syncRoomQueue(room.id);

    if (room) {
      const queueCount = await this.prisma.ticket.count({
        where: { roomId: room.id, businessDate: today, status: { in: ['waiting', 'called', 'in_service'] } },
      });

      if (queueCount > 10) {
        await this.prisma.queueRecommendation.create({
          data: {
            type: 'overload',
            message: `Кабинет ${room.name} перегружен (${queueCount} человек), рекомендуется перенаправить пациентов`,
            severity: 'critical',
          },
        });
      }
    }

    return {
      ...ticket,
      peopleAhead,
      queuePosition: peopleAhead + 1,
    };
  }

  private async resolveCreateRoom(serviceTypeId: number, roomId?: number) {
    if (Number.isFinite(roomId)) {
      const [requestedRoom] = await this.prisma.$queryRaw<
        Array<{ id: number; name: string; workingStartTime: string | null; workingEndTime: string | null }>
      >`
        SELECT r."id", r."name", r."workingStartTime", r."workingEndTime"
        FROM "rooms" r
        WHERE r."id" = ${roomId}
          AND r."isActive" = true
          AND COALESCE(r."ticketIssueEnabled", true) = true
          AND EXISTS (
            SELECT 1
            FROM "room_service_types" rst
            WHERE rst."roomId" = r."id"
              AND rst."serviceTypeId" = ${serviceTypeId}
          )
        LIMIT 1
      `;

      if (requestedRoom && this.isWithinRoomWorkHours(requestedRoom.workingStartTime, requestedRoom.workingEndTime)) {
        return { id: requestedRoom.id, name: requestedRoom.name };
      }

      throw new BadRequestException('Выдача талонов в это место обслуживания закрыта или услуга недоступна.');
    }

    return this.smartRouting(serviceTypeId);
  }

  async updateTicket(id: number, data: { roomId?: number; priority?: number; serviceTypeId?: number }) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...(data.roomId ? { roomId: data.roomId } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.serviceTypeId ? { serviceTypeId: data.serviceTypeId } : {}),
      },
      include: { serviceType: true, room: true },
    });
  }

  async arriveTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'waiting' },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'patient_arrived', oldStatus: 'created', newStatus: 'waiting' },
    });
    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendStatusUpdate(ticket.number, 'waiting', ticket.room?.name ?? '');
    return ticket;
  }

  private async smartRouting(serviceTypeId: number) {
    const rooms = await this.prisma.$queryRaw<
      Array<{ id: number; name: string; workingStartTime: string | null; workingEndTime: string | null }>
    >`
      SELECT r."id", r."name", r."workingStartTime", r."workingEndTime"
      FROM "rooms" r
      WHERE r."isActive" = true
        AND COALESCE(r."ticketIssueEnabled", true) = true
        AND EXISTS (
          SELECT 1
          FROM "room_service_types" rst
          WHERE rst."roomId" = r."id"
            AND rst."serviceTypeId" = ${serviceTypeId}
        )
    `;

    const availableRooms = rooms.filter((room) =>
      this.isWithinRoomWorkHours(room.workingStartTime, room.workingEndTime),
    );

    if (availableRooms.length === 0) return null;

    let bestRoom = availableRooms[0];
    let bestMetrics = await this.queueService.getRoomQueueMetrics(bestRoom.id, { priority: 1 });

    for (const room of availableRooms) {
      const roomMetrics = await this.queueService.getRoomQueueMetrics(room.id, { priority: 1 });

      if (
        roomMetrics.etaMinutes < bestMetrics.etaMinutes ||
        (roomMetrics.etaMinutes === bestMetrics.etaMinutes && roomMetrics.peopleAhead < bestMetrics.peopleAhead)
      ) {
        bestMetrics = roomMetrics;
        bestRoom = room;
      }
    }

    return { id: bestRoom.id, name: bestRoom.name };
  }

  async findAll(status?: TicketStatus, roomId?: number) {
    const today = this.getTodayBusinessDate();

    if (!status || String(status) === 'postponed') {
      return this.prisma.$queryRaw`
        SELECT
          t.*,
          CASE WHEN st."id" IS NULL THEN NULL ELSE json_build_object(
            'id', st."id",
            'name', st."name",
            'nameKk', st."nameKk",
            'nameEn', st."nameEn",
            'averageDurationMinutes', st."averageDurationMinutes",
            'priorityWeight', st."priorityWeight",
            'active', st."active"
          ) END AS "serviceType",
          CASE WHEN r."id" IS NULL THEN NULL ELSE json_build_object(
            'id', r."id",
            'name', r."name",
            'isActive', r."isActive",
            'ticketIssueEnabled', r."ticketIssueEnabled",
            'placeType', r."placeType",
            'workingStartTime', r."workingStartTime",
            'workingEndTime', r."workingEndTime"
          ) END AS "room"
        FROM "tickets" t
        LEFT JOIN "service_types" st ON st."id" = t."serviceTypeId"
        LEFT JOIN "rooms" r ON r."id" = t."roomId"
        WHERE (${status ? String(status) : null}::text IS NULL OR t."status"::text = ${status ? String(status) : null}::text)
          AND (${roomId ?? null}::int IS NULL OR t."roomId" = ${roomId ?? null}::int)
          AND (${roomId ? today : null}::date IS NULL OR t."businessDate" = ${roomId ? today : null}::date)
        ORDER BY t."createdAt" DESC
      `;
    }

    return this.prisma.ticket.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(roomId ? { roomId } : {}),
        ...(roomId ? { businessDate: today } : {}),
      },
      include: { serviceType: true, room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: { serviceType: true, room: true, events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async callTicket(id: number) {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { status: true },
    });
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'called', calledAt: new Date() },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'ticket_called', oldStatus: currentTicket?.status ?? 'waiting', newStatus: 'called' },
    });
    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendTicketCalled(ticket.number, ticket.room?.name ?? '');
    this.realtime.sendStatusUpdate(ticket.number, 'called', ticket.room?.name ?? '');
    return ticket;
  }

  async startService(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'in_service', serviceStartedAt: new Date() },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'service_started', oldStatus: 'called', newStatus: 'in_service' },
    });
    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendStatusUpdate(ticket.number, 'in_service', ticket.room?.name ?? '');
    return ticket;
  }

  async completeTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'service_completed', oldStatus: 'in_service', newStatus: 'completed' },
    });
    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendStatusUpdate(ticket.number, 'completed', ticket.room?.name ?? '');
    return ticket;
  }

  async cancelTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'ticket_cancelled', oldStatus: 'waiting', newStatus: 'cancelled' },
    });
    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendStatusUpdate(ticket.number, 'cancelled', ticket.room?.name ?? '');
    return ticket;
  }

  async noShowTicket(id: number) {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { status: true },
    });
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'no_show' },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'ticket_cancelled', oldStatus: currentTicket?.status ?? 'called', newStatus: 'no_show' },
    });
    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendStatusUpdate(ticket.number, 'no_show', ticket.room?.name ?? '');
    return ticket;
  }

  async postponeTicket(id: number) {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!currentTicket || !['called', 'in_service'].includes(currentTicket.status)) {
      throw new BadRequestException('Отложить можно только вызванный талон или талон в обслуживании.');
    }

    const [ticket] = await this.prisma.$queryRaw<Array<any>>`
      UPDATE "tickets"
      SET "status" = 'postponed'::"TicketStatus"
      WHERE "id" = ${id}
      RETURNING *
    `;

    const [ticketWithRelations] = await this.prisma.$queryRaw<Array<any>>`
      SELECT
        t.*,
        CASE WHEN st."id" IS NULL THEN NULL ELSE json_build_object(
          'id', st."id",
          'name', st."name",
          'nameKk', st."nameKk",
          'nameEn', st."nameEn",
          'averageDurationMinutes', st."averageDurationMinutes",
          'priorityWeight', st."priorityWeight",
          'active', st."active"
        ) END AS "serviceType",
        CASE WHEN r."id" IS NULL THEN NULL ELSE json_build_object(
          'id', r."id",
          'name', r."name",
          'isActive', r."isActive",
          'ticketIssueEnabled', r."ticketIssueEnabled",
          'placeType', r."placeType",
          'workingStartTime', r."workingStartTime",
          'workingEndTime', r."workingEndTime"
        ) END AS "room"
      FROM "tickets" t
      LEFT JOIN "service_types" st ON st."id" = t."serviceTypeId"
      LEFT JOIN "rooms" r ON r."id" = t."roomId"
      WHERE t."id" = ${id}
      LIMIT 1
    `;

    await this.prisma.$executeRaw`
      INSERT INTO "queue_events" ("ticketId", "eventType", "oldStatus", "newStatus", "payload", "createdAt")
      VALUES (
        ${id},
        'ticket_postponed'::"EventType",
        ${currentTicket.status}::"TicketStatus",
        'postponed'::"TicketStatus",
        ${JSON.stringify({
          roomId: ticket.roomId,
          ticketId: ticket.id,
          ticketNumber: ticket.number,
        })}::jsonb,
        NOW()
      )
    `;

    if (ticketWithRelations.room?.id) {
      await this.queueService.syncRoomQueue(ticketWithRelations.room.id);
    }
    this.realtime.sendStatusUpdate(ticketWithRelations.number, 'postponed', ticketWithRelations.room?.name ?? '');
    return ticketWithRelations;
  }

  async returnTicket(id: number) {
    const [currentTicket] = await this.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT "status"::text AS "status"
      FROM "tickets"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const isPostponedTicket = currentTicket?.status === 'postponed';
    const nextStatus = isPostponedTicket ? 'in_service' : 'waiting';

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: nextStatus as any,
        calledAt: isPostponedTicket ? undefined : null,
        serviceStartedAt: isPostponedTicket ? new Date() : null,
        completedAt: null,
      },
      include: { room: true, serviceType: true },
    });

    await this.prisma.$executeRaw`
      INSERT INTO "queue_events" ("ticketId", "eventType", "oldStatus", "newStatus", "payload", "createdAt")
      VALUES (
        ${id},
        'patient_arrived'::"EventType",
        ${currentTicket?.status ?? 'no_show'}::"TicketStatus",
        ${nextStatus}::"TicketStatus",
        ${JSON.stringify({
          roomId: ticket.roomId,
          ticketId: ticket.id,
          ticketNumber: ticket.number,
        })}::jsonb,
        NOW()
      )
    `;

    if (ticket.room?.id) {
      await this.queueService.syncRoomQueue(ticket.room.id);
    }
    this.realtime.sendStatusUpdate(ticket.number, nextStatus, ticket.room?.name ?? '');
    return ticket;
  }

  async redirectTicket(id: number, newRoomId: number) {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { roomId: true },
    });
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'redirected', roomId: newRoomId },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'patient_redirected', oldStatus: 'waiting', newStatus: 'redirected', payload: { newRoomId } },
    });
    if (currentTicket?.roomId && currentTicket.roomId !== newRoomId) {
      await this.queueService.syncRoomQueue(currentTicket.roomId);
    }
    await this.queueService.syncRoomQueue(newRoomId);
    this.realtime.sendStatusUpdate(ticket.number, 'redirected', ticket.room?.name ?? '');
    return ticket;
  }
}
