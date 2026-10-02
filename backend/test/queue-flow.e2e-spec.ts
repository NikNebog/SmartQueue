import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { QueueController } from '../src/queue/queue.controller';
import { QueueService } from '../src/queue/queue.service';
import { JwtGuard } from '../src/auth/guards/jwt.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
import { ServiceTypesController } from '../src/service-types/service-types.controller';
import { ServiceTypesService } from '../src/service-types/service-types.service';
import { TicketsController } from '../src/tickets/tickets.controller';
import { TicketsService } from '../src/tickets/tickets.service';

type ServiceTypeRecord = {
  active: boolean;
  averageDurationMinutes: number;
  id: number;
  name: string;
  nameEn: string | null;
  nameKk: string | null;
  priorityWeight: number;
};

type TicketRecord = {
  calledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  etaMinutes: number | null;
  id: number;
  isCritical: boolean;
  language: string | null;
  number: string;
  priority: number;
  roomId: number | null;
  serviceStartedAt: Date | null;
  serviceTypeId: number;
  status: string;
};

const rooms = [
  { id: 21, name: 'Кабинет 123', isActive: true },
  { id: 22, name: 'Кабинет 2', isActive: true },
];

const roomServiceTypes = [
  { roomId: 21, serviceTypeId: 27 },
  { roomId: 22, serviceTypeId: 27 },
];

function createPrismaMock() {
  let nextTicketId = 1;
  let nextServiceTypeId = 100;
  const queueEvents: unknown[] = [];
  const serviceTypes: ServiceTypeRecord[] = [
    {
      active: true,
      averageDurationMinutes: 10,
      id: 27,
      name: 'Рентген',
      nameEn: null,
      nameKk: null,
      priorityWeight: 1,
    },
  ];
  const tickets: TicketRecord[] = [];

  function withRelations(ticket: TicketRecord) {
    return {
      ...ticket,
      room: rooms.find((room) => room.id === ticket.roomId) ?? null,
      serviceType: serviceTypes.find((serviceType) => serviceType.id === ticket.serviceTypeId) ?? null,
    };
  }

  function matchesStatus(ticket: TicketRecord, status: unknown): boolean {
    if (!status) return true;
    if (typeof status === 'string') return ticket.status === status;
    if (typeof status === 'object' && 'in' in status) {
      return (status as { in: string[] }).in.includes(ticket.status);
    }
    return true;
  }

  function matchesTicketWhere(ticket: TicketRecord, where: any): boolean {
    if (!where) return true;
    if (where.id !== undefined && ticket.id !== where.id) return false;
    if (where.number !== undefined && ticket.number !== where.number) return false;
    if (where.roomId !== undefined && ticket.roomId !== where.roomId) return false;
    if (where.serviceTypeId !== undefined && ticket.serviceTypeId !== where.serviceTypeId) return false;
    if (where.status !== undefined && !matchesStatus(ticket, where.status)) return false;
    return true;
  }

  return {
    $queryRaw: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');

      if (sql.includes('UPDATE "tickets"')) {
        const id = values[0] as number;
        const ticket = tickets.find((item) => item.id === id);

        if (!ticket) {
          return Promise.resolve([]);
        }

        ticket.status = 'postponed';

        return Promise.resolve([ticket]);
      }

      if (sql.includes('FROM "tickets"')) {
        const id = values[0] as number;
        const statusRoomId = values[0] as number | null;
        const roomId = values[1] as number | null;

        if (sql.includes('WHERE t."id"')) {
          const ticket = tickets.find((item) => item.id === id);

          return Promise.resolve(ticket ? [withRelations(ticket)] : []);
        }

        return Promise.resolve(
          tickets
            .filter((ticket) => ticket.status === 'postponed')
            .filter((ticket) => statusRoomId == null || ticket.roomId === roomId)
            .map(withRelations),
        );
      }

      if (sql.includes('FROM "rooms"')) {
        const roomId = values[0] as number;
        const serviceTypeId = values[1] as number;
        const room = rooms.find((item) => (
          item.id === roomId &&
          item.isActive &&
          roomServiceTypes.some((link) => link.roomId === roomId && link.serviceTypeId === serviceTypeId)
        ));

        return Promise.resolve(room ? [{ id: room.id, name: room.name }] : []);
      }

      if (sql.includes('INSERT INTO "service_types"')) {
        const [name, nameKk, nameEn, averageDurationMinutes, priorityWeight, active] = values as [
          string,
          string | null,
          string | null,
          number,
          number,
          boolean,
        ];
        const serviceType: ServiceTypeRecord = {
          active,
          averageDurationMinutes,
          id: nextServiceTypeId++,
          name,
          nameEn,
          nameKk,
          priorityWeight,
        };

        serviceTypes.push(serviceType);
        return Promise.resolve([serviceType]);
      }

      if (sql.includes('FROM "service_types"') && sql.includes('WHERE "id"')) {
        const id = values[0] as number;
        return Promise.resolve(serviceTypes.filter((serviceType) => serviceType.id === id));
      }

      if (sql.includes('FROM "service_types"')) {
        return Promise.resolve([...serviceTypes].sort((left, right) => left.id - right.id));
      }

      return Promise.resolve([]);
    }),
    $executeRaw: jest.fn(() => Promise.resolve(1)),
    queueEvent: {
      create: jest.fn(({ data }) => {
        queueEvents.push(data);
        return Promise.resolve(data);
      }),
    },
    serviceType: {
      findUnique: jest.fn(({ where }) => (
        Promise.resolve(serviceTypes.find((serviceType) => serviceType.id === where.id) ?? null)
      )),
    },
    ticket: {
      count: jest.fn(({ where }) => Promise.resolve(tickets.filter((ticket) => matchesTicketWhere(ticket, where)).length)),
      create: jest.fn(({ data }) => {
        const ticket: TicketRecord = {
          calledAt: null,
          completedAt: null,
          createdAt: new Date(),
          etaMinutes: data.etaMinutes ?? null,
          id: nextTicketId++,
          isCritical: false,
          language: data.language ?? null,
          number: data.number,
          priority: data.priority ?? 1,
          roomId: data.roomId ?? null,
          serviceStartedAt: null,
          serviceTypeId: data.serviceTypeId,
          status: data.status ?? 'created',
        };

        tickets.push(ticket);
        return Promise.resolve(withRelations(ticket));
      }),
      findFirst: jest.fn(({ where, orderBy }) => {
        const found = [...tickets]
          .filter((ticket) => matchesTicketWhere(ticket, where))
          .sort((left, right) => {
            if (Array.isArray(orderBy) && orderBy.some((item) => item.priority === 'desc')) {
              const priorityDelta = right.priority - left.priority;
              if (priorityDelta !== 0) return priorityDelta;
            }
            return left.createdAt.getTime() - right.createdAt.getTime();
          })[0];

        return Promise.resolve(found ? withRelations(found) : null);
      }),
      findMany: jest.fn(({ where, orderBy } = {}) => {
        const found = [...tickets]
          .filter((ticket) => matchesTicketWhere(ticket, where))
          .sort((left, right) => {
            if (orderBy?.createdAt === 'desc') {
              return right.createdAt.getTime() - left.createdAt.getTime();
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });

        return Promise.resolve(found.map(withRelations));
      }),
      findUnique: jest.fn(({ where }) => {
        const found = tickets.find((ticket) => ticket.id === where.id);
        return Promise.resolve(found ? withRelations(found) : null);
      }),
      update: jest.fn(({ where, data }) => {
        const ticket = tickets.find((item) => item.id === where.id);
        if (!ticket) {
          throw new Error(`Ticket ${where.id} was not found`);
        }

        Object.assign(ticket, data);
        return Promise.resolve(withRelations(ticket));
      }),
    },
    __data: {
      queueEvents,
      serviceTypes,
      tickets,
    },
  };
}

