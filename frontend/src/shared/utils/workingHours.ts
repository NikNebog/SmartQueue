import type { QueueRecommendation, Room, Ticket, TicketStatus } from '@shared/types'
import { formatRoomName } from './room'
import { formatWaitingTime } from './time'

export const activeWorkloadStatuses = new Set<TicketStatus>([
  'created',
  'waiting',
  'called',
  'in_service',
  'redirected',
])

type WorkHoursSource = {
  workEndTime?: string | null
  workStartTime?: string | null
  workingEndTime?: string | null
  workingStartTime?: string | null
}

type QueueRiskOptions = {
  averageServiceMinutes?: number
  includeNextTicket?: boolean
  now?: Date | number
  queueDurationMinutes?: number
}

export type RoomWorkloadRisk = {
  activeWaitingCount: number
  isAtRisk: boolean
  isWorkingNow: boolean
  queueDurationMinutes: number
  remainingWorkMinutes?: number
  workEndTime?: string
  workStartTime?: string
}

function toDate(value: Date | number = new Date()): Date {
  return value instanceof Date ? value : new Date(value)
}

function getCurrentDayMinutes(now: Date | number = new Date()): number {
  const date = toDate(now)

  return date.getHours() * 60 + date.getMinutes()
}

function isWithinTimeRange(
  currentMinutes: number,
  startMinutes?: number,
  endMinutes?: number,
): boolean {
  if (startMinutes === undefined && endMinutes === undefined) {
    return true
  }

  if (startMinutes !== undefined && endMinutes !== undefined) {
    if (startMinutes === endMinutes) {
      return true
    }

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }

  if (startMinutes !== undefined) {
    return currentMinutes >= startMinutes
  }

  return endMinutes === undefined ? true : currentMinutes < endMinutes
}

export function normalizeWorkTime(value?: string | null): string | undefined {
  if (!value) {
    return undefined
  }

  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/)

  if (!match) {
    return undefined
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return undefined
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function parseWorkTimeMinutes(value?: string | null): number | undefined {
  const normalized = normalizeWorkTime(value)

  if (!normalized) {
    return undefined
  }

  const [hours, minutes] = normalized.split(':').map(Number)

  return hours * 60 + minutes
}

export function hasWorkHours(source?: WorkHoursSource | null): boolean {
  return Boolean(
    normalizeWorkTime(source?.workStartTime ?? source?.workingStartTime) ||
    normalizeWorkTime(source?.workEndTime ?? source?.workingEndTime),
  )
}

export function isWithinWorkHours(source?: WorkHoursSource | null, now: Date | number = new Date()): boolean {
  const startMinutes = parseWorkTimeMinutes(source?.workStartTime ?? source?.workingStartTime)
  const endMinutes = parseWorkTimeMinutes(source?.workEndTime ?? source?.workingEndTime)
  const currentMinutes = getCurrentDayMinutes(now)

  return isWithinTimeRange(currentMinutes, startMinutes, endMinutes)
}

export function isWithinTicketIssueHours(
  source?: WorkHoursSource | null,
  now: Date | number = new Date(),
  openingLeadMinutes = 60,
): boolean {
  const startMinutes = parseWorkTimeMinutes(source?.workStartTime ?? source?.workingStartTime)
  const endMinutes = parseWorkTimeMinutes(source?.workEndTime ?? source?.workingEndTime)
  const currentMinutes = getCurrentDayMinutes(now)
  const adjustedStartMinutes = startMinutes === undefined
    ? undefined
    : (startMinutes - openingLeadMinutes + (24 * 60)) % (24 * 60)

  return isWithinTimeRange(currentMinutes, adjustedStartMinutes, endMinutes)
}

export function getRemainingWorkMinutes(source?: WorkHoursSource | null, now: Date | number = new Date()): number | undefined {
  const endMinutes = parseWorkTimeMinutes(source?.workEndTime ?? source?.workingEndTime)

  if (endMinutes === undefined) {
    return undefined
  }

  const startMinutes = parseWorkTimeMinutes(source?.workStartTime ?? source?.workingStartTime)
  const currentMinutes = getCurrentDayMinutes(now)

  if (startMinutes !== undefined && startMinutes === endMinutes) {
    return 24 * 60
  }

  if (startMinutes !== undefined && startMinutes > endMinutes) {
    if (currentMinutes >= startMinutes) {
      return (24 * 60 - currentMinutes) + endMinutes
    }

    if (currentMinutes < endMinutes) {
      return endMinutes - currentMinutes
    }

    return 0
  }

  return Math.max(0, endMinutes - currentMinutes)
}

export function getActiveTicketsForRoom(roomId: string | number, tickets: Ticket[]): Ticket[] {
  const normalizedRoomId = String(roomId)

  return tickets.filter((ticket) =>
    String(ticket.roomId ?? '') === normalizedRoomId && activeWorkloadStatuses.has(ticket.status),
  )
}

export function getRoomWorkloadRisk(
  room: Room | (WorkHoursSource & { id: string | number }),
  tickets: Ticket[],
  options: QueueRiskOptions = {},
): RoomWorkloadRisk {
  const averageServiceMinutes = Math.max(1, Math.round(options.averageServiceMinutes ?? 10))
  const activeTickets = getActiveTicketsForRoom(room.id, tickets)
  const activeWaitingCount = activeTickets.length + (options.includeNextTicket ? 1 : 0)
  const queueDurationMinutes = Math.max(
    0,
    Math.round(options.queueDurationMinutes ?? activeWaitingCount * averageServiceMinutes),
  )
  const remainingWorkMinutes = getRemainingWorkMinutes(room, options.now)
  const isWorkingNow = isWithinWorkHours(room, options.now)

  return {
    activeWaitingCount,
    isAtRisk: isWorkingNow && remainingWorkMinutes !== undefined && queueDurationMinutes > remainingWorkMinutes,
    isWorkingNow,
    queueDurationMinutes,
    remainingWorkMinutes,
    workEndTime: normalizeWorkTime(room.workEndTime ?? room.workingEndTime),
    workStartTime: normalizeWorkTime(room.workStartTime ?? room.workingStartTime),
  }
}

export function createRoomWorkTimeRecommendation(
  room: Room,
  tickets: Ticket[],
  options: QueueRiskOptions = {},
): QueueRecommendation | undefined {
  const risk = getRoomWorkloadRisk(room, tickets, options)

  if (!risk.isAtRisk || risk.activeWaitingCount === 0) {
    return undefined
  }

  const roomName = formatRoomName(room)

  return {
    action: 'Рекомендуется закрыть выдачу талонов.',
    createdAt: new Date().toISOString(),
    description: `Пациентов в очереди: ${risk.activeWaitingCount}. Очередь займёт ${formatWaitingTime(risk.queueDurationMinutes)}, до закрытия осталось ${formatWaitingTime(risk.remainingWorkMinutes)}.`,
    id: `room-${room.id}-worktime-risk`,
    isResolved: false,
    message: `${roomName} не успевает обслужить очередь до конца рабочего времени. Рекомендуется закрыть выдачу талонов.`,
    relatedRoomId: room.id,
    relatedRoomName: roomName,
    severity: 'warning',
    title: 'Очередь не успевает до закрытия',
  }
}
