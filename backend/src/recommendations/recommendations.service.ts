import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const activeDailyStatuses: TicketStatus[] = ['created', 'waiting', 'called', 'in_service', 'redirected'];

@Injectable()
export class RecommendationsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async onModuleInit() {
    await this.closePreviousDayTickets('startup');
  }

  private getBusinessDateAtUtcNoon(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0));
  }

  private async closeActiveTicketsAsNoShow(where: Prisma.TicketWhereInput, reason: string): Promise<number> {
    const tickets = await this.prisma.ticket.findMany({
      where,
      include: { room: true },
    });

    if (tickets.length === 0) {
      return 0;
    }

    const ticketIds = tickets.map((ticket) => ticket.id);

    await this.prisma.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: {
        status: 'no_show',
        completedAt: null,
      },
    });

    await this.prisma.queueEvent.createMany({
      data: tickets.map((ticket) => ({
        ticketId: ticket.id,
        eventType: 'ticket_cancelled',
        oldStatus: ticket.status,
        newStatus: 'no_show',
        payload: {
          autoClosed: true,
          reason,
          previousBusinessDate: ticket.businessDate.toISOString(),
          roomId: ticket.roomId,
          ticketNumber: ticket.number,
        },
      })),
    });

    tickets.forEach((ticket) => {
      this.realtime.sendStatusUpdate(ticket.number, 'no_show', ticket.room?.name ?? '');
    });

    return tickets.length;
  }

  private async closePreviousDayTickets(reason: string): Promise<number> {
    const today = this.getBusinessDateAtUtcNoon(new Date());

    return this.closeActiveTicketsAsNoShow({
      businessDate: { lt: today },
      status: { in: activeDailyStatuses },
    }, reason);
  }

  async findAll() {
    return this.prisma.queueRecommendation.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: number) {
    return this.prisma.queueRecommendation.update({
      where: { id },
      data: { isResolved: true },
    });
  }

  @Cron('0 0 22 * * *')
  async closeTodayActiveTickets() {
    const today = this.getBusinessDateAtUtcNoon(new Date());
    const closedCount = await this.closeActiveTicketsAsNoShow({
      businessDate: today,
      status: { in: activeDailyStatuses },
    }, 'scheduled_22_00');

    await this.prisma.queueRecommendation.updateMany({
      where: { isResolved: false },
      data: { isResolved: true },
    });

    if (closedCount > 0) {
      console.log(`Ежедневное закрытие талонов в 22:00: ${closedCount}`);
    }
  }

  @Cron('0 0 7 * * *')
  async closePreviousDayTicketsAtMorning() {
    const closedCount = await this.closePreviousDayTickets('scheduled_07_00');

    if (closedCount > 0) {
      console.log(`Утреннее закрытие вчерашних талонов: ${closedCount}`);
    }
  }

  async resetDailyTickets() {
    await this.closeTodayActiveTickets();

    return { success: true };
  }

  @Cron('0 5 22 * * *')
  async checkRules() {
    const rooms = await this.prisma.room.findMany({
      include: {
        tickets: {
          where: { status: { in: ['waiting', 'called', 'in_service'] } },
        },
      },
    });

    for (const room of rooms) {
      if (room.tickets.length > 10) {
        await this.prisma.queueRecommendation.create({
          data: {
            type: 'overload',
            message: `Кабинет ${room.name} перегружен, рекомендуется перенаправить пациентов`,
            severity: 'critical',
          },
        });
      }
    }

    const waitingTickets = await this.prisma.ticket.findMany({
      where: { status: 'waiting' },
      include: { serviceType: true },
    });

    const totalEta = waitingTickets.reduce((acc, ticket) => {
      return acc + (ticket.serviceType?.averageDurationMinutes || 12);
    }, 0);

    const avgEta = waitingTickets.length > 0 ? totalEta / waitingTickets.length : 0;

    if (avgEta > 20) {
      await this.prisma.queueRecommendation.create({
        data: {
          type: 'high_wait',
          message: 'Среднее время ожидания превысило 20 минут',
          severity: 'warning',
        },
      });
    }

    const highPriorityTickets = await this.prisma.ticket.findMany({
      where: { status: 'waiting', priority: 5 },
    });

    for (const ticket of highPriorityTickets) {
      const waitMinutes = (Date.now() - ticket.createdAt.getTime()) / 60000;

      if (waitMinutes > 10) {
        await this.prisma.queueRecommendation.create({
          data: {
            type: 'high_priority_wait',
            message: 'Пациент с высоким приоритетом ожидает слишком долго',
            severity: 'critical',
          },
        });
      }
    }
  }
}
