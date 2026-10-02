import type {
  AnalyticsPoint,
  QueueEvent,
  QueueKpi,
  QueueRecommendation,
  QueueSnapshot,
  Room,
  Ticket,
} from '@shared/types'
import { t } from '@shared/locales/useLocale'
import { createQueueEvent, deepClone, getAverageWaitingMinutes, isActiveTicket } from '@shared/utils'

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export const mockRooms: Room[] = [
  {
    id: 'room-101',
    name: 'Кабинет 101',
    department: t.serviceType.registration,
    specialistName: 'Марина Петрова',
    status: 'busy',
    currentTicketId: 'ticket-101',
    serviceTypeIds: [1, 15, 18, 19],
    workload: 82,
    loadPercent: 82,
  },
  {
    id: 'room-203',
    name: 'Кабинет 203',
    department: t.serviceType.consultation,
    specialistName: 'Сергей Волков',
    status: 'busy',
    currentTicketId: 'ticket-104',
    serviceTypeIds: [2, 3, 4, 5, 6, 16, 17],
    workload: 74,
    loadPercent: 74,
  },
  {
    id: 'room-214',
    name: 'Кабинет 214',
    department: t.serviceType.diagnostics,
    specialistName: 'Елена Морозова',
    status: 'open',
    serviceTypeIds: [9, 10, 11, 12, 13],
    workload: 58,
    loadPercent: 58,
  },
  {
    id: 'room-305',
    name: 'Кабинет 305',
    department: t.serviceType.laboratory,
    specialistName: 'Илья Смирнов',
    status: 'paused',
    serviceTypeIds: [7, 8],
    workload: 34,
    loadPercent: 34,
  },
]

export const mockTickets: Ticket[] = [
  {
    id: 'ticket-101',
    number: 'R-124',
    patientName: 'Николай Соколов',
    serviceType: 'registration',
    priority: 'high',
    status: 'called',
    createdAt: minutesAgo(36),
    calledAt: minutesAgo(4),
    roomId: 'room-101',
    assignedTo: 'user-manager',
    etaMinutes: 0,
    notes: 'Документы проверены, ожидается проверка страховки.',
  },
  {
    id: 'ticket-104',
    number: 'C-207',
    patientName: 'Ольга Кузнецова',
    serviceType: 'consultation',
    priority: 'critical',
    status: 'in_service',
    createdAt: minutesAgo(54),
    calledAt: minutesAgo(17),
    startedAt: minutesAgo(12),
    roomId: 'room-203',
    assignedTo: 'user-specialist',
    etaMinutes: 0,
    notes: 'Нужна приоритетная проверка и подтверждение маршрута.',
  },
  {
    id: 'ticket-106',
    number: 'D-318',
    patientName: 'Михаил Антонов',
    serviceType: 'diagnostics',
    priority: 'normal',
    status: 'waiting',
    createdAt: minutesAgo(28),
    etaMinutes: 18,
  },
  {
    id: 'ticket-109',
    number: 'L-441',
    patientName: 'София Лебедева',
    serviceType: 'laboratory',
    priority: 'high',
    status: 'waiting',
    createdAt: minutesAgo(24),
    etaMinutes: 22,
  },
  {
    id: 'ticket-112',
    number: 'P-072',
    patientName: 'Роман Егоров',
    serviceType: 'pharmacy',
    priority: 'low',
    status: 'waiting',
    createdAt: minutesAgo(18),
    etaMinutes: 31,
  },
  {
    id: 'ticket-117',
    number: 'B-065',
    patientName: 'Ирина Белова',
    serviceType: 'billing',
    priority: 'normal',
    status: 'waiting',
    createdAt: minutesAgo(41),
    etaMinutes: 16,
    notes: 'Ожидает подтверждения оплаты перед консультацией.',
  },
  {
    id: 'ticket-089',
    number: 'C-176',
    patientName: 'Павел Романов',
    serviceType: 'consultation',
    priority: 'normal',
    status: 'completed',
    createdAt: minutesAgo(85),
    calledAt: minutesAgo(46),
    startedAt: minutesAgo(39),
    completedAt: minutesAgo(21),
    roomId: 'room-203',
    assignedTo: 'user-specialist',
    etaMinutes: 0,
  },
  {
    id: 'ticket-071',
    number: 'R-118',
    patientName: 'Анна Фёдорова',
    serviceType: 'registration',
    priority: 'normal',
    status: 'no_show',
    createdAt: minutesAgo(96),
    calledAt: minutesAgo(62),
    roomId: 'room-101',
    etaMinutes: 0,
    notes: 'Пациент не подошёл после второго вызова.',
  },
  {
    id: 'ticket-064',
    number: 'L-392',
    patientName: 'Виктор Макаров',
    serviceType: 'laboratory',
    priority: 'low',
    status: 'cancelled',
    createdAt: minutesAgo(112),
    roomId: 'room-305',
    etaMinutes: 0,
    notes: 'Отменён по запросу оператора.',
  },
]

