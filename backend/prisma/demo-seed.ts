import { EventType, PlaceType, PrismaClient, RecommendationSeverity, Role, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const demoPassword = 'Demo12345';

const services = [
  ['Консультация терапевта', 'Терапевт кеңесі', 'General practitioner consultation', 15, 1],
  ['Регистратура', 'Тіркеу бөлімі', 'Reception', 6, 1],
  ['Оплата услуг', 'Қызметтерді төлеу', 'Payment', 5, 1],
  ['Лабораторные анализы', 'Зертханалық талдаулар', 'Laboratory tests', 10, 2],
  ['Рентген', 'Рентген', 'X-ray', 12, 2],
  ['УЗИ', 'УДЗ', 'Ultrasound', 20, 2],
  ['Вакцинация', 'Вакцинация', 'Vaccination', 8, 1],
  ['Справки и документы', 'Анықтамалар мен құжаттар', 'Certificates and documents', 7, 1],
] as const;

const rooms = [
  ['Кабинет 101 - Терапевт', PlaceType.CABINET, ['Консультация терапевта', 'Вакцинация'], '08:00', '18:00'],
  ['Кабинет 102 - Диагностика', PlaceType.CABINET, ['Рентген', 'УЗИ'], '08:30', '17:30'],
  ['Кабинет 103 - Лаборатория', PlaceType.CABINET, ['Лабораторные анализы'], '07:30', '16:00'],
  ['Окно 1 - Регистратура', PlaceType.WINDOW, ['Регистратура', 'Справки и документы'], '08:00', '20:00'],
  ['Окно 2 - Касса', PlaceType.WINDOW, ['Оплата услуг', 'Справки и документы'], '08:00', '20:00'],
] as const;

const tickets = [
  ['A001', 'Консультация терапевта', 'Кабинет 101 - Терапевт', TicketStatus.in_service, 2, 'ru', 38, 0, 18, 12, null],
  ['A002', 'Консультация терапевта', 'Кабинет 101 - Терапевт', TicketStatus.called, 1, 'kk', 24, 2, 1, null, null],
  ['A003', 'Консультация терапевта', 'Кабинет 101 - Терапевт', TicketStatus.waiting, 5, 'ru', 16, 8, null, null, null],
  ['R001', 'Регистратура', 'Окно 1 - Регистратура', TicketStatus.waiting, 1, 'ru', 12, 4, null, null, null],
  ['R002', 'Регистратура', 'Окно 1 - Регистратура', TicketStatus.completed, 1, 'en', 52, null, 42, 40, 34],
  ['L001', 'Лабораторные анализы', 'Кабинет 103 - Лаборатория', TicketStatus.waiting, 4, 'ru', 22, 6, null, null, null],
  ['L002', 'Лабораторные анализы', 'Кабинет 103 - Лаборатория', TicketStatus.completed, 2, 'kk', 78, null, 62, 58, 46],
  ['X001', 'Рентген', 'Кабинет 102 - Диагностика', TicketStatus.waiting, 3, 'ru', 19, 14, null, null, null],
  ['U001', 'УЗИ', 'Кабинет 102 - Диагностика', TicketStatus.postponed, 2, 'ru', 35, null, 20, null, null],
  ['P001', 'Оплата услуг', 'Окно 2 - Касса', TicketStatus.waiting, 1, 'kk', 7, 3, null, null, null],
  ['P002', 'Оплата услуг', 'Окно 2 - Касса', TicketStatus.completed, 1, 'ru', 31, null, 26, 24, 18],
  ['D001', 'Справки и документы', 'Окно 1 - Регистратура', TicketStatus.no_show, 1, 'ru', 64, null, 48, null, null],
] as const;

function minutesAgo(minutes: number | null): Date | null {
  return minutes === null ? null : new Date(Date.now() - minutes * 60_000);
}

function today(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function upsertUser(name: string, email: string, role: Role, roomId?: number) {
  const password = await bcrypt.hash(demoPassword, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, password, role, roomId: roomId ?? null },
    create: { name, email, password, role, roomId: roomId ?? null },
  });
}

