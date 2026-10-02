import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tickets = await this.prisma.$queryRaw<Array<any>>`
      SELECT
        t.*,
        CASE WHEN r."id" IS NULL THEN NULL ELSE json_build_object(
          'id', r."id",
          'name', r."name"
        ) END AS "room",
        CASE WHEN st."id" IS NULL THEN NULL ELSE json_build_object(
          'id', st."id",
          'name', st."name"
        ) END AS "serviceType"
      FROM "tickets" t
      LEFT JOIN "rooms" r ON r."id" = t."roomId"
      LEFT JOIN "service_types" st ON st."id" = t."serviceTypeId"
      WHERE t."createdAt" >= ${today}
    `;

    const totalTickets = tickets.length;
    const cancelledCount = tickets.filter(t => t.status === 'cancelled').length;
    const noShowCount = tickets.filter(t => t.status === 'no_show').length;

    const completedTickets = tickets.filter(t => t.completedAt && t.calledAt);
    const avgWaitingMinutes = completedTickets.length > 0
      ? Math.round(completedTickets.reduce((acc, t) => {
          const wait = (t.calledAt!.getTime() - t.createdAt.getTime()) / 60000;
          return acc + wait;
        }, 0) / completedTickets.length)
      : 0;

    const avgServiceMinutes = completedTickets.length > 0
      ? Math.round(completedTickets.reduce((acc, t) => {
          const service = (t.completedAt!.getTime() - t.serviceStartedAt!.getTime()) / 60000;
          return acc + service;
        }, 0) / completedTickets.length)
      : 0;

    const roomCounts: Record<string, number> = {};
    tickets.forEach(t => {
      if (t.room) {
        roomCounts[t.room.name] = (roomCounts[t.room.name] || 0) + 1;
      }
    });
    const mostBusyRoom = Object.entries(roomCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const serviceCounts: Record<string, number> = {};
    tickets.forEach(t => {
      if (t.serviceType) {
        serviceCounts[t.serviceType.name] = (serviceCounts[t.serviceType.name] || 0) + 1;
      }
    });
    const mostFrequentService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const activeWarnings = await this.prisma.queueRecommendation.count({
      where: { isResolved: false },
    });

    return {
      totalTickets,
      avgWaitingMinutes,
      avgServiceMinutes,
      cancelledCount,
      noShowCount,
      mostBusyRoom,
      mostFrequentService,
      activeWarnings,
    };
  }

  async getRoomsLoad() {
    const rooms = await this.prisma.room.findMany({
      include: {
        tickets: {
          where: { status: { in: ['waiting', 'called', 'in_service'] } },
        },
      },
    });

    return rooms.map(room => ({
      roomId: room.id,
      roomName: room.name,
      activeTickets: room.tickets.length,
    }));
  }
}
