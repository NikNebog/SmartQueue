import type { ServiceType as SharedServiceType, TicketPriority } from '@shared/types'
import { isWithinTicketIssueHours } from '@shared/utils'
import { useGlobalStore } from '@store/global'
import type { TicketStatus } from '../../../types'
import {
  toArchitectureTicket,
  toArchitectureTickets,
  toBackendArchitectureTicketCreateInput,
  toBackendPriority,
  toSharedTicket,
  type BackendTicket,
} from '../backendAdapters'
import { apiClient, publicApiClient } from '../client'
import type {
  TicketApi,
  TicketSettingsOptions,
  TicketSettingsPayload,
  TicketSettingsServiceTypeOption,
  TicketSettingsUserOption,
} from '../types'
import { requestTicketReturn } from './ticketReturnFallback'

type BackendRoomOption = {
  _id?: string | number
  active?: boolean
  id: string | number
  isActive?: boolean
  isTicketIssueEnabled?: boolean
  kioskEnabled?: boolean
  name?: string
  number?: string | number
  place_type?: string
  placeType?: string
  roomId?: string | number
  roomName?: string
  serviceTypeId?: string | number
  serviceTypeIds?: Array<string | number>
  serviceTypes?: Array<string | number | { id?: string | number; name?: string; serviceTypeId?: string | number; title?: string }>
  services?: Array<string | number | { id?: string | number; name?: string; serviceTypeId?: string | number; title?: string }>
  status?: string
  ticketIssueEnabled?: boolean
  title?: string
  workEndTime?: string
  workStartTime?: string
  work_end_time?: string
  work_start_time?: string
  workingEndTime?: string
  workingStartTime?: string
}

type BackendServiceTypeOption = {
  active?: boolean
  averageDurationMinutes?: number
  average_duration_minutes?: number
  avgServiceMinutes?: number
  code?: string
  durationMinutes?: number
  enabled?: boolean
  id: string | number
  isActive?: boolean
  name?: string
  nameEn?: string
  name_en?: string
  nameKk?: string
  name_kk?: string
  priorityWeight?: number
  priority_weight?: number
  ticketPrefix?: string
  translations?: TicketSettingsServiceTypeOption['translations']
  weight?: number
}

type BackendUserOption = {
  assignedRoomId?: string | number
  assignedRoomIds?: Array<string | number>
  assignedRooms?: Array<{ _id?: string | number; id?: string | number; roomId?: string | number }>
  id: string | number
  name?: string
  roomId?: string | number
  roomIds?: Array<string | number>
  rooms?: Array<{ _id?: string | number; id?: string | number; roomId?: string | number }>
  role?: TicketSettingsUserOption['role']
  fullName?: string
}

const serviceCodeByBackendName: Record<string, SharedServiceType> = {
  analysis: 'laboratory',
  billing: 'billing',
  consultation: 'consultation',
  diagnostics: 'diagnostics',
  laboratory: 'laboratory',
  other: 'registration',
  payment: 'billing',
  pharmacy: 'pharmacy',
  registration: 'registration',
  xray: 'diagnostics',
  анализы: 'laboratory',
  аптека: 'pharmacy',
  вакцинация: 'consultation',
  'забор крови': 'laboratory',
  диагностика: 'diagnostics',
  другое: 'registration',
  'консультация кардиолога': 'consultation',
  'консультация невролога': 'consultation',
  'консультация педиатра': 'consultation',
  'консультация терапевта': 'consultation',
  'консультация хирурга': 'consultation',
  консультация: 'consultation',
  кт: 'diagnostics',
  лаборатория: 'laboratory',
  'лабораторные анализы': 'laboratory',
  мрт: 'diagnostics',
  оплата: 'billing',
  'оплата услуг': 'billing',
  'получение справки': 'registration',
  'приём документов': 'registration',
  'процедурный кабинет': 'consultation',
  регистрация: 'registration',
  рентген: 'diagnostics',
  узи: 'diagnostics',
  экг: 'diagnostics',
}

type TicketCreateBody = {
  doctorId?: number
  language?: string
  note?: string
  priority: number
  roomId?: number
  serviceTypeId: number | string
}

async function postTicketAction(id: string, action: string) {
  const response = await apiClient.post<BackendTicket>(`/tickets/${id}/${action}`)

  return toArchitectureTicket(response.data)
}

