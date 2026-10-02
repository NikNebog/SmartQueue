import type { KioskApi } from '../types'
import {
  createSharedTicket,
  getSharedServiceTypeByOptionId,
} from './mockState'

export const mockKioskApi: KioskApi = {
  createTicket(input) {
    return Promise.resolve(createSharedTicket(input))
  },

  createTicketForKiosk(input) {
    return Promise.resolve(createSharedTicket({
      patientName: 'Посетитель',
      language: input.language,
      priority: input.priority,
      roomId: input.roomId,
      serviceType: input.serviceType ?? getSharedServiceTypeByOptionId(input.serviceTypeId),
    }))
  },
}
