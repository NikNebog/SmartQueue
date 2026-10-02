import {
  toBackendPriority,
  toBackendTicketCreateInput,
  toSharedTicket,
  type BackendTicket,
} from '../backendAdapters'
import { publicApiClient } from '../client'
import type { KioskApi } from '../types'

type TicketCreateBody = {
  language?: string
  priority: number
  roomId?: number
  serviceTypeId: number | string
}

async function arriveCreatedTicket(ticket: BackendTicket): Promise<BackendTicket> {
  if (ticket.status !== 'created') {
    return ticket
  }

  try {
    const response = await publicApiClient.post<BackendTicket>(`/tickets/${ticket.id}/arrive`)

    return response.data ?? ticket
  } catch (error) {
    console.warn('backendKioskApi: public POST /tickets/:id/arrive is not available', error)

    return ticket
  }
}

function withoutRoomId(payload: TicketCreateBody) {
  return {
    priority: payload.priority,
    serviceTypeId: payload.serviceTypeId,
  }
}

function withoutLanguage(payload: TicketCreateBody): TicketCreateBody {
  return {
    priority: payload.priority,
    ...(payload.roomId !== undefined ? { roomId: payload.roomId } : {}),
    serviceTypeId: payload.serviceTypeId,
  }
}

async function createBackendTicket(path: string, payload: TicketCreateBody): Promise<BackendTicket> {
  try {
    const response = await publicApiClient.post<BackendTicket>(path, payload)

    return response.data
  } catch (error) {
    if (payload.language) {
      try {
        const response = await publicApiClient.post<BackendTicket>(path, withoutLanguage(payload))

        return response.data
      } catch (languageFallbackError) {
        console.warn('backendKioskApi: POST /tickets/kiosk with language failed, retrying fallback', languageFallbackError)
      }
    }

    if (payload.roomId === undefined) {
      throw error
    }

    console.warn('backendKioskApi: POST /tickets with roomId failed, retrying without roomId', error)
    const response = await publicApiClient.post<BackendTicket>(path, withoutRoomId(payload))

    try {
      const patchResponse = await publicApiClient.patch<BackendTicket>(`/tickets/${response.data.id}`, {
        roomId: payload.roomId,
      })

      return patchResponse.data ?? response.data
    } catch (patchError) {
      console.warn('backendKioskApi: PATCH /tickets/:id roomId fallback failed', patchError)

      return response.data
    }
  }
}

export const backendKioskApi: KioskApi = {
  async createTicket(input) {
    const createdTicket = await createBackendTicket(
      '/tickets/kiosk',
      toBackendTicketCreateInput(input),
    )
    const ticket = await arriveCreatedTicket(createdTicket)

    return {
      ...toSharedTicket(ticket),
      language: input.language ?? toSharedTicket(ticket).language,
    }
  },

  async createTicketForKiosk(input) {
    const roomId = Number(input.roomId)
    const serviceTypeId = Number(input.serviceTypeId)
    const createdTicket = await createBackendTicket('/tickets/kiosk', {
      priority: toBackendPriority(input.priority),
      ...(input.language ? { language: input.language } : {}),
      ...(Number.isFinite(roomId) ? { roomId } : {}),
      serviceTypeId: Number.isFinite(serviceTypeId) ? serviceTypeId : input.serviceTypeId,
    })
    const ticket = await arriveCreatedTicket(createdTicket)

    return {
      ...toSharedTicket(ticket),
      language: input.language ?? toSharedTicket(ticket).language,
    }
  },
}
