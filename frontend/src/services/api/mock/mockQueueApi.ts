import { getRoomBoardId, roomMatchesIdentifier } from '@shared/utils'
import type { QueueApi } from '../types'
import {
  callNextSharedTicket,
  createSharedTicket,
  getArchitectureQueueByRoom,
  getArchitectureRooms,
  getArchitectureTickets,
  getHighPriorityArchitectureTickets,
  getNextSharedTicket,
  getOverloadRooms,
  getQueueSnapshot,
  getRoomQueueStats,
  getQueueStats,
  redirectSharedTicket,
  replaceArchitectureQueue,
  resolveMockRecommendation,
  toArchitectureTicket,
  updateSharedTicketStatus,
} from './mockState'

export const mockQueueApi: QueueApi = {
  getQueueSnapshot() {
    return Promise.resolve(getQueueSnapshot())
  },

  getBoardSnapshot(roomId?: string | number) {
    const snapshot = getQueueSnapshot()

    if (!roomId) {
      return Promise.resolve(snapshot)
    }

    const roomIdValue = String(roomId)
    const rooms = snapshot.rooms.filter((room) => (
      room.id === roomIdValue ||
      roomMatchesIdentifier(room, roomIdValue) ||
      getRoomBoardId(room) === roomIdValue
    ))
    const roomIds = new Set(rooms.map((room) => room.id))

    return Promise.resolve({
      ...snapshot,
      rooms,
      tickets: snapshot.tickets.filter((ticket) => (
        ticket.roomId !== undefined && roomIds.has(ticket.roomId)
      ) || roomMatchesIdentifier({ id: ticket.roomId, name: ticket.roomName }, roomIdValue)
        || getRoomBoardId({ id: ticket.roomId, name: ticket.roomName }) === roomIdValue),
    })
  },

  getPeriodAnalytics() {
    return Promise.resolve(getQueueSnapshot().analytics)
  },

  getRoomQueueSnapshot(roomId: string | number) {
    const snapshot = getQueueSnapshot()
    const roomIdValue = String(roomId)

    return Promise.resolve({
      ...snapshot,
      rooms: snapshot.rooms.filter((room) => room.id === roomIdValue),
      tickets: snapshot.tickets.filter((ticket) =>
        ticket.roomId === roomIdValue &&
        ['waiting', 'called', 'in_service', 'redirected'].includes(ticket.status),
      ),
    })
  },

  getRoomNoShowTickets(roomId: string | number) {
    const roomIdValue = String(roomId)

    return Promise.resolve(
      getQueueSnapshot().tickets.filter((ticket) =>
        ticket.roomId === roomIdValue &&
        ticket.status === 'no_show',
      ),
    )
  },

  getRoomPostponedTickets(roomId: string | number) {
    const roomIdValue = String(roomId)

    return Promise.resolve(
      getQueueSnapshot().tickets.filter((ticket) =>
        ticket.roomId === roomIdValue &&
        ticket.status === 'postponed',
      ),
    )
  },

  createTicket(input) {
    createSharedTicket(input)

    return Promise.resolve(getQueueSnapshot())
  },

  createKioskTicket(input) {
    createSharedTicket(input)

    return Promise.resolve(getQueueSnapshot())
  },

  callNextTicket(roomId: string) {
    callNextSharedTicket(roomId)

    return Promise.resolve(getQueueSnapshot())
  },

  startService(ticketId: string) {
    updateSharedTicketStatus(ticketId, 'in_service')

    return Promise.resolve(getQueueSnapshot())
  },

  completeService(ticketId: string) {
    updateSharedTicketStatus(ticketId, 'completed')

    return Promise.resolve(getQueueSnapshot())
  },

  postponeTicket(ticketId: string) {
    updateSharedTicketStatus(ticketId, 'postponed')

    return Promise.resolve(getQueueSnapshot())
  },

  skipTicket(ticketId: string) {
    updateSharedTicketStatus(ticketId, 'no_show')

    return Promise.resolve(getQueueSnapshot())
  },

  returnTicket(ticketId: string) {
    updateSharedTicketStatus(ticketId, 'waiting')

    return Promise.resolve(getQueueSnapshot())
  },

  redirectTicket(input) {
    redirectSharedTicket(input.ticketId, input.roomId, input.serviceTypeId)

    return Promise.resolve(getQueueSnapshot())
  },

  recalculateRoom() {
    return Promise.resolve(getQueueSnapshot())
  },

  resolveRecommendation(id: string) {
    return Promise.resolve(resolveMockRecommendation(id))
  },

  getStats() {
    return Promise.resolve(getQueueStats())
  },

  getRoomStats() {
    return Promise.resolve(getRoomQueueStats())
  },

  getQueueByRoom(roomId: string | number) {
    return Promise.resolve(getArchitectureQueueByRoom(roomId))
  },

  getNextTicket(roomId: string | number) {
    const ticket = getNextSharedTicket(roomId)

    return Promise.resolve(ticket ? toArchitectureTicket(ticket) : undefined)
  },

  getHighPriority() {
    return Promise.resolve(getHighPriorityArchitectureTickets())
  },

  checkOverload() {
    return Promise.resolve(getOverloadRooms())
  },

  getQueue() {
    return Promise.resolve(getArchitectureTickets())
  },

  getRooms() {
    return Promise.resolve(getArchitectureRooms())
  },

  subscribeQueue(listener) {
    let active = true

    Promise.resolve(getArchitectureTickets()).then((tickets) => {
      if (active) {
        listener(tickets)
      }
    })

    return () => {
      active = false
    }
  },

  replaceQueue(nextTickets) {
    replaceArchitectureQueue(nextTickets)
  },
}
