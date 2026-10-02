import { mockUsers } from '@mock/auth.mock'
import type { TicketStatus } from '../../../types'
import type { TicketApi } from '../types'
import {
  createArchitectureTicket,
  getArchitectureTicketById,
  getArchitectureTickets,
  getMockServiceTypeOptions,
  getQueueSnapshot,
  getSharedTicketById,
  getSharedServiceTypeByOptionId,
  redirectSharedTicket,
  toArchitectureTicket,
  assertMockRoomAcceptsTickets,
  createSharedTicket,
  updateSharedTicketSettings,
  updateSharedTicketStatus,
} from './mockState'

function updateTicketStatus(id: string, status: TicketStatus) {
  return toArchitectureTicket(updateSharedTicketStatus(id, status))
}

export const mockTicketApi: TicketApi = {
  getTickets() {
    return Promise.resolve(getArchitectureTickets())
  },

  getTicketById(id: string) {
    return Promise.resolve(getArchitectureTicketById(id))
  },

  getTicketHistory(id: string) {
    return Promise.resolve(getSharedTicketById(id))
  },

  createTicket(input) {
    return Promise.resolve(createArchitectureTicket(input))
  },

  createKioskTicket(input) {
    return Promise.resolve(createArchitectureTicket(input))
  },

  arriveTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'waiting'))
  },

  callTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'called'))
  },

  startTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'in_service'))
  },

  completeTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'completed'))
  },

  cancelTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'cancelled'))
  },

  noShowTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'no_show'))
  },

  skipTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'no_show'))
  },

  returnTicket(id: string) {
    return Promise.resolve(updateTicketStatus(id, 'waiting'))
  },

  redirectTicket(id: string, newRoomId: string | number) {
    return Promise.resolve(toArchitectureTicket(redirectSharedTicket(id, newRoomId)))
  },

  updateTicketStatus(input) {
    return Promise.resolve(updateTicketStatus(input.ticketId, input.status))
  },

  createTicketWithSettings(payload) {
    assertMockRoomAcceptsTickets(payload.roomId)

    const ticket = createSharedTicket({
      patientName: 'Посетитель',
      priority: payload.priority,
      serviceType: payload.serviceType ?? getSharedServiceTypeByOptionId(payload.serviceTypeId),
      notes: payload.note ?? payload.comment,
    })
    const updatedTicket = updateSharedTicketSettings(ticket.id, payload)

    return Promise.resolve(updatedTicket)
  },

  getTicketSettingsOptions() {
    const snapshot = getQueueSnapshot()

    return Promise.resolve({
      rooms: snapshot.rooms.map((room) => ({
        active: room.active,
        id: room.id,
        isActive: room.isActive ?? room.status !== 'paused',
        isTicketIssueEnabled: room.isTicketIssueEnabled,
        kioskEnabled: room.kioskEnabled,
        name: room.name,
        number: room.number,
        placeType: room.placeType,
        serviceTypeIds: room.serviceTypeIds,
        serviceTypes: room.serviceTypes,
        services: room.services,
        ticketIssueEnabled: room.ticketIssueEnabled,
        workEndTime: room.workEndTime,
        workStartTime: room.workStartTime,
      })),
      serviceTypes: getMockServiceTypeOptions(),
      specialists: Object.values(mockUsers)
        .filter((user) => user.role === 'specialist')
        .map((user) => ({
          assignedRoomId: user.assignedRoomId,
          assignedRoomIds: user.assignedRoomIds,
          id: user.id,
          name: user.name,
          roomId: user.roomId,
          roomIds: user.roomIds,
          role: user.role,
        })),
    })
  },

  updateTicketSettings(id, payload) {
    updateSharedTicketSettings(id, payload)

    return Promise.resolve()
  },
}
