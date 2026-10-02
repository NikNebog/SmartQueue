import type { ServiceType, Ticket } from '@shared/types'

export const fallbackServiceDurationMinutes = 10

type ServiceDurationStats = {
  averageMinutes: number
  hasData: boolean
  samples: number
}

function normalizeId(value?: string | number | null): string {
  return value == null ? '' : String(value)
}

function parseTimestamp(value?: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getTicketServiceStart(ticket: Ticket): string | undefined {
  const record = ticket as Ticket & { serviceStartedAt?: string }

  return record.serviceStartedAt ?? ticket.startedAt
}

function getCompletedServiceMinutes(ticket: Ticket): number | undefined {
  if (ticket.status !== 'completed') {
    return undefined
  }

  const startedAt = parseTimestamp(getTicketServiceStart(ticket))
  const completedAt = parseTimestamp(ticket.completedAt)

  if (startedAt === undefined || completedAt === undefined || completedAt <= startedAt) {
    return undefined
  }

  return Math.max(1, Math.round((completedAt - startedAt) / 60_000))
}

function matchesService(ticket: Ticket, serviceTypeId?: string | number, serviceType?: ServiceType): boolean {
  const normalizedServiceTypeId = normalizeId(serviceTypeId)

  if (normalizedServiceTypeId && normalizeId(ticket.serviceTypeId) === normalizedServiceTypeId) {
    return true
  }

  return Boolean(serviceType && ticket.serviceType === serviceType)
}

function getAverage(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined
  }

  return Math.max(1, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length))
}

export function getAverageServiceDurationStats(
  tickets: Ticket[],
  serviceTypeId?: string | number,
  serviceType?: ServiceType,
): ServiceDurationStats {
  const durations = tickets
    .filter((ticket) => matchesService(ticket, serviceTypeId, serviceType))
    .map(getCompletedServiceMinutes)
    .filter((minutes): minutes is number => minutes !== undefined)
  const averageMinutes = getAverage(durations)

  return {
    averageMinutes: averageMinutes ?? fallbackServiceDurationMinutes,
    hasData: averageMinutes !== undefined,
    samples: durations.length,
  }
}

export function getAverageServiceMinutesForTicket(tickets: Ticket[], ticket: Ticket): number {
  return getAverageServiceDurationStats(tickets, ticket.serviceTypeId, ticket.serviceType).averageMinutes
}

export function getQueueServiceDurationMinutes(activeTickets: Ticket[], allTickets: Ticket[]): number {
  return activeTickets.reduce(
    (sum, ticket) => sum + getAverageServiceMinutesForTicket(allTickets, ticket),
    0,
  )
}
