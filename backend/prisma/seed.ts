import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const serviceTypes = [
    { name: 'consultation', ticketPrefix: 'C', averageDurationMinutes: 15, priorityWeight: 1 },
    { name: 'payment', ticketPrefix: 'P', averageDurationMinutes: 5, priorityWeight: 1 },
    { name: 'xray', ticketPrefix: 'X', averageDurationMinutes: 10, priorityWeight: 2 },
    { name: 'analysis', ticketPrefix: 'A', averageDurationMinutes: 7, priorityWeight: 2 },
    { name: 'other', ticketPrefix: 'O', averageDurationMinutes: 12, priorityWeight: 1 },
  ];

  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { name: st.name },
      update: { active: true, ticketPrefix: st.ticketPrefix },
      create: { ...st, active: true },
    });
  }

  const savedServiceTypes = await prisma.serviceType.findMany({
    where: { name: { in: serviceTypes.map((serviceType) => serviceType.name) } },
  });
  const serviceTypeByName = new Map(savedServiceTypes.map((serviceType) => [serviceType.name, serviceType]));

  const rooms = [
    {
      name: 'Кабинет 1',
      serviceNames: ['consultation', 'payment', 'other'],
    },
    {
      name: 'Кабинет 2',
      serviceNames: ['xray', 'analysis'],
    },
  ];

  for (const roomSeed of rooms) {
    const room = await prisma.room.upsert({
      where: { name: roomSeed.name },
      update: {
        isActive: true,
        placeType: 'CABINET',
        workingStartTime: '08:00',
        workingEndTime: '18:00',
      },
      create: {
        name: roomSeed.name,
        isActive: true,
        placeType: 'CABINET',
        workingStartTime: '08:00',
        workingEndTime: '18:00',
      },
    });

    for (const serviceName of roomSeed.serviceNames) {
      const serviceType = serviceTypeByName.get(serviceName);

      if (!serviceType) {
        continue;
      }

      await prisma.roomServiceType.upsert({
        where: {
          roomId_serviceTypeId: {
            roomId: room.id,
            serviceTypeId: serviceType.id,
          },
        },
        update: {},
        create: {
          roomId: room.id,
          serviceTypeId: serviceType.id,
        },
      });
    }
  }

  const seededRooms = await prisma.room.findMany({
    where: { name: { in: rooms.map((room) => room.name) } },
  });

  await prisma.$executeRaw`
    INSERT INTO "terminals" ("id", "active", "location", "name", "roomIds", "serviceTypeIds", "updatedAt")
    VALUES (
      1,
      true,
      'Главный вход',
      'Киоск регистрации',
      ${seededRooms.map((room) => room.id)},
      ${savedServiceTypes.map((serviceType) => serviceType.id)},
      NOW()
    )
    ON CONFLICT ("id") DO UPDATE SET
      "active" = EXCLUDED."active",
      "location" = EXCLUDED."location",
      "name" = EXCLUDED."name",
      "roomIds" = EXCLUDED."roomIds",
      "serviceTypeIds" = EXCLUDED."serviceTypeIds",
      "updatedAt" = NOW()
  `;

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { appName: 'SmartQ' },
  });

  await prisma.$executeRaw`
    INSERT INTO "board_settings" ("id", "settings", "updatedAt")
    VALUES (
      1,
      ${JSON.stringify({
        boardType: 'general',
        profiles: [
          {
            boardType: 'general',
            id: 'general',
            name: 'Общее табло',
            recentCallsLimit: 10,
            roomBoardId: '',
            showRecentCalls: true,
            showTime: true,
            template: 'classic',
            voiceEnabled: true,
          },
        ],
        recentCallsLimit: 10,
        roomBoardId: '',
        screens: [],
        showRecentCalls: true,
        showTime: true,
        template: 'classic',
        voiceEnabled: true,
      })}::jsonb,
      NOW()
    )
    ON CONFLICT ("id") DO NOTHING
  `;

  console.log('Seed данные добавлены!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