async function resetDemoData() {
  const serviceNames = services.map(([name]) => name);
  const roomNames = rooms.map(([name]) => name);
  const demoEmails = [
    'admin@smartq.local',
    'manager@smartq.local',
    'doctor@smartq.local',
    'lab@smartq.local',
    'reception@smartq.local',
  ];

  await prisma.queueEvent.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.queueRecommendation.deleteMany({});
  await prisma.boardScreen.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { notIn: demoEmails } } });
  await prisma.roomServiceType.deleteMany({});
  await prisma.room.deleteMany({ where: { name: { notIn: roomNames } } });
  await prisma.serviceType.deleteMany({ where: { name: { notIn: serviceNames } } });
}

async function seedCatalogs() {
  for (const [index, [name, nameKk, nameEn, averageDurationMinutes, priorityWeight]] of services.entries()) {
    const ticketPrefix = `S${index + 1}`;
    await prisma.serviceType.upsert({
      where: { name },
      update: { nameKk, nameEn, ticketPrefix, averageDurationMinutes, priorityWeight, active: true },
      create: { name, nameKk, nameEn, ticketPrefix, averageDurationMinutes, priorityWeight, active: true },
    });
  }

  const serviceList = await prisma.serviceType.findMany({
    where: { name: { in: services.map(([name]) => name) } },
  });
  const serviceByName = new Map(serviceList.map((service) => [service.name, service]));

  for (const [name, placeType, serviceNames, workingStartTime, workingEndTime] of rooms) {
    const room = await prisma.room.upsert({
      where: { name },
      update: { isActive: true, ticketIssueEnabled: true, placeType, workingStartTime, workingEndTime },
      create: { name, isActive: true, ticketIssueEnabled: true, placeType, workingStartTime, workingEndTime },
    });

    await prisma.roomServiceType.deleteMany({ where: { roomId: room.id } });

    for (const serviceName of serviceNames) {
      const service = serviceByName.get(serviceName);
      if (service) {
        await prisma.roomServiceType.create({ data: { roomId: room.id, serviceTypeId: service.id } });
      }
    }
  }

  const roomList = await prisma.room.findMany({
    where: { name: { in: rooms.map(([name]) => name) } },
  });
  const roomByName = new Map(roomList.map((room) => [room.name, room]));

  await upsertUser('Администратор SmartQ', 'admin@smartq.local', Role.admin);
  await upsertUser('Менеджер смены', 'manager@smartq.local', Role.manager);
  await upsertUser('Терапевт демо', 'doctor@smartq.local', Role.specialist, roomByName.get('Кабинет 101 - Терапевт')?.id);
  await upsertUser('Лаборант демо', 'lab@smartq.local', Role.specialist, roomByName.get('Кабинет 103 - Лаборатория')?.id);
  await upsertUser('Оператор регистратуры', 'reception@smartq.local', Role.specialist, roomByName.get('Окно 1 - Регистратура')?.id);

  await prisma.terminal.upsert({
    where: { id: 1 },
    update: {
      name: 'Киоск регистрации',
      location: 'Главный вход',
      active: true,
      roomIds: roomList.map((room) => room.id),
      serviceTypeIds: serviceList.map((service) => service.id),
    },
    create: {
      id: 1,
      name: 'Киоск регистрации',
      location: 'Главный вход',
      active: true,
      roomIds: roomList.map((room) => room.id),
      serviceTypeIds: serviceList.map((service) => service.id),
    },
  });

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { appName: 'SmartQ Demo Clinic', appIcon: 'default_icon.png' },
    create: { id: 1, appName: 'SmartQ Demo Clinic', appIcon: 'default_icon.png' },
  });

  await prisma.boardSettings.upsert({
    where: { id: 1 },
    update: {
      settings: {
        boardType: 'general',
        recentCallsLimit: 10,
        roomBoardId: '',
        screens: [],
        showRecentCalls: true,
        showTime: true,
        template: 'classic',
        voiceEnabled: true,
        profiles: [
          { id: 'general', name: 'Общее табло', boardType: 'general', recentCallsLimit: 10, roomBoardId: '', showRecentCalls: true, showTime: true, template: 'classic', voiceEnabled: true },
          { id: 'therapy', name: 'Табло терапевта', boardType: 'room', recentCallsLimit: 6, roomBoardId: String(roomByName.get('Кабинет 101 - Терапевт')?.id ?? ''), showRecentCalls: true, showTime: true, template: 'compact', voiceEnabled: true },
        ],
      },
    },
    create: {
      id: 1,
      settings: { boardType: 'general', profiles: [], recentCallsLimit: 10, roomBoardId: '', screens: [], showRecentCalls: true, showTime: true, template: 'classic', voiceEnabled: true },
    },
  });

  await prisma.boardScreen.deleteMany({});
  await prisma.boardScreen.createMany({
    data: [
      { name: 'Главное табло холла', roomNames: ['Кабинет 101 - Терапевт', 'Кабинет 102 - Диагностика', 'Кабинет 103 - Лаборатория'] },
      { name: 'Табло регистратуры', roomNames: ['Окно 1 - Регистратура', 'Окно 2 - Касса'] },
    ],
  });

  return { serviceByName, roomByName };
}