function withoutRoomId(payload: TicketCreateBody) {
  return {
    priority: payload.priority,
    serviceTypeId: payload.serviceTypeId,
  }
}

function withoutOptionalCreateFields(payload: TicketCreateBody): TicketCreateBody {
  return {
    priority: payload.priority,
    ...(payload.roomId !== undefined ? { roomId: payload.roomId } : {}),
    serviceTypeId: payload.serviceTypeId,
  }
}

function hasOptionalCreateFields(payload: TicketCreateBody): boolean {
  return payload.doctorId !== undefined || payload.note !== undefined || payload.language !== undefined
}

async function createBackendTicket(
  path: string,
  payload: TicketCreateBody,
  client = apiClient,
): Promise<BackendTicket> {
  try {
    const response = await client.post<BackendTicket>(path, payload)

    return response.data
  } catch (error) {
    if (hasOptionalCreateFields(payload)) {
      try {
        const response = await client.post<BackendTicket>(path, withoutOptionalCreateFields(payload))

        return response.data
      } catch (fallbackError) {
        if (payload.roomId === undefined) {
          throw fallbackError
        }

        console.warn('backendTicketApi: POST /tickets with optional fields failed, retrying without roomId', fallbackError)
      }
    } else if (payload.roomId === undefined) {
      throw error
    }

    console.warn('backendTicketApi: POST /tickets with roomId failed, retrying without roomId', error)
    const response = await client.post<BackendTicket>(path, withoutRoomId(payload))

    try {
      const patchResponse = await client.patch<BackendTicket>(`/tickets/${response.data.id}`, {
        roomId: payload.roomId,
      })

      return patchResponse.data ?? response.data
    } catch (patchError) {
      console.warn('backendTicketApi: PATCH /tickets/:id roomId fallback failed', patchError)

      return response.data
    }
  }
}

function isBackendRoomAcceptingTickets(room: BackendRoomOption): boolean {
  const issueEnabled = room.ticketIssueEnabled ?? room.isTicketIssueEnabled ?? room.kioskEnabled

  if (issueEnabled === false) {
    return false
  }

  return isWithinTicketIssueHours({
    workEndTime: room.workEndTime ?? room.workingEndTime ?? room.work_end_time,
    workStartTime: room.workStartTime ?? room.workingStartTime ?? room.work_start_time,
  }) && (room.isActive
    ?? room.active
    ?? (room.status !== 'paused' && room.status !== 'inactive' && room.status !== 'deleted'))
}

function getBackendRoomOptionActive(room: BackendRoomOption): boolean {
  return room.isActive
    ?? room.active
    ?? (room.status !== 'paused' && room.status !== 'inactive' && room.status !== 'deleted')
}

async function assertRoomAcceptsTickets(roomId?: string | number) {
  if (roomId === undefined) {
    return
  }

  const rooms = await getOrEmpty<BackendRoomOption>('/rooms')

  if (rooms.length === 0) {
    return
  }

  const room = rooms.find((item) => String(item.id ?? item.roomId ?? item._id) === String(roomId))

  if (!room || !isBackendRoomAcceptingTickets(room)) {
    throw new Error('Выдача талонов в это место обслуживания закрыта.')
  }
}

async function arriveCreatedTicketWithClient(
  ticket: BackendTicket,
  client = apiClient,
  optional = false,
): Promise<BackendTicket> {
  if (ticket.status !== 'created') {
    return ticket
  }

  try {
    const response = await client.post<BackendTicket>(`/tickets/${ticket.id}/arrive`)

    return response.data
  } catch (error) {
    if (optional) {
      console.warn('backendTicketApi: public POST /tickets/:id/arrive is not available', error)

      return ticket
    }

    throw error
  }
}

async function arriveCreatedTicket(ticket: BackendTicket): Promise<BackendTicket> {
  return arriveCreatedTicketWithClient(ticket)
}

function isSuppressedStatus(error: unknown, statuses: number[]): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const status = (error as { response?: { status?: number } }).response?.status

  return status !== undefined && statuses.includes(status)
}

