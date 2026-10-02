import { queueApi, toServiceError } from './api'
import type { Ticket, TicketPriority, TicketStatus } from '@shared/types'
import { formatRoomName } from '@shared/utils'

export type Visit = {
  id: string
  time: string
  timestamp: number
  patient: string
  ticket: string
  service: string
  room?: string
  status: TicketStatus
  priority: TicketPriority
  eta?: number
}

export type VisitFilters = {
  roomId?: string | number
  roomIds?: Array<string | number>
  userId?: string | number
}

const visibleVisitStatuses: TicketStatus[] = ['completed', 'no_show', 'cancelled', 'redirected', 'postponed']

function getVisitTimestamp(ticket: Ticket): number {
  const value = ticket.completedAt ?? ticket.startedAt ?? ticket.calledAt ?? ticket.updatedAt ?? ticket.createdAt
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

function isToday(timestamp: number): boolean {
  const date = new Date(timestamp)
  const today = new Date()

  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

function formatVisitTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function matchesVisitFilters(ticket: Ticket, filters: VisitFilters): boolean {
  const filterRoomIds = filters.roomIds?.length ? filters.roomIds : filters.roomId ? [filters.roomId] : []
  const roomMatches = filterRoomIds.length > 0 && ticket.roomId !== undefined
    ? filterRoomIds.map(String).includes(String(ticket.roomId))
    : false
  const userMatches = filters.userId ? String(ticket.assignedTo) === String(filters.userId) : false

  if (filterRoomIds.length === 0 && !filters.userId) {
    return true
  }

  return roomMatches || userMatches
}

function ticketToVisit(ticket: Ticket): Visit {
  const timestamp = getVisitTimestamp(ticket)

  return {
    id: ticket.id,
    time: formatVisitTime(timestamp),
    timestamp,
    patient: ticket.patientName || `Пациент ${ticket.number}`,
    ticket: ticket.number,
    service: ticket.serviceType,
    room: formatRoomName({ id: ticket.roomId, name: ticket.roomName }),
    status: ticket.status,
    priority: ticket.priority,
    eta: ticket.etaMinutes,
  }
}

export const visitService = {
  async getTodayVisits(filters: VisitFilters = {}): Promise<Visit[]> {
    try {
      const snapshot = await queueApi.getQueueSnapshot()

      return snapshot.tickets
        .filter((ticket) => visibleVisitStatuses.includes(ticket.status))
        .filter((ticket) => matchesVisitFilters(ticket, filters))
        .map(ticketToVisit)
        .filter((visit) => isToday(visit.timestamp))
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 100)
    } catch (error) {
      console.error('visitService.getTodayVisits failed', error)
      throw toServiceError(error, 'Не удалось получить историю посещений')
    }
  },
}
