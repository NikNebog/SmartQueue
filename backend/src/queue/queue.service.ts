import { Injectable } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type QueueTicketWithService = {
  createdAt: Date;
  id: number;
  priority: number;
  serviceStartedAt: Date | null;
  serviceType: { averageDurationMinutes: number | null } | null;
  status: TicketStatus;
};

type QueueMetrics = {
  activeTickets: number;
  avgServiceMinutes: number;
  etaMinutes: number;
  peopleAhead: number;
  queueDurationMinutes: number;
};

const activeQueueStatuses: TicketStatus[] = ['created', 'waiting', 'called', 'in_service', 'redirected'];
const currentQueueStatuses = new Set<TicketStatus>(['called', 'in_service']);

type BoardSnapshotPayload = {
  rooms: Awaited<ReturnType<PrismaService['room']['findMany']>>;
  tickets: Awaited<ReturnType<PrismaService['ticket']['findMany']>>;
  updatedAt: string;
};

@Injectable()
export class QueueService {
  constructor(private prisma: PrismaService) {}

  private getBoardSnapshotUpdatedAt(
    tickets: Array<{
      calledAt?: Date | null;
      completedAt?: Date | null;
      createdAt: Date;
      updatedAt?: Date | null;
    }>,
  ): string {
    const timestamps = [
      ...tickets.flatMap((ticket) => [
        ticket.updatedAt,
        ticket.calledAt,
        ticket.completedAt,
        ticket.createdAt,
      ]),
    ]
      .filter((value): value is Date => value instanceof Date)
      .map((value) => value.getTime());

    const nextTimestamp = timestamps.length > 0
      ? Math.max(...timestamps)
      : Date.now();

    return new Date(nextTimestamp).toISOString();
  }

  private async buildBoardSnapshot(where: Parameters<typeof this.prisma.ticket.findMany>[0]['where']): Promise<BoardSnapshotPayload> {
    const today = this.getTodayBusinessDate();
    const ticketWhere = {
      businessDate: today,
      ...where,
    };

    const [rooms, active, recent] = await Promise.all([
      this.prisma.room.findMany(),
      this.prisma.ticket.findMany({
        where: {
          ...ticketWhere,
          status: { in: ['waiting', 'called', 'in_service'] },
        },
        include: { room: true, serviceType: true },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.ticket.findMany({
        where: {
          ...ticketWhere,
          OR: [
            { status: { in: ['called', 'in_service'] } },
            { status: 'completed' },
          ],
        },
        include: { room: true, serviceType: true },
        orderBy: [
          { calledAt: 'desc' },
          { completedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 30,
      }),
    ]);
    const tickets = [...active, ...recent];

    return {
      rooms,
      tickets,
      updatedAt: this.getBoardSnapshotUpdatedAt(tickets),
    };
  }

  private getTodayBusinessDate(): Date {
    const now = new Date();

    // businessDate хранится как DATE в Postgres; полдень в UTC не переедет на предыдущий день
    // при сериализации из локального времени в Prisma.
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0));
  }

  private getDefaultRoomServiceMinutes(room: {
    serviceTypes?: Array<{
      serviceType?: { averageDurationMinutes?: number | null } | null;
    }>;
  }): number {
    const configuredDurations = (room.serviceTypes ?? [])
      .map((serviceTypeLink) => serviceTypeLink.serviceType?.averageDurationMinutes ?? null)
      .filter((minutes): minutes is number => Number.isFinite(minutes) && minutes > 0);

    if (configuredDurations.length === 0) {
      return 10;
    }

    return Math.max(1, Math.round(
      configuredDurations.reduce((sum, minutes) => sum + minutes, 0) / configuredDurations.length,
    ));
  }

  private getTicketServiceMinutes(
    ticket: QueueTicketWithService,
    defaultRoomServiceMinutes: number,
    now: Date,
  ): number {
    const configuredMinutes = ticket.serviceType?.averageDurationMinutes ?? defaultRoomServiceMinutes;
    const durationMinutes = Math.max(1, Math.round(configuredMinutes));

    if (ticket.status !== 'in_service' || !ticket.serviceStartedAt) {
      return durationMinutes;
    }

    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - ticket.serviceStartedAt.getTime()) / 60_000));