async function getOrEmpty<T>(
  path: string,
  client = apiClient,
  suppressedStatuses: number[] = [],
): Promise<T[]> {
  try {
    const response = await client.get<unknown>(path)

    if (Array.isArray(response.data)) {
      return response.data as T[]
    }

    if (response.data && typeof response.data === 'object') {
      const record = response.data as Record<string, unknown>

      if (Array.isArray(record.data)) {
        return record.data as T[]
      }

      if (Array.isArray(record.rooms)) {
        return record.rooms as T[]
      }

      if (Array.isArray(record.users)) {
        return record.users as T[]
      }

      if (Array.isArray(record.staff)) {
        return record.staff as T[]
      }

      if (Array.isArray(record.serviceTypes)) {
        return record.serviceTypes as T[]
      }
    }

    return []
  } catch (error) {
    if (!isSuppressedStatus(error, suppressedStatuses)) {
      console.warn(`backendTicketApi: ${path} is not available yet`, error)
    }

    return []
  }
}

function toServiceCode(option: BackendServiceTypeOption): SharedServiceType {
  const rawCode = option.code ?? option.name ?? ''
  const normalized = rawCode.trim().toLowerCase()

  return serviceCodeByBackendName[normalized] ?? 'consultation'
}

function getPositiveNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined
}

function toSettingsOptions(
  rooms: BackendRoomOption[],
  serviceTypes: BackendServiceTypeOption[],
  users: BackendUserOption[],
): TicketSettingsOptions {
  const getUserRoomIds = (user: BackendUserOption) => Array.from(new Set([
    user.roomId,
    user.assignedRoomId,
    ...(user.roomIds ?? []),
    ...(user.assignedRoomIds ?? []),
    ...(user.rooms ?? []).map((room) => room.id ?? room.roomId ?? room._id),
    ...(user.assignedRooms ?? []).map((room) => room.id ?? room.roomId ?? room._id),
  ].filter((roomId): roomId is string | number => typeof roomId === 'string' || typeof roomId === 'number')))

  return {
    rooms: rooms.map((room) => ({
      id: String(room.id ?? room.roomId ?? room._id),
      active: getBackendRoomOptionActive(room),
      isActive: getBackendRoomOptionActive(room),
      isTicketIssueEnabled: room.isTicketIssueEnabled,
      kioskEnabled: room.kioskEnabled,
      name: room.name ?? room.title ?? room.roomName ?? 'Кабинет без названия',
      number: room.number,
      placeType: room.placeType ?? room.place_type,
      roomId: room.roomId,
      roomName: room.roomName,
      serviceTypeId: room.serviceTypeId,
      serviceTypeIds: room.serviceTypeIds ?? (room.serviceTypes as any[])?.map((s: any) => s.serviceTypeId ?? s.id).filter(Boolean),
      serviceTypes: room.serviceTypes,
      services: room.services,
      ticketIssueEnabled: room.ticketIssueEnabled,
      title: room.title,
      workEndTime: room.workEndTime ?? room.workingEndTime ?? room.work_end_time,
      workStartTime: room.workStartTime ?? room.workingStartTime ?? room.work_start_time,
      workingEndTime: room.workingEndTime,
      workingStartTime: room.workingStartTime,
    })),
    serviceTypes: serviceTypes.map<TicketSettingsServiceTypeOption>((serviceType) => {
      const translations = {
        ...(serviceType.translations && typeof serviceType.translations === 'object'
          ? serviceType.translations as TicketSettingsServiceTypeOption['translations']
          : {}),
        ...(serviceType.nameKk ?? serviceType.name_kk ? { kk: serviceType.nameKk ?? serviceType.name_kk } : {}),
        ...(serviceType.nameEn ?? serviceType.name_en ? { en: serviceType.nameEn ?? serviceType.name_en } : {}),
      }

      return {
        active: serviceType.active ?? serviceType.isActive ?? serviceType.enabled,
        averageDurationMinutes: getPositiveNumber(
          serviceType.averageDurationMinutes
            ?? serviceType.average_duration_minutes
            ?? serviceType.avgServiceMinutes
            ?? serviceType.durationMinutes,
        ),
        code: toServiceCode(serviceType),
        id: serviceType.id,
        name: serviceType.name ?? serviceType.code ?? `Услуга ${serviceType.id}`,
        priorityWeight: getPositiveNumber(
          serviceType.priorityWeight
            ?? serviceType.priority_weight
            ?? serviceType.weight,
        ),
        ...(typeof serviceType.ticketPrefix === 'string' ? { ticketPrefix: serviceType.ticketPrefix } : {}),
        ...(Object.keys(translations).length > 0 ? { translations } : {}),
      }
    }),
    specialists: users.map((user) => {
      const userRoomIds = getUserRoomIds(user)

      return {
        assignedRoomId: user.assignedRoomId ?? userRoomIds[0],
        assignedRoomIds: userRoomIds,
        id: user.id,
        name: user.name ?? user.fullName ?? `Специалист ${user.id}`,
        role: user.role,
        roomId: user.roomId ?? userRoomIds[0],
        roomIds: userRoomIds,
      }
    }),
  }
}