export const mockEvents: QueueEvent[] = [
  createQueueEvent('queue_overloaded', 'Время ожидания регистрации превысило порог', {
    roomId: 'room-101',
  }),
  createQueueEvent('service_started', 'C-207 начал обслуживание в кабинете 203', {
    roomId: 'room-203',
    ticketId: 'ticket-104',
    ticketNumber: 'C-207',
    specialistId: 'user-specialist',
  }),
  createQueueEvent('ticket_called', 'R-124 вызван в кабинет 101', {
    roomId: 'room-101',
    ticketId: 'ticket-101',
    ticketNumber: 'R-124',
  }),
]

export const mockRecommendations: QueueRecommendation[] = [
  {
    id: 'rec-queue-101',
    message: 'Риск перегрузки регистрации',
    severity: 'critical',
    title: 'Высокая нагрузка на регистрацию',
    description: 'Кабинет 101 загружен выше 80%, при этом продолжают поступать приоритетные талоны.',
    action: 'Откройте резервное окно регистрации на ближайшие 30 минут.',
    relatedRoomId: 'room-101',
    createdAt: minutesAgo(6),
  },
  {
    id: 'rec-lab-305',
    message: 'Лаборатории нужна дополнительная мощность',
    severity: 'warning',
    title: 'Лабораторный кабинет на паузе',
    description: 'Три лабораторных талона могут превысить целевое время ожидания.',
    action: 'Переведите одного специалиста с диагностики на лабораторный приём.',
    relatedRoomId: 'room-305',
    createdAt: minutesAgo(11),
  },
  {
    id: 'rec-flow',
    message: 'Поток консультаций стабилен',
    severity: 'info',
    title: 'Поток консультаций стабилен',
    description: 'Темп завершения консультаций достаточен для следующей волны пациентов.',
    action: 'Сохраните текущее распределение кабинетов.',
    relatedRoomId: 'room-203',
    createdAt: minutesAgo(14),
  },
]

export const mockAnalytics: AnalyticsPoint[] = [
  { label: '08:00', waiting: 12, completed: 8, avgWaitMinutes: 16 },
  { label: '09:00', waiting: 18, completed: 13, avgWaitMinutes: 21 },
  { label: '10:00', waiting: 24, completed: 17, avgWaitMinutes: 28 },
  { label: '11:00', waiting: 22, completed: 24, avgWaitMinutes: 25 },
  { label: '12:00', waiting: 29, completed: 19, avgWaitMinutes: 34 },
  { label: '13:00', waiting: 26, completed: 21, avgWaitMinutes: 31 },
]

export function calculateQueueKpi(tickets: Ticket[], rooms: Room[]): QueueKpi {
  const activeTickets = tickets.filter(isActiveTicket).length
  const activeWait = tickets.filter((ticket) => ticket.status === 'waiting')
  const averageWaitMinutes = getAverageWaitingMinutes(activeWait) ?? 0

  return {
    activeTickets,
    averageWaitMinutes,
    completedToday: tickets.filter((ticket) => ticket.status === 'completed').length,
    overloadedRooms: rooms.filter((room) => room.loadPercent >= 75).length,
  }
}

export function createInitialQueueSnapshot(): QueueSnapshot {
  const tickets = deepClone(mockTickets)
  const rooms = deepClone(mockRooms)

  return {
    tickets,
    rooms,
    events: deepClone(mockEvents),
    recommendations: deepClone(mockRecommendations),
    analytics: deepClone(mockAnalytics),
    kpi: calculateQueueKpi(tickets, rooms),
  }
}
