import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              count: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            serviceType: {
              findUnique: jest.fn(),
            },
            room: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            roomServiceType: {
              findFirst: jest.fn(),
            },
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RealtimeGateway,
          useValue: {
            emitQueueUpdated: jest.fn(),
            sendStatusUpdate: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            getRoomQueueMetrics: jest.fn(),
            syncRoomQueue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('opens ticket issue one hour before room start time', () => {
    jest.spyOn<any, any>(service as any, 'getCurrentTimeParts').mockReturnValue({
      year: 2026,
      month: 8,
      day: 4,
      hour: 8,
      minute: 0,
    });

    expect((service as any).isWithinRoomWorkHours('09:00', '18:00')).toBe(true);
  });

  it('keeps ticket issue closed earlier than one hour before room start time', () => {
    jest.spyOn<any, any>(service as any, 'getCurrentTimeParts').mockReturnValue({
      year: 2026,
      month: 8,
      day: 4,
      hour: 7,
      minute: 59,
    });

    expect((service as any).isWithinRoomWorkHours('09:00', '18:00')).toBe(false);
  });
});