function toNumberOrUndefined(value?: string | number): number | undefined {
  if (value === undefined || value === '') {
    return undefined
  }

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : undefined
}

function toBackendSettingsPayload(payload: TicketSettingsPayload) {
  const body: {
    comment?: string
    doctorId?: number
    etaMinutes?: number
    note?: string
    priority?: number
    roomId?: number
    serviceTypeId?: number | string
    status?: string
  } = {}

  const serviceTypeId = toNumberOrUndefined(payload.serviceTypeId)
  const roomId = toNumberOrUndefined(payload.roomId)
  const doctorId = toNumberOrUndefined(payload.doctorId)

  if (serviceTypeId !== undefined) {
    body.serviceTypeId = serviceTypeId
  } else if (payload.serviceTypeId !== undefined && payload.serviceTypeId !== '') {
    body.serviceTypeId = payload.serviceTypeId
  }

  if (roomId !== undefined) {
    body.roomId = roomId
  }

  if (doctorId !== undefined) {
    body.doctorId = doctorId
  }

  if (payload.priority) {
    body.priority = toBackendPriority(payload.priority as TicketPriority)
  }

  if (payload.status) {
    body.status = payload.status
  }

  if (payload.comment !== undefined) {
    body.comment = payload.comment
  }

  if (payload.note !== undefined) {
    body.note = payload.note
    body.comment = payload.comment ?? payload.note
  }

  if (payload.etaMinutes !== undefined) {
    body.etaMinutes = payload.etaMinutes
  }

  return body
}

function toBackendCreateSettingsPayload(payload: TicketSettingsPayload & { priority: TicketPriority }) {
  const roomId = toNumberOrUndefined(payload.roomId)
  const serviceTypeId = toNumberOrUndefined(payload.serviceTypeId)
  const doctorId = toNumberOrUndefined(payload.doctorId)
  const note = payload.note?.trim() || payload.comment?.trim()

  return {
    ...(doctorId !== undefined ? { doctorId } : {}),
    ...(note ? { note } : {}),
    ...(payload.language ? { language: payload.language } : {}),
    priority: toBackendPriority(payload.priority),
    ...(roomId !== undefined ? { roomId } : {}),
    serviceTypeId: serviceTypeId ?? payload.serviceTypeId ?? 1,
  }
}