async function seedTickets(serviceByName: Map<string, { id: number }>, roomByName: Map<string, { id: number }>) {
  for (const [number, serviceName, roomName, status, priority, language, createdAgo, etaMinutes, calledAgo, serviceStartedAgo, completedAgo] of tickets) {
    const service = serviceByName.get(serviceName);
    const room = roomByName.get(roomName);
    if (!service || !room) continue;

    const ticket = await prisma.ticket.create({
      data: {
        number,
        serviceTypeId: service.id,
        roomId: room.id,
        priority,
        isCritical: priority >= 4,
        language,
        status,
        etaMinutes,
        businessDate: today(),
        createdAt: minutesAgo(createdAgo) ?? new Date(),
        calledAt: minutesAgo(calledAgo),
        serviceStartedAt: minutesAgo(serviceStartedAgo),
        completedAt: minutesAgo(completedAgo),
      },
    });

    await prisma.queueEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: EventType.ticket_created,
        newStatus: TicketStatus.waiting,
        payload: { roomId: room.id, serviceTypeId: service.id },
        createdAt: minutesAgo(createdAgo) ?? new Date(),
      },
    });

    if (calledAgo !== null) {
      await prisma.queueEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: EventType.ticket_called,
          oldStatus: TicketStatus.waiting,
          newStatus: TicketStatus.called,
          payload: { roomId: room.id },
          createdAt: minutesAgo(calledAgo) ?? new Date(),
        },
      });
    }

    if (serviceStartedAgo !== null) {
      await prisma.queueEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: EventType.service_started,
          oldStatus: TicketStatus.called,
          newStatus: TicketStatus.in_service,
          createdAt: minutesAgo(serviceStartedAgo) ?? new Date(),
        },
      });
    }

    if (completedAgo !== null) {
      await prisma.queueEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: EventType.service_completed,
          oldStatus: TicketStatus.in_service,
          newStatus: TicketStatus.completed,
          createdAt: minutesAgo(completedAgo) ?? new Date(),
        },
      });
    }
  }

  await prisma.queueRecommendation.createMany({
    data: [
      { type: 'high_priority_waiting', message: 'Талон A003 имеет высокий приоритет и ожидает вызова.', severity: RecommendationSeverity.warning },
      { type: 'room_load', message: 'В кабинете 101 накопилась активная очередь. Рекомендуется подключить второго специалиста.', severity: RecommendationSeverity.info },
      { type: 'postponed_ticket', message: 'Есть отложенный талон U001. Пациента можно вернуть в обслуживание.', severity: RecommendationSeverity.warning },
    ],
  });
}

async function main() {
  await resetDemoData();
  const { serviceByName, roomByName } = await seedCatalogs();
  await seedTickets(serviceByName, roomByName);

  console.log('Demo seed completed.');
  console.log('Demo users:');
  console.log(`  admin@smartq.local / ${demoPassword}`);
  console.log(`  manager@smartq.local / ${demoPassword}`);
  console.log(`  doctor@smartq.local / ${demoPassword}`);
  console.log(`  lab@smartq.local / ${demoPassword}`);
  console.log(`  reception@smartq.local / ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
