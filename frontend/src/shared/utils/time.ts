type TicketWaitingSource = {
  calledAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
  hasActualCreatedAt?: boolean | null
  serviceStartedAt?: string | null
  startedAt?: string | null
  status?: string | null
}

const activeWaitingStatuses = new Set(['created', 'waiting', 'called', 'in_service', 'redirected'])

function parseTimestamp(value?: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : undefined
}

export function isTicketCreatedToday(
  ticket: Pick<TicketWaitingSource, 'createdAt' | 'hasActualCreatedAt'>,
  now: number | Date = Date.now(),
): boolean {
  if (ticket.hasActualCreatedAt === false) {
    return false
  }

  const createdAt = parseTimestamp(ticket.createdAt)

  if (createdAt === undefined) {
    return false
  }

  const createdDate = new Date(createdAt)
  const currentDate = typeof now === 'number' ? new Date(now) : now

  if (!Number.isFinite(currentDate.getTime())) {
    return false
  }

  return createdDate.getFullYear() === currentDate.getFullYear()
    && createdDate.getMonth() === currentDate.getMonth()
    && createdDate.getDate() === currentDate.getDate()
}

export function getWaitingMinutes(
  ticket: TicketWaitingSource,
  now: number | Date = Date.now(),
): number | null {
  if (ticket.hasActualCreatedAt === false) {
    return null
  }

  const createdAt = parseTimestamp(ticket.createdAt)

  if (createdAt === undefined) {
    return null
  }

  const nowTime = typeof now === 'number' ? now : now.getTime()
  const calledAt = parseTimestamp(ticket.calledAt)

  if (calledAt !== undefined) {
    return Math.max(0, Math.floor((calledAt - createdAt) / 60_000))
  }

  if (!activeWaitingStatuses.has(ticket.status ?? '')) {
    return null
  }

  return Math.max(0, Math.floor((nowTime - createdAt) / 60_000))
}

export function formatWaitingTime(minutes?: number | null): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return 'Нет данных'
  }

  const roundedMinutes = Math.max(0, Math.floor(minutes))

  if (roundedMinutes < 1) {
    return 'меньше минуты'
  }

  if (roundedMinutes < 60) {
    return `${roundedMinutes} мин`
  }

  const hours = Math.floor(roundedMinutes / 60)
  const restMinutes = roundedMinutes % 60

  return restMinutes > 0 ? `${hours} ч ${restMinutes} мин` : `${hours} ч`
}

export function getAverageWaitingMinutes(
  tickets: TicketWaitingSource[],
  now: number | Date = Date.now(),
): number | null {
  const waitingTimes = tickets
    .map((ticket) => getWaitingMinutes(ticket, now))
    .filter((minutes): minutes is number => minutes !== null)

  if (waitingTimes.length === 0) {
    return null
  }

  const total = waitingTimes.reduce((sum, minutes) => sum + minutes, 0)

  return Math.round(total / waitingTimes.length)
}