describe('Queue flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController, QueueController, ServiceTypesController],
      providers: [
        TicketsService,
        QueueService,
        ServiceTypesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RealtimeGateway,
          useValue: {
            sendStatusUpdate: jest.fn(),
            sendTicketCalled: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a kiosk ticket with queue position', async () => {
    const response = await request(app.getHttpServer())
      .post('/tickets/kiosk')
      .send({
        language: 'ru',
        priority: 1,
        roomId: 21,
        serviceTypeId: 27,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      number: 'Р001',
      peopleAhead: 0,
      queuePosition: 1,
      roomId: 21,
      serviceTypeId: 27,
      status: 'waiting',
    });
  });

  it('returns redirected ticket as next and allows calling it', async () => {
    const created = await request(app.getHttpServer())
      .post('/tickets/kiosk')
      .send({ priority: 1, roomId: 21, serviceTypeId: 27 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tickets/${created.body.id}/redirect`)
      .send({ newRoomId: 22 })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('redirected');
        expect(body.roomId).toBe(22);
      });

    await request(app.getHttpServer())
      .get('/queue/room/22/next')
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
        expect(body.status).toBe('redirected');
      });

    await request(app.getHttpServer())
      .post(`/tickets/${created.body.id}/call`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('called');
        expect(body.calledAt).toBeTruthy();
      });
  });

  it('postpones called ticket and returns it to waiting queue', async () => {
    const created = await request(app.getHttpServer())
      .post('/tickets/kiosk')
      .send({ priority: 1, roomId: 21, serviceTypeId: 27 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tickets/${created.body.id}/call`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('called');
      });

    await request(app.getHttpServer())
      .post(`/tickets/${created.body.id}/postpone`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('postponed');
        expect(body.roomId).toBe(21);
      });

    await request(app.getHttpServer())
      .get('/queue/room/21/next')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({});
      });

    await request(app.getHttpServer())
      .get('/tickets?roomId=21&status=postponed')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: created.body.id,
            status: 'postponed',
          }),
        ]);
      });

    await request(app.getHttpServer())
      .post(`/tickets/${created.body.id}/return`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('waiting');
        expect(body.calledAt).toBeNull();
        expect(body.serviceStartedAt).toBeNull();
        expect(body.completedAt).toBeNull();
      });

    await request(app.getHttpServer())
      .get('/queue/room/21/next')
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
        expect(body.status).toBe('waiting');
      });
  });

  it('creates service type translations and returns them', async () => {
    const created = await request(app.getHttpServer())
      .post('/service-types')
      .send({
        active: true,
        averageDurationMinutes: 12,
        name: 'Консультация',
        priorityWeight: 1,
        translations: {
          en: 'Consultation',
          kk: 'Кеңес беру',
        },
      })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'Консультация',
      nameEn: 'Consultation',
      nameKk: 'Кеңес беру',
    });

    await request(app.getHttpServer())
      .get('/service-types')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: created.body.id,
              nameEn: 'Consultation',
              nameKk: 'Кеңес беру',
            }),
          ]),
        );
      });
  });
});