    return Math.max(1, durationMinutes - elapsedMinutes);
  }

  private compareQueueTickets(
    left: QueueTicketWithService & { isProjected?: boolean },
    right: QueueTicketWithService & { isProjected?: boolean },
  ): number {
    const leftIsCurrent = currentQueueStatuses.has(left.status);
    const rightIsCurrent = currentQueueStatuses.has(right.status);

    if (leftIsCurrent !== rightIsCurrent) {
      return leftIsCurrent ? -1 : 1;
    }

    const priorityDelta = right.priority - left.priority;

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    if (left.isProjected !== right.isProjected) {
      return left.isProjected ? 1 : -1;
    }

    return left.id - right.id;
  }

  async getRoomQueueMetrics(
    roomId: number,
    nextTicket?: { createdAt?: Date; priority?: number },
  ): Promise<QueueMetrics> {
    const today = this.getTodayBusinessDate();
    const now = nextTicket?.createdAt ?? new Date();
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        serviceTypes: {
          include: {
            serviceType: {
              select: { averageDurationMinutes: true },
            },
          },
        },
      },
    });

    const defaultRoomServiceMinutes = room ? this.getDefaultRoomServiceMinutes(room) : 10;
    const roomTickets = await this.prisma.ticket.findMany({
      where: {
        roomId,
        businessDate: today,
        status: { in: activeQueueStatuses },
      },
      include: {
        serviceType: {
          select: { averageDurationMinutes: true },
        },
      },
    });

    const sortedTickets = roomTickets.sort((left, right) => this.compareQueueTickets(left, right));
    const queueDurationMinutes = sortedTickets.reduce(
      (sum, ticket) => sum + this.getTicketServiceMinutes(ticket, defaultRoomServiceMinutes, now),
      0,
    );
    const avgServiceMinutes = sortedTickets.length > 0
      ? Math.max(1, Math.round(queueDurationMinutes / sortedTickets.length))
      : defaultRoomServiceMinutes;

    if (!nextTicket) {
      return {
        activeTickets: sortedTickets.length,
        avgServiceMinutes,
        etaMinutes: queueDurationMinutes,
        peopleAhead: sortedTickets.length,
        queueDurationMinutes,
      };
    }

    const projectedTicket: QueueTicketWithService & { isProjected: true } = {
      createdAt: nextTicket.createdAt ?? now,
      id: Number.MAX_SAFE_INTEGER,
      isProjected: true,
      priority: nextTicket.priority ?? 1,
      serviceStartedAt: null,
      serviceType: null,
      status: 'waiting',
    };
    const projectedQueue = [...sortedTickets, projectedTicket]
      .sort((left, right) => this.compareQueueTickets(left, right));
    const projectedIndex = projectedQueue.findIndex((ticket) => ticket.id === projectedTicket.id);
    const ticketsAhead = projectedQueue.slice(0, projectedIndex);
    const etaMinutes = ticketsAhead.reduce((sum, ticket) => (
      sum + this.getTicketServiceMinutes(ticket, defaultRoomServiceMinutes, now)
    ), 0);

    return {
      activeTickets: sortedTickets.length,
      avgServiceMinutes,
      etaMinutes: Math.max(0, Math.round(etaMinutes)),
      peopleAhead: ticketsAhead.length,
      queueDurationMinutes,
    };
  }

  async syncRoomQueue(roomId: number) {
    const today = this.getTodayBusinessDate();
    const now = new Date();
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        serviceTypes: {
          include: {
            serviceType: {
              select: { averageDurationMinutes: true },
            },
          },
        },
      },
    });
    const defaultRoomServiceMinutes = room ? this.getDefaultRoomServiceMinutes(room) : 10;
    const roomTickets = await this.prisma.ticket.findMany({
      where: {
        roomId,
        businessDate: today,
        status: { in: activeQueueStatuses },
      },
      include: {
        serviceType: {
          select: { averageDurationMinutes: true },
        },
      },
    });
    const sortedTickets = roomTickets.sort((left, right) => this.compareQueueTickets(left, right));
    let minutesBeforeTicket = 0;

    for (const ticket of sortedTickets) {
      const etaMinutes = currentQueueStatuses.has(ticket.status)
        ? 0
        : Math.max(0, Math.round(minutesBeforeTicket));

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { etaMinutes },
      });

      minutesBeforeTicket += this.getTicketServiceMinutes(ticket, defaultRoomServiceMinutes, now);
    }
  }

  // Получить текущую очередь по кабинету (с приоритетом)
  async getQueueByRoom(roomId: number) {
    const today = this.getTodayBusinessDate();

    return this.prisma.ticket.findMany({
      where: {
        roomId,
        businessDate: today,
        status: { in: ['waiting', 'called', 'in_service'] },
      },
      include: { serviceType: true },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  // Пересчитать ETA для всех waiting талонов в кабинете
  async recalculateETA(roomId: number) {
    await this.syncRoomQueue(roomId);
  }

  // Получить реальное среднее время обслуживания по типу услуги
  async getRealAvgDuration(serviceTypeId: number): Promise<number> {
    const completed = await this.prisma.ticket.findMany({
      where: {
        serviceTypeId,
        status: 'completed',
        serviceStartedAt: { not: null },
        completedAt: { not: null },
      },
      select: { serviceStartedAt: true, completedAt: true },
      take: 20,
      orderBy: { completedAt: 'desc' },
    });

    if (completed.length === 0) {
      const serviceType = await this.prisma.serviceType.findUnique({
        where: { id: serviceTypeId },
      });
      return serviceType?.averageDurationMinutes ?? 10;
    }

    const totalMinutes = completed.reduce((sum, t) => {
      const diff = t.completedAt.getTime() - t.serviceStartedAt.getTime();
      return sum + diff / 60000;
    }, 0);

    return Math.round(totalMinutes / completed.length);
  }

  // Среднее время от waiting до completed по каждой услуге
  async getAvgTimeByServiceType() {
    const today = this.getTodayBusinessDate();
    const serviceTypes = await this.prisma.serviceType.findMany();
    const result = [];

    for (const serviceType of serviceTypes) {
      const completedTickets = await this.prisma.ticket.findMany({
        where: {
          businessDate: today,
          serviceTypeId: serviceType.id,
          status: 'completed',
          completedAt: { not: null },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      });

      let avgMinutes = 0;
      if (completedTickets.length > 0) {
        const totalMinutes = completedTickets.reduce((sum, t) => {
          const diff = t.completedAt.getTime() - t.createdAt.getTime();
          return sum + diff / 60000;
        }, 0);
        avgMinutes = Math.round(totalMinutes / completedTickets.length);
      } else {
        avgMinutes = serviceType.averageDurationMinutes ?? 10;
      }

      result.push({
        serviceTypeId: serviceType.id,
        serviceTypeName: serviceType.name,
        avgMinutesFromWaitingToCompleted: avgMinutes,
        totalCompleted: completedTickets.length,
      });
    }

    return result;
  }

  // Аналитика за период (day, week, month, year)
  async getAnalyticsByPeriod(period: string = 'day') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // day
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
    }

    // Общее количество талонов за период
    const totalTickets = await this.prisma.ticket.count({
      where: { createdAt: { gte: startDate } },
    });

    // Завершённые талоны
    const completedTickets = await this.prisma.ticket.count({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
      },
    });

    // Отменённые талоны
    const cancelledTickets = await this.prisma.ticket.count({
      where: {
        createdAt: { gte: startDate },
        status: 'cancelled',
      },
    });

    // No-show талоны
    const noShowTickets = await this.prisma.ticket.count({
      where: {
        createdAt: { gte: startDate },
        status: 'no_show',
      },
    });

    // Среднее время ожидания (от createdAt до calledAt)
    const calledTickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate },
        calledAt: { not: null },
      },
      select: { createdAt: true, calledAt: true },
    });

    let avgWaitingMinutes = 0;
    if (calledTickets.length > 0) {
      const total = calledTickets.reduce((sum, t) => {
        return sum + (t.calledAt.getTime() - t.createdAt.getTime()) / 60000;
      }, 0);
      avgWaitingMinutes = Math.round(total / calledTickets.length);
    }

    // Среднее время обслуживания (от serviceStartedAt до completedAt)
    const servedTickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
        serviceStartedAt: { not: null },
        completedAt: { not: null },
      },
      select: { serviceStartedAt: true, completedAt: true },
    });

    let avgServiceMinutes = 0;
    if (servedTickets.length > 0) {
      const total = servedTickets.reduce((sum, t) => {
        return sum + (t.completedAt.getTime() - t.serviceStartedAt.getTime()) / 60000;
      }, 0);
      avgServiceMinutes = Math.round(total / servedTickets.length);
    }

    // Самый частый тип услуги
    const serviceTypeStats = await this.prisma.ticket.groupBy({
      by: ['serviceTypeId'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    let mostFrequentService = null;
    if (serviceTypeStats.length > 0) {
      mostFrequentService = await this.prisma.serviceType.findUnique({
        where: { id: serviceTypeStats[0].serviceTypeId },
      });
    }

    // Нагрузка по кабинетам
    const roomStats = await this.prisma.ticket.groupBy({
      by: ['roomId'],
      where: {
        createdAt: { gte: startDate },
        roomId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const roomsWithNames = await Promise.all(
      roomStats.map(async (r) => {
        const room = await this.prisma.room.findUnique({ where: { id: r.roomId } });
        return {
          roomId: r.roomId,
          roomName: room?.name ?? 'Неизвестно',
          ticketCount: r._count.id,
        };
      })
    );

    return {
      period,
      startDate,
      totalTickets,
      completedTickets,
      cancelledTickets,
      noShowTickets,
      avgWaitingMinutes,
      avgServiceMinutes,
      mostFrequentService: mostFrequentService?.name ?? null,
      roomStats: roomsWithNames,
    };
  }

  // Получить общую статистику очереди
  async getQueueStats() {
    const today = this.getTodayBusinessDate();
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
      include: {
        serviceTypes: {
          include: {
            serviceType: {
              select: { averageDurationMinutes: true },
            },
          },
        },
      },
    });

    const stats = [];

    for (const room of rooms) {
      const metrics = await this.getRoomQueueMetrics(room.id);

      stats.push({
        roomId: room.id,
        roomName: room.name,
        activeTickets: metrics.activeTickets,
        avgServiceMinutes: metrics.avgServiceMinutes,
        etaMinutes: metrics.queueDurationMinutes,
      });
    }

    return stats;
  }

  // Получить следующий талон для кабинета (с учётом приоритета)
  async getNextTicket(roomId: number) {
    const today = this.getTodayBusinessDate();

    return this.prisma.ticket.findFirst({
      where: {
        roomId,
        businessDate: today,
        status: { in: ['waiting', 'redirected'] },
      },
      include: { serviceType: true },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  // Проверить перегрузку кабинетов
  async checkOverload() {
    const today = this.getTodayBusinessDate();
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
    });

    const overloaded = [];

    for (const room of rooms) {
      const queueCount = await this.prisma.ticket.count({
        where: {
          roomId: room.id,
          businessDate: today,
          status: { in: ['waiting', 'called'] },
        },
      });

      if (queueCount > 10) {
        overloaded.push({
          roomId: room.id,
          roomName: room.name,
          queueCount,
        });
      }
    }

    return overloaded;
  }

  // Данные для табло — без авторизации
  async getBoardData() {
    return this.buildBoardSnapshot({});
  }

  // История вызванных талонов для табло — без авторизации
  async getBoardHistory() {
    const today = this.getTodayBusinessDate();

    return this.prisma.ticket.findMany({
      where: {
        businessDate: today,
        OR: [
          { status: { in: ['called', 'in_service'] } },
          { status: 'completed' },
        ],
      },
      select: {
        id: true,
        number: true,
        priority: true,
        language: true,
        status: true,
        etaMinutes: true,
        serviceTypeId: true,
        roomId: true,
        createdAt: true,
        calledAt: true,
        serviceStartedAt: true,
        completedAt: true,
        serviceType: {
          select: {
            id: true,
            name: true,
            averageDurationMinutes: true,
            priorityWeight: true,
            active: true,
          },
        },
        room: {
          select: {
            id: true,
            name: true,
            isActive: true,
            placeType: true,
            workingStartTime: true,
            workingEndTime: true,
          },
        },
      },
      orderBy: [
        { calledAt: 'desc' },
        { completedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 30,
    });
  }

  // Получить пациентов с высоким приоритетом которые долго ждут
  async getHighPriorityWaiting() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const today = this.getTodayBusinessDate();

    return this.prisma.ticket.findMany({
      where: {
        businessDate: today,
        priority: { gte: 4 },
        status: 'waiting',
        createdAt: { lte: tenMinutesAgo },
      },
      include: { serviceType: true, room: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async resolveBoardRoomId(roomBoardId: string): Promise<number | undefined> {
    const numericId = Number(roomBoardId);

    if (Number.isInteger(numericId) && numericId > 0) {
      const roomById = await this.prisma.room.findUnique({ where: { id: numericId } });

      if (roomById) {
        return roomById.id;
      }
    }

    const rooms = await this.prisma.room.findMany();
    const normalizedBoardId = roomBoardId.trim();

    return rooms.find((room) => {
      const numberMatch = room.name.match(/\d+/)?.[0];

      return numberMatch === normalizedBoardId || room.name === normalizedBoardId;
    })?.id;
  }

  async getBoardDataByRoom(roomBoardId: string) {
    const roomId = await this.resolveBoardRoomId(roomBoardId);

    if (!roomId) {
      return {
        rooms: [],
        tickets: [],
        updatedAt: new Date(0).toISOString(),
      };
    }

    return this.buildBoardSnapshot({ roomId });
  }
}