export const backendTicketApi: TicketApi = {
  async getTickets() {
    const response = await apiClient.get<BackendTicket[]>('/tickets')

    return toArchitectureTickets(response.data)
  },

  async getTicketById(id: string) {
    const response = await apiClient.get<BackendTicket>(`/tickets/${id}`)

    return toArchitectureTicket(response.data)
  },

  async getTicketHistory(id: string) {
    const response = await apiClient.get<BackendTicket>(`/tickets/${id}`)

    return toSharedTicket(response.data)
  },

  async createTicket(input) {
    await assertRoomAcceptsTickets(input.roomId)

    const ticket = await createBackendTicket(
      '/tickets',
      toBackendArchitectureTicketCreateInput(input),
    )
    const arrivedTicket = await arriveCreatedTicket(ticket)

    return toArchitectureTicket(arrivedTicket)
  },

  async createKioskTicket(input) {
    await assertRoomAcceptsTickets(input.roomId)

    const ticket = await createBackendTicket(
      '/tickets/kiosk',
      toBackendArchitectureTicketCreateInput(input),
      publicApiClient,
    )
    const arrivedTicket = await arriveCreatedTicketWithClient(ticket, publicApiClient, true)

    return toArchitectureTicket(arrivedTicket)
  },

  arriveTicket(id: string) {
    return postTicketAction(id, 'arrive')
  },

  callTicket(id: string) {
    return postTicketAction(id, 'call')
  },

  startTicket(id: string) {
    return postTicketAction(id, 'start')
  },

  completeTicket(id: string) {
    return postTicketAction(id, 'complete')
  },

  cancelTicket(id: string) {
    return postTicketAction(id, 'cancel')
  },

  noShowTicket(id: string) {
    return postTicketAction(id, 'no-show')
  },

  skipTicket(id: string) {
    return backendTicketApi.noShowTicket(id)
  },

  async returnTicket(id: string, roomId?: string | number) {
    return toArchitectureTicket(await requestTicketReturn(id, { roomId }))
  },

  async redirectTicket(id: string, newRoomId: string | number) {
    const response = await apiClient.post<BackendTicket>(`/tickets/${id}/redirect`, {
      newRoomId: Number(newRoomId),
    })

    return toArchitectureTicket(response.data)
  },

  updateTicketStatus(input) {
    const actionByStatus: Partial<Record<TicketStatus, () => ReturnType<TicketApi['callTicket']>>> = {
      called: () => backendTicketApi.callTicket(input.ticketId),
      cancelled: () => backendTicketApi.cancelTicket(input.ticketId),
      completed: () => backendTicketApi.completeTicket(input.ticketId),
      in_service: () => backendTicketApi.startTicket(input.ticketId),
      no_show: () => backendTicketApi.noShowTicket(input.ticketId),
      waiting: () => backendTicketApi.arriveTicket(input.ticketId),
    }
    const action = actionByStatus[input.status]

    return action ? action() : backendTicketApi.getTicketById(input.ticketId)
  },

  async createTicketWithSettings(payload) {
    await assertRoomAcceptsTickets(payload.roomId)

    const createdTicket = await createBackendTicket(
      '/tickets',
      toBackendCreateSettingsPayload(payload),
    )
    const arrivedTicket = await arriveCreatedTicket(createdTicket)
    let resolvedTicket = arrivedTicket

    try {
      const updateResponse = await apiClient.patch<BackendTicket>(
        `/tickets/${arrivedTicket.id}`,
        toBackendSettingsPayload(payload),
      )

      if (updateResponse.data) {
        resolvedTicket = updateResponse.data
      }
    } catch (error) {
      console.warn('backendTicketApi.createTicketWithSettings: PATCH /tickets/:id is not available yet', error)
    }

    try {
      const response = await apiClient.get<BackendTicket>(`/tickets/${arrivedTicket.id}`)

      resolvedTicket = response.data
    } catch (error) {
      console.warn('backendTicketApi.createTicketWithSettings: GET /tickets/:id failed', error)
    }

    return toSharedTicket(resolvedTicket)
  },

  async getTicketSettingsOptions() {
    const role = useGlobalStore.getState().user?.role
    const shouldLoadSpecialists = role === 'admin' || role === 'manager'
    const [rooms, serviceTypes, users] = await Promise.all([
      getOrEmpty<BackendRoomOption>('/rooms', publicApiClient),
      getOrEmpty<BackendServiceTypeOption>('/service-types', publicApiClient),
      shouldLoadSpecialists
        ? getOrEmpty<BackendUserOption>('/users', apiClient, [401, 403])
        : Promise.resolve([]),
    ])
    const usersWithSpecialistRole = users.filter(
      (user) => !user.role || user.role === 'specialist',
    )
    const specialists = usersWithSpecialistRole.length > 0
      ? usersWithSpecialistRole
      : shouldLoadSpecialists
        ? await getOrEmpty<BackendUserOption>('/staff', apiClient, [401, 403])
        : []

    return toSettingsOptions(rooms, serviceTypes, specialists)
  },

  async updateTicketSettings(id, payload) {
    await apiClient.patch(`/tickets/${id}`, toBackendSettingsPayload(payload))

    try {
      await apiClient.get<BackendTicket>(`/tickets/${id}`)
    } catch (error) {
      console.warn('backendTicketApi.updateTicketSettings: GET /tickets/:id failed', error)
    }

    if (payload.roomId) {
      try {
        await apiClient.get<BackendTicket[]>(`/queue/room/${payload.roomId}`)
      } catch (error) {
        console.warn('backendTicketApi.updateTicketSettings: GET /queue/room/:roomId failed', error)
      }
    }
  },
}
