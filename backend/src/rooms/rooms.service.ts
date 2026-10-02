import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaceType, Prisma, TicketStatus } from '@prisma/client';

const normalizePlaceType = (value?: string): PlaceType => {
  if (!value) return PlaceType.CABINET;

  const normalized = value.trim().toLowerCase();

  if (normalized === 'window' || normalized === 'окно') {
    return PlaceType.WINDOW;
  }

  if (
    normalized === 'table' ||
    normalized === 'desk' ||
    normalized === 'стол'
  ) {
    return PlaceType.TABLE;
  }

  if (
    normalized === 'cabinet' ||
    normalized === 'кабинет'
  ) {
    return PlaceType.CABINET;
  }

  return PlaceType.CABINET;
};

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  private readonly openTicketStatuses: Array<TicketStatus> = [
    'created',
    'waiting',
    'called',
    'in_service',
    'postponed',
    'redirected',
  ];

  private normalizeEstimatedWaitMinutes(value: unknown): number | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      throw new BadRequestException('estimatedWaitMinutes должен быть числом.');
    }

    return Math.max(0, Math.round(numericValue));
  }

  private async getTicketIssueEnabledByRoomIds(ids: number[]) {
    if (ids.length === 0) {
      return new Map<number, boolean>();
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: number; ticketIssueEnabled: boolean }>>`
      SELECT "id", "ticketIssueEnabled"
      FROM "rooms"
      WHERE "id" IN (${Prisma.join(ids)})
    `;

    return new Map(rows.map((row) => [row.id, row.ticketIssueEnabled]));
  }

  private async withTicketIssueEnabled<T extends { id: number }>(room: T): Promise<T & { ticketIssueEnabled: boolean }> {
    const issueMap = await this.getTicketIssueEnabledByRoomIds([room.id]);

    return {
      ...room,
      ticketIssueEnabled: issueMap.get(room.id) ?? true,
    };
  }

  private async updateTicketIssueEnabled(id: number, enabled: boolean) {
    await this.prisma.$executeRaw`
      UPDATE "rooms"
      SET "ticketIssueEnabled" = ${enabled}
      WHERE "id" = ${id}
    `;
  }

  async findAll() {
    const rooms = await this.prisma.room.findMany({
      include: { serviceTypes: { include: { serviceType: true } } },
    });
    const issueMap = await this.getTicketIssueEnabledByRoomIds(rooms.map((room) => room.id));

    return rooms.map((room) => ({
      ...room,
      ticketIssueEnabled: issueMap.get(room.id) ?? true,
    }));
  }

  async findOne(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { serviceTypes: { include: { serviceType: true } } },
    });

    return room ? this.withTicketIssueEnabled(room) : null;
  }

 async create(data: {
  name: string | null;
  serviceTypeIds: number[];
  estimatedWaitMinutes?: number | null;
  isActive?: boolean;
  ticketIssueEnabled?: boolean;
  placeType?: string;
  workingStartTime?: string;
  workingEndTime?: string;
}) {
  if (!data.name) {
    throw new BadRequestException('Поле name обязательно');
  }

  const existing = await this.prisma.room.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    throw new ConflictException(
      `Кабинет с именем "${data.name}" уже существует`,
    );
  }

  const resolvedPlaceType = normalizePlaceType(data.placeType);

  console.log('=== CREATE SERVICE DATA ===', {
    name: data.name,
    placeType_raw: data.placeType,
    placeType_resolved: resolvedPlaceType,
  });

  const result = await this.prisma.room.create({
    data: {
      name: data.name,
      isActive: data.isActive ?? true,
      placeType: resolvedPlaceType,
      estimatedWaitMinutes: this.normalizeEstimatedWaitMinutes(data.estimatedWaitMinutes) ?? null,
      workingStartTime: data.workingStartTime ?? null,
      workingEndTime: data.workingEndTime ?? null,
      serviceTypes: {
        create: (data.serviceTypeIds || []).map((id) => ({
          serviceTypeId: Number(id),
        })),
      },
    },
  });

  await this.updateTicketIssueEnabled(result.id, data.ticketIssueEnabled ?? true);

  console.log('=== CREATE RESULT ===', JSON.stringify(result, null, 2));

  return this.withTicketIssueEnabled(result);
}

    async update(id: number, data: any) {
    const updateData: any = {};

    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.active !== undefined) updateData.isActive = Boolean(data.active);
    const ticketIssueEnabled = data.ticketIssueEnabled ?? data.isTicketIssueEnabled ?? data.kioskEnabled;

    const nameRaw = data.name ?? data.title ?? data.roomName;
    if (nameRaw !== undefined) {
      updateData.name = nameRaw?.trim() || null;
    }

    if (data.placeType !== undefined) {
      updateData.placeType = normalizePlaceType(data.placeType);
    }

    const startTime = data.workingStartTime ?? data.workStartTime;
    const endTime = data.workingEndTime ?? data.workEndTime;

    if (startTime !== undefined) {
      updateData.workingStartTime = startTime || null;
    }
    if (endTime !== undefined) {
      updateData.workingEndTime = endTime || null;
    }

    const estimatedWaitMinutes = this.normalizeEstimatedWaitMinutes(
      data.estimatedWaitMinutes ?? data.estimated_wait_minutes,
    );

    if (estimatedWaitMinutes !== undefined) {
      updateData.estimatedWaitMinutes = estimatedWaitMinutes;
    }

    const rawServices = data.serviceTypeIds || data.services;
    if (Array.isArray(rawServices)) {
      const incomingIds = rawServices.map((sid: any) => Number(sid));
      updateData.serviceTypes = {
        deleteMany: {},
        create: incomingIds.map((sid) => ({ serviceTypeId: sid })),
      };
    }

    // --- ВОТ ЭТОТ БЛОК МЫ ИЗМЕНИЛИ ДЛЯ КЛАУДА ---
    const result = await this.prisma.room.update({
      where: { id },
      data: updateData,
      include: { serviceTypes: { include: { serviceType: true } } },
    });

    if (ticketIssueEnabled !== undefined) {
      await this.updateTicketIssueEnabled(id, Boolean(ticketIssueEnabled));
    }

    // Этот лог покажет в консоли, под какими именами данные выходят из базы
    console.log('=== LOG: UPDATE RESULT ===', JSON.stringify(result, null, 2));

    return this.withTicketIssueEnabled(result);
    // --------------------------------------------
  }


  async deactivate(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: {
          roomId: id,
          status: { in: this.openTicketStatuses },
        },
        data: {
          roomId: null,
          status: 'no_show',
        },
      });

      await tx.ticket.updateMany({
        where: { roomId: id },
        data: { roomId: null },
      });

      await tx.user.updateMany({
        where: { roomId: id },
        data: { roomId: null },
      });

      await tx.$executeRaw`
        UPDATE "terminals"
        SET "roomIds" = array_remove("roomIds", ${id})
        WHERE ${id} = ANY("roomIds")
      `;

      await tx.roomServiceType.deleteMany({ where: { roomId: id } });
      await tx.room.delete({ where: { id } });
    });

    return { success: true };
  }

  async getQueue(id: number) {
    return this.prisma.ticket.findMany({
      where: { roomId: id, status: 'waiting' },
    });
  }
}
