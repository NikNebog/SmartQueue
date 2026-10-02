import type { AnalyticsPeriod, AnalyticsPoint, Ticket } from '@shared/types'
import { getWaitingMinutes } from '@shared/utils'

export type AnalyticsTicketFilters = {
  dateFrom?: string
  dateTo?: string
  serviceTypeId?: string
}

export const analyticsPeriodLabels: Record<AnalyticsPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
}

const activeQueueStatuses = new Set(['created', 'waiting', 'called', 'in_service', 'redirected'])

function parseTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getPeriodStart(period: AnalyticsPeriod, now: number): number {
  const date = new Date(now)

  date.setHours(0, 0, 0, 0)

  if (period === 'week') {
    const day = date.getDay() || 7
    date.setDate(date.getDate() - day + 1)
  }

  if (period === 'month') {
    date.setDate(1)
  }

  return date.getTime()
}

function getTicketTimestamps(ticket: Ticket): number[] {
  return [ticket.createdAt, ticket.calledAt, ticket.startedAt, ticket.completedAt, ticket.updatedAt]
    .map(parseTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== undefined)
}

function getTicketPeriodTimestamp(ticket: Ticket): number | undefined {
  return parseTimestamp(ticket.completedAt)
    ?? parseTimestamp(ticket.calledAt)
    ?? parseTimestamp(ticket.updatedAt)
    ?? parseTimestamp(ticket.createdAt)
}

function isTicketInPeriod(ticket: Ticket, period: AnalyticsPeriod, now: number): boolean {
  const start = getPeriodStart(period, now)

  return getTicketTimestamps(ticket).some((timestamp) => timestamp >= start && timestamp <= now)
}

function getPointLabel(timestamp: number, period: AnalyticsPeriod): string {
  const date = new Date(timestamp)

  if (period === 'day') {
    return `${String(date.getHours()).padStart(2, '0')}:00`
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function getAverage(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function getLocalDateStart(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = new Date(`${value}T00:00:00`).getTime()

  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getLocalDateEnd(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = new Date(`${value}T23:59:59.999`).getTime()

  return Number.isFinite(timestamp) ? timestamp : undefined
}

function isTicketInDateRange(ticket: Ticket, filters: AnalyticsTicketFilters): boolean {
  const from = getLocalDateStart(filters.dateFrom)
  const to = getLocalDateEnd(filters.dateTo)
  const timestamps = getTicketTimestamps(ticket)

  if (timestamps.length === 0) {
    return false
  }

  return timestamps.some((timestamp) => (
    (from === undefined || timestamp >= from) &&
    (to === undefined || timestamp <= to)
  ))
}

function isTicketForService(ticket: Ticket, serviceTypeId?: string): boolean {
  if (!serviceTypeId) {
    return true
  }

  return String(ticket.serviceTypeId ?? '') === serviceTypeId || ticket.serviceType === serviceTypeId
}

function getRangePointLabel(timestamp: number, filters: AnalyticsTicketFilters): string {
  const date = new Date(timestamp)

  if (filters.dateFrom === filters.dateTo) {
    return `${String(date.getHours()).padStart(2, '0')}:00`
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function getServiceMinutes(ticket: Ticket): number | null {
  const startedAt = parseTimestamp(ticket.serviceStartedAt ?? ticket.startedAt)
  const completedAt = parseTimestamp(ticket.completedAt)

  if (ticket.status !== 'completed' || startedAt === undefined || completedAt === undefined || completedAt < startedAt) {
    return null
  }

  return Math.round((completedAt - startedAt) / 60_000)
}

export function getTicketsForAnalyticsPeriod(
  tickets: Ticket[],
  period: AnalyticsPeriod,
  now: number,
): Ticket[] {
  return tickets.filter((ticket) => isTicketInPeriod(ticket, period, now))
}

export function getTicketsForAnalyticsFilters(
  tickets: Ticket[],
  filters: AnalyticsTicketFilters,
): Ticket[] {
  return tickets.filter((ticket) => (
    isTicketInDateRange(ticket, filters) &&
    isTicketForService(ticket, filters.serviceTypeId)
  ))
}

export function createPeriodAnalyticsFromTickets(
  tickets: Ticket[],
  period: AnalyticsPeriod,
  now: number,
): AnalyticsPoint[] {
  const periodTickets = getTicketsForAnalyticsPeriod(tickets, period, now)
  const groupedTickets = new Map<string, Ticket[]>()

  periodTickets.forEach((ticket) => {
    const timestamp = getTicketPeriodTimestamp(ticket)

    if (timestamp === undefined) {
      return
    }

    const label = getPointLabel(timestamp, period)

    groupedTickets.set(label, [...(groupedTickets.get(label) ?? []), ticket])
  })

  return Array.from(groupedTickets.entries())
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel, 'ru'))
    .map(([label, groupTickets]) => {
      const waitingMinutes = groupTickets
        .map((ticket) => getWaitingMinutes(ticket, now))
        .filter((minutes): minutes is number => minutes !== null)
      const serviceMinutes = groupTickets
        .map(getServiceMinutes)
        .filter((minutes): minutes is number => minutes !== null)

      return {
        avgServiceMinutes: serviceMinutes.length > 0 ? getAverage(serviceMinutes) : undefined,
        avgWaitMinutes: getAverage(waitingMinutes),
        completed: groupTickets.filter((ticket) => ticket.status === 'completed').length,
        label,
        noShow: groupTickets.filter((ticket) => ticket.status === 'no_show').length,
        waiting: groupTickets.filter((ticket) => activeQueueStatuses.has(ticket.status)).length,
      }
    })
}

export function createFilteredAnalyticsFromTickets(
  tickets: Ticket[],
  filters: AnalyticsTicketFilters,
  now: number,
): AnalyticsPoint[] {
  const filteredTickets = getTicketsForAnalyticsFilters(tickets, filters)
  const groupedTickets = new Map<string, Ticket[]>()

  filteredTickets.forEach((ticket) => {
    const timestamp = getTicketPeriodTimestamp(ticket)

    if (timestamp === undefined) {
      return
    }

    const label = getRangePointLabel(timestamp, filters)

    groupedTickets.set(label, [...(groupedTickets.get(label) ?? []), ticket])
  })

  return Array.from(groupedTickets.entries())
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel, 'ru'))
    .map(([label, groupTickets]) => {
      const waitingMinutes = groupTickets
        .map((ticket) => getWaitingMinutes(ticket, now))
        .filter((minutes): minutes is number => minutes !== null)
      const serviceMinutes = groupTickets
        .map(getServiceMinutes)
        .filter((minutes): minutes is number => minutes !== null)

      return {
        avgServiceMinutes: serviceMinutes.length > 0 ? getAverage(serviceMinutes) : undefined,
        avgWaitMinutes: getAverage(waitingMinutes),
        completed: groupTickets.filter((ticket) => ticket.status === 'completed').length,
        label,
        noShow: groupTickets.filter((ticket) => ticket.status === 'no_show').length,
        waiting: groupTickets.filter((ticket) => activeQueueStatuses.has(ticket.status)).length,
      }
    })
}
