import type { Ticket, TicketStatus } from '@shared/types'
import { getLocale, type SmartQLanguage } from '@shared/locales/useLocale'

const queueAheadStatuses = new Set<TicketStatus>(['waiting', 'called', 'in_service', 'redirected'])

function normalizeQueueCount(value?: number | string | null): number | undefined {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN

  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined
}

export function getRoomQueuePeopleAhead(
  roomId?: string | number,
  tickets: Array<{ roomId?: string | number; status: TicketStatus }> = [],
): number {
  if (roomId === undefined || roomId === null || roomId === '') {
    return 0
  }

  const normalizedRoomId = String(roomId)

  return tickets.filter((ticket) =>
    String(ticket.roomId ?? '') === normalizedRoomId && queueAheadStatuses.has(ticket.status),
  ).length
}

export function getTicketPeopleAhead(ticket?: Pick<Ticket, 'peopleAhead' | 'queuePosition'> | null, fallback = 0): number {
  const peopleAhead = normalizeQueueCount(ticket?.peopleAhead)

  if (peopleAhead !== undefined) {
    return peopleAhead
  }

  const queuePosition = normalizeQueueCount(ticket?.queuePosition)

  if (queuePosition !== undefined) {
    return Math.max(0, queuePosition - 1)
  }

  return Math.max(0, Math.floor(fallback))
}

export function formatPeopleAhead(value: number, language?: SmartQLanguage): string {
  const count = Math.max(0, Math.floor(value))

  return getLocale(language).ticketPrint.peopleAhead.replace('{{count}}', String(count))
}
