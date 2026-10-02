import type { QueueSnapshot, RedirectTicketInput } from '@shared/types'
import { isAxiosError } from 'axios'
import { formatRoomName, getRoomBoardId, isWithinTicketIssueHours, roomMatchesIdentifier } from '@shared/utils'
import type { QueueStats, Room, Ticket } from '../../../types'
import {
  toArchitectureRooms,
  toArchitectureTickets,
  toBackendRooms,
  toBackendTickets,
  getBackendTicketRoomId,
  toBoardQueueSnapshot,
  toBackendAnalyticsPoints,
  toSharedAnalytics,
  toSharedTicket,
  toSharedStatus,
  toBackendTicketCreateInput,
  toBackendRecommendations,
  toQueueKpi,
  toQueueSnapshot,
  type BackendRecommendation,
  type BackendAnalyticsPoint,
  type BackendRoom,
  type BackendOverloadRoom,
  type BackendQueueStats,
  type BackendTicket,
} from '../backendAdapters'
import { apiClient, publicApiClient } from '../client'
import type { QueueApi, QueueOverloadRoom, RoomQueueStat } from '../types'
import { requestTicketReturn } from './ticketReturnFallback'
import { useGlobalStore } from '@store/global'

const activeRoomStatuses = ['waiting', 'called', 'in_service', 'redirected'] as const
const serverDidNotReturnMessage = 'Сервер не вернул пациента в очередь'
const analyticsPaths = [
  '/analytics/dashboard',
  '/analytics/rooms',
  '/queue/analytics/service-time',
  '/queue/analytics/period?period=day',
  '/queue/analytics/period?period=week',
  '/queue/analytics/period?period=month',
  '/queue/analytics/period?period=year',
] as const

const optionalEndpointStatuses = new Set([403, 404, 405, 501])
const publicQueueFallbackStatuses = new Set([401, 403])
const optionalEndpointTimeoutMs = 1500
const boardRoomMappingCacheTtlMs = 30_000

const boardRoomMappingCache = new Map<string, { backendRoomId: string; resolvedAt: number }>()

type TicketCreateBody = {
  priority: number
  roomId?: number
  serviceTypeId: number | string
}

type BackendRedirectBody = {
  newRoomId: string | number
  serviceTypeId?: string | number
  note?: string
  comment?: string
}

function isExpectedOptionalEndpointError(error: unknown): boolean {
  return isAxiosError(error) && (
    optionalEndpointStatuses.has(error.response?.status ?? 0) ||
    error.code === 'ECONNABORTED'
  )
}

function shouldUsePublicQueueFallback(error: unknown): boolean {
  return isAxiosError(error) && publicQueueFallbackStatuses.has(error.response?.status ?? 0)
}

function logOptionalEndpointWarning(scope: string, error: unknown): void {
  if (isExpectedOptionalEndpointError(error)) {
    return
  }

  console.warn(scope, error)
}

function isPublicQueuePage(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.location.pathname.startsWith('/kiosk') || window.location.pathname.startsWith('/board')
}

function getCurrentUserRole(): string | undefined {
  return useGlobalStore.getState().user?.role
}

function isSpecialistRole(): boolean {
  return getCurrentUserRole() === 'specialist'
}

function shouldSkipGlobalAnalyticsEndpoints(): boolean {
  return isSpecialistRole() || isPublicQueuePage()
}

function shouldSkipRecommendationsEndpoints(): boolean {
  return isSpecialistRole() || isPublicQueuePage()
}

function shouldUseRoomScopedSnapshot(): boolean {
  return isSpecialistRole()
}

async function loadRelevantQueueSnapshot(roomId?: string | number): Promise<QueueSnapshot> {
  if (shouldUseRoomScopedSnapshot() && roomId !== undefined) {
    return loadRoomQueueSnapshot(roomId)
  }

  return loadQueueSnapshot()
}

async function loadQueueSnapshot(ticketPath = '/tickets') {
  const [
    ticketsResponse,
    statsResponse,
    overloadResponse,
    rooms,
    recommendations,
    highPriorityTickets,
    analytics,
  ] = await Promise.all([
    apiClient.get<unknown>(ticketPath),
    apiClient.get<BackendQueueStats[]>('/queue/stats'),
    apiClient.get<BackendOverloadRoom[]>('/queue/overload'),
    getBackendRooms(),
    getBackendRecommendations(),
    getBackendHighPriorityTickets(),
    getBackendAnalyticsPoints(),
  ])
  const backendTickets = toBackendTickets(ticketsResponse.data)
  const referencedTickets = await getRecommendationTickets(recommendations, [
    ...backendTickets,
    ...highPriorityTickets,
  ])
  const tickets = mergeBackendTickets(backendTickets, referencedTickets)

  return toQueueSnapshot(
    tickets,
    statsResponse.data,
    overloadResponse.data,
    rooms,
    recommendations,
    highPriorityTickets,
    analytics,
  )
}

async function loadPublicQueueSnapshotFallback(): Promise<QueueSnapshot> {
  const response = await publicApiClient.get<unknown>('/queue/board')

  return toBoardQueueSnapshot(response.data)
}

async function arriveCreatedTicket(
  ticket: BackendTicket,
  client = apiClient,
  optional = false,
): Promise<void> {
  if (ticket.status === 'created') {
    try {
      await client.post<BackendTicket>(`/tickets/${ticket.id}/arrive`)
    } catch (error) {
      if (optional) {
        console.warn('backendQueueApi: public POST /tickets/:id/arrive is not available', error)

        return
      }

      throw error
    }
  }
}

function withoutRoomId(payload: TicketCreateBody) {
  return {
    priority: payload.priority,
    serviceTypeId: payload.serviceTypeId,
  }
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
    if (payload.roomId === undefined) {
      throw error
    }

    console.warn('backendQueueApi: POST /tickets with roomId failed, retrying without roomId', error)
    const response = await client.post<BackendTicket>(path, withoutRoomId(payload))

    try {
      const patchResponse = await client.patch<BackendTicket>(`/tickets/${response.data.id}`, {
        roomId: payload.roomId,
      })

      return patchResponse.data ?? response.data
    } catch (patchError) {
      console.warn('backendQueueApi: PATCH /tickets/:id roomId fallback failed', patchError)

      return response.data
    }
  }
}

function toQueueStats(stats: BackendQueueStats[], overload: BackendOverloadRoom[]): QueueStats {
  const kpi = toQueueKpi([], stats, overload)

  return {
    activeTickets: stats.reduce((sum, item) => sum + item.activeTickets, 0),
    averageWaitMinutes: kpi.averageWaitMinutes,
    completedToday: 0,
    overloadedRooms: overload.length,
  }
}

async function getBackendRooms(): Promise<BackendRoom[]> {
  try {
    const response = await apiClient.get<unknown>('/rooms')

    return toBackendRooms(response.data)
  } catch (error) {
    console.warn('backendQueueApi: GET /rooms is not available for queue snapshot', error)

    return []
  }
}

async function getBackendRecommendations(): Promise<BackendRecommendation[]> {
  if (shouldSkipRecommendationsEndpoints()) {
    return []
  }

  try {
    const response = await apiClient.get<unknown>('/recommendations', {
      timeout: optionalEndpointTimeoutMs,
    })

    return toBackendRecommendations(response.data)
  } catch (error) {
    logOptionalEndpointWarning('backendQueueApi: GET /recommendations is not available', error)

    return []
  }
}

function isBackendRoomAcceptingTickets(room: BackendRoom): boolean {
  const record = room as Record<string, unknown>
  const issueEnabled = record.ticketIssueEnabled
    ?? record.isTicketIssueEnabled
    ?? record.kioskEnabled

  if (issueEnabled === false) {
    return false
  }

  if (!isWithinTicketIssueHours({
    workEndTime: typeof record.workEndTime === 'string'
      ? record.workEndTime
      : typeof record.workingEndTime === 'string'
        ? record.workingEndTime
      : typeof record.work_end_time === 'string'
        ? record.work_end_time
        : undefined,
    workStartTime: typeof record.workStartTime === 'string'
      ? record.workStartTime
      : typeof record.workingStartTime === 'string'
        ? record.workingStartTime
      : typeof record.work_start_time === 'string'
        ? record.work_start_time
        : undefined,
  })) {
    return false
  }

  if (typeof record.isActive === 'boolean') {
    return record.isActive
  }

  if (typeof record.active === 'boolean') {
    return record.active
  }

  return record.status !== 'paused' && record.status !== 'inactive' && record.status !== 'deleted'
}

async function assertRoomAcceptsTickets(roomId?: string | number) {
  if (roomId === undefined) {
    return
  }

  const rooms = await getBackendRooms()

  if (rooms.length === 0) {
    return
  }

  const room = rooms.find((item) => String(item.id ?? item.roomId ?? item._id) === String(roomId))

  if (!room || !isBackendRoomAcceptingTickets(room)) {
    throw new Error('Выдача талонов в это место обслуживания закрыта.')
  }
}

async function getBackendHighPriorityTickets(): Promise<BackendTicket[]> {
  if (shouldSkipGlobalAnalyticsEndpoints()) {
    return []
  }

  try {
    const response = await apiClient.get<unknown>('/queue/high-priority', {
      timeout: optionalEndpointTimeoutMs,
    })

    return toBackendTickets(response.data)
  } catch (error) {
    logOptionalEndpointWarning('backendQueueApi: GET /queue/high-priority is not available', error)

    return []
  }
}

async function getBackendAnalyticsPoints(): Promise<BackendAnalyticsPoint[]> {
  if (shouldSkipGlobalAnalyticsEndpoints()) {
    return []
  }

  const results = await Promise.allSettled(
    analyticsPaths.map((path) => apiClient.get<unknown>(path, {
      timeout: optionalEndpointTimeoutMs,
    })),
  )

  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return toBackendAnalyticsPoints(result.value.data)
    }

    logOptionalEndpointWarning(
      `backendQueueApi: GET ${analyticsPaths[index]} is not available`,
      result.reason,
    )

    return []
  })
}

function getRecommendationTicketIds(recommendations: BackendRecommendation[]): string[] {
  return Array.from(new Set(
    recommendations
      .map((recommendation) => recommendation.ticketId ?? recommendation.ticket_id)
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .map(String),
  ))
}

async function getRecommendationTickets(
  recommendations: BackendRecommendation[],
  knownTickets: BackendTicket[],
): Promise<BackendTicket[]> {
  const knownTicketIds = new Set(knownTickets.map((ticket) => String(ticket.id)))
  const missingTicketIds = getRecommendationTicketIds(recommendations)
    .filter((ticketId) => !knownTicketIds.has(ticketId))

  if (missingTicketIds.length === 0) {
    return []
  }

  const results = await Promise.allSettled(
    missingTicketIds.map((ticketId) => apiClient.get<unknown>(`/tickets/${ticketId}`)),
  )

  return results.flatMap((result) => (
    result.status === 'fulfilled' ? toBackendTickets(result.value.data) : []
  ))
}

function mergeBackendTickets(tickets: BackendTicket[], extraTickets: BackendTicket[]): BackendTicket[] {
  const ticketMap = new Map<string, BackendTicket>()

  tickets.forEach((ticket) => ticketMap.set(String(ticket.id), ticket))
  extraTickets.forEach((ticket) => ticketMap.set(String(ticket.id), ticket))

  return Array.from(ticketMap.values())
}

async function getAllBackendTicketsForRoomFallback(): Promise<BackendTicket[]> {
  try {
    const response = await apiClient.get<unknown>('/tickets')

    return toBackendTickets(response.data)
  } catch (error) {
    console.warn('backendQueueApi: GET /tickets fallback for room queue failed', error)

    return []
  }
}

async function getBackendTicketsByRoom(roomId: string | number): Promise<BackendTicket[]> {
  const roomIdValue = String(roomId)

  try {
    const response = await apiClient.get<unknown>(`/tickets?roomId=${encodeURIComponent(roomIdValue)}`)

    return toBackendTickets(response.data)
      .filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
  } catch (error) {
    console.warn('backendQueueApi: GET /tickets?roomId=:roomId failed, using /tickets fallback', error)
  }

  const allTickets = await getAllBackendTicketsForRoomFallback()

  return allTickets.filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
}

async function resolveTicketRoomId(ticketId: string): Promise<string | undefined> {
  try {
    const response = await apiClient.get<BackendTicket>(`/tickets/${ticketId}`)

    return getBackendTicketRoomId(response.data) || undefined
  } catch (error) {
    console.warn('backendQueueApi: GET /tickets/:id failed while resolving roomId', error)

    return undefined
  }
}

function isActiveRoomTicket(ticket: BackendTicket): boolean {
  return activeRoomStatuses.includes(ticket.status as (typeof activeRoomStatuses)[number])
}

function isNoShowTicket(ticket: BackendTicket): boolean {
  const status = ticket.status?.trim().toLowerCase().replace(/-/g, '_')

  return status === 'no_show' || status === 'noshow'
}

function isPostponedTicket(ticket: BackendTicket): boolean {
  return toSharedStatus(ticket.status) === 'postponed'
}

function isReturnedToQueue(ticket: BackendTicket): boolean {
  const status = toSharedStatus(ticket.status)

  return status === 'waiting' || status === 'in_service'
}

function createServerDidNotReturnError(): Error {
  return new Error(serverDidNotReturnMessage)
}

async function getBackendNoShowTicketsForRoom(roomId: string | number): Promise<BackendTicket[]> {
  const roomIdValue = String(roomId)

  try {
    const response = await apiClient.get<unknown>(
      `/tickets?roomId=${encodeURIComponent(roomIdValue)}&status=no_show`,
    )

    return toBackendTickets(response.data)
      .filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
      .filter(isNoShowTicket)
  } catch (error) {
    console.warn('backendQueueApi: GET /tickets?roomId=:roomId&status=no_show failed, using /tickets fallback', error)
  }

  const allTickets = await getAllBackendTicketsForRoomFallback()

  return allTickets
    .filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
    .filter(isNoShowTicket)
}

async function getBackendPostponedTicketsForRoom(roomId: string | number): Promise<BackendTicket[]> {
  const roomIdValue = String(roomId)

  try {
    const response = await apiClient.get<unknown>(
      `/tickets?roomId=${encodeURIComponent(roomIdValue)}&status=postponed`,
    )

    return toBackendTickets(response.data)
      .filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
      .filter(isPostponedTicket)
  } catch (error) {
    console.warn('backendQueueApi: GET /tickets?roomId=:roomId&status=postponed failed, using /tickets fallback', error)
  }

  const allTickets = await getAllBackendTicketsForRoomFallback()

  return allTickets
    .filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
    .filter(isPostponedTicket)
}

function withImplicitRoomId(ticket: BackendTicket, roomId: string | number): BackendTicket {
  if (getBackendTicketRoomId(ticket)) {
    return ticket
  }

  return {
    ...ticket,
    roomId,
  }
}

function mergeRoomTickets(roomId: string | number, roomTickets: BackendTicket[], allTickets: BackendTicket[]) {
  const roomIdValue = String(roomId)
  const mergedTickets = new Map<string, BackendTicket>()

  allTickets
    .filter((ticket) => getBackendTicketRoomId(ticket) === roomIdValue)
    .filter(isActiveRoomTicket)
    .forEach((ticket) => {
      mergedTickets.set(String(ticket.id), ticket)
    })

  roomTickets
    .map((ticket) => withImplicitRoomId(ticket, roomId))
    .filter(isActiveRoomTicket)
    .forEach((ticket) => {
      mergedTickets.set(String(ticket.id), ticket)
    })

  return Array.from(mergedTickets.values())
}

async function loadRoomQueueSnapshot(
  roomId: string | number,
  extraRoomTickets: BackendTicket[] = [],
) {
  if (shouldUseRoomScopedSnapshot()) {
    const [
      ticketsResponse,
      roomTicketsResponse,
      rooms,
    ] = await Promise.all([
      apiClient.get<unknown>(`/queue/room/${roomId}`),
      getBackendTicketsByRoom(roomId),
      getBackendRooms(),
    ])
    const roomEndpointTickets = toBackendTickets(ticketsResponse.data)
    const roomTickets = mergeBackendTickets(
      mergeRoomTickets(roomId, roomEndpointTickets, roomTicketsResponse),
      extraRoomTickets,
    )

    return ensureRoomSnapshotRoom(
      toQueueSnapshot(
        roomTickets,
        [],
        [],
        rooms,
        [],
        [],
        [],
      ),
      roomId,
    )
  }

  const [
    ticketsResponse,
    allTickets,
    statsResponse,
    overloadResponse,
    rooms,
    recommendations,
    highPriorityTickets,
    analytics,
  ] = await Promise.all([
    apiClient.get<unknown>(`/queue/room/${roomId}`),
    getAllBackendTicketsForRoomFallback(),
    apiClient.get<BackendQueueStats[]>('/queue/stats'),
    apiClient.get<BackendOverloadRoom[]>('/queue/overload'),
    getBackendRooms(),
    getBackendRecommendations(),
    getBackendHighPriorityTickets(),
    getBackendAnalyticsPoints(),
  ])
  const roomEndpointTickets = toBackendTickets(ticketsResponse.data)
  const referencedTickets = await getRecommendationTickets(recommendations, [
    ...roomEndpointTickets,
    ...allTickets,
    ...highPriorityTickets,
  ])
  const roomTickets = mergeBackendTickets(
    mergeRoomTickets(
      roomId,
      roomEndpointTickets,
      mergeBackendTickets(allTickets, referencedTickets),
    ),
    extraRoomTickets,
  )

  return ensureRoomSnapshotRoom(
    toQueueSnapshot(
      roomTickets,
      statsResponse.data,
      overloadResponse.data,
      rooms,
      recommendations,
      highPriorityTickets,
      analytics,
    ),
    roomId,
  )
}

function ensureRoomSnapshotRoom(snapshot: QueueSnapshot, roomId: string | number): QueueSnapshot {
  const roomIdValue = String(roomId)

  if (snapshot.rooms.some((room) => String(room.id) === roomIdValue)) {
    return snapshot
  }

  const roomTicket = snapshot.tickets.find((ticket) => String(ticket.roomId) === roomIdValue)

  if (!roomTicket) {
    return snapshot
  }

  const roomName = formatRoomName({ id: roomIdValue, name: roomTicket.roomName })

  return {
    ...snapshot,
    rooms: [
      {
        department: roomName,
        id: roomIdValue,
        isActive: false,
        loadPercent: 0,
        name: roomName,
        specialistName: roomName,
        status: 'paused',
        workload: 0,
      },
      ...snapshot.rooms,
    ],
  }
}

function toRooms(stats: BackendQueueStats[]): Room[] {
  return stats.map((item) => ({
    id: String(item.roomId),
    name: item.roomName,
    serviceTypes: [],
  }))
}

function toOverloadRooms(overload: BackendOverloadRoom[]): QueueOverloadRoom[] {
  return overload.map((room) => ({
    queueCount: room.queueCount,
    roomId: String(room.roomId),
    roomName: room.roomName,
  }))
}

function toBackendRoomId(roomId: string | number): string | number {
  const numericRoomId = Number(roomId)

  return Number.isFinite(numericRoomId) ? numericRoomId : roomId
}

function getRawBackendRoomId(room: BackendRoom): string {
  const rawId = room.id ?? room.roomId ?? room.room_id ?? room._id

  return rawId == null ? '' : String(rawId)
}

function getBackendRoomBoardId(room: BackendRoom): string {
  return getRoomBoardId({
    id: getRawBackendRoomId(room),
    name: room.name,
    number: room.number,
    placeType: room.placeType ?? room.place_type,
    roomId: room.roomId ?? room.room_id,
    roomName: room.roomName ?? room.room_name,
    title: room.title,
  })
}

function backendRoomMatchesIdentifier(room: BackendRoom, identifier: string | number): boolean {
  return roomMatchesIdentifier({
    id: getRawBackendRoomId(room),
    name: room.name,
    number: room.number,
    placeType: room.placeType ?? room.place_type,
    roomId: room.roomId ?? room.room_id,
    roomName: room.roomName ?? room.room_name,
    title: room.title,
  }, identifier)
}

async function resolveBackendRoomIdForBoard(roomId: string | number): Promise<string> {
  const boardRoomId = String(roomId)
  const cached = boardRoomMappingCache.get(boardRoomId)
  const now = Date.now()

  if (cached && now - cached.resolvedAt < boardRoomMappingCacheTtlMs) {
    return cached.backendRoomId
  }

  try {
    const response = await publicApiClient.get<unknown>('/rooms')
    const room = toBackendRooms(response.data).find((item) => (
      backendRoomMatchesIdentifier(item, boardRoomId) ||
      getBackendRoomBoardId(item) === boardRoomId ||
      getRawBackendRoomId(item) === boardRoomId
    ))
    const backendRoomId = room ? getRawBackendRoomId(room) : ''
    const resolvedBackendRoomId = backendRoomId || boardRoomId

    boardRoomMappingCache.set(boardRoomId, {
      backendRoomId: resolvedBackendRoomId,
      resolvedAt: now,
    })

    return resolvedBackendRoomId
  } catch (error) {
    console.warn('backendQueueApi: public GET /rooms failed for board room mapping', error)
    boardRoomMappingCache.set(boardRoomId, {
      backendRoomId: boardRoomId,
      resolvedAt: now,
    })

    return boardRoomId
  }
}

function getBoardRoomFilterIds(
  snapshot: QueueSnapshot,
  boardRoomId: string,
  backendRoomId: string,
): Set<string> {
  const ids = new Set([boardRoomId, backendRoomId].filter(Boolean))

  snapshot.rooms
    .filter((room) => (
      roomMatchesIdentifier(room, boardRoomId) ||
      roomMatchesIdentifier(room, backendRoomId) ||
      String(room.id) === boardRoomId ||
      String(room.id) === backendRoomId ||
      getRoomBoardId(room) === boardRoomId
    ))
    .forEach((room) => ids.add(String(room.id)))

  return ids
}

function filterBoardSnapshotByRoom(
  snapshot: QueueSnapshot,
  roomId: string | number,
  backendRoomId: string,
): QueueSnapshot {
  const boardRoomId = String(roomId)
  const roomIds = getBoardRoomFilterIds(snapshot, boardRoomId, backendRoomId)

  return {
    ...snapshot,
    rooms: snapshot.rooms.filter((room) => (
      roomIds.has(String(room.id)) ||
      roomMatchesIdentifier(room, boardRoomId) ||
      getRoomBoardId(room) === boardRoomId
    )),
    tickets: snapshot.tickets.filter((ticket) => (
      (ticket.roomId !== undefined && roomIds.has(String(ticket.roomId))) ||
      roomMatchesIdentifier({ id: ticket.roomId, name: ticket.roomName }, boardRoomId) ||
      getRoomBoardId({ id: ticket.roomId, name: ticket.roomName }) === boardRoomId
    )),
  }
}

function toRedirectBody(input: RedirectTicketInput, includeOptional = true): BackendRedirectBody {
  const note = input.note?.trim()
  const comment = input.comment?.trim() ?? input.reason?.trim()

  return {
    newRoomId: toBackendRoomId(input.roomId),
    ...(includeOptional && input.serviceTypeId !== undefined ? { serviceTypeId: input.serviceTypeId } : {}),
    ...(includeOptional && note ? { note } : {}),
    ...(includeOptional && comment ? { comment } : {}),
  }
}

export const backendQueueApi: QueueApi = {
  async getQueueSnapshot() {
    try {
      return await loadQueueSnapshot()
    } catch (error) {
      if (!shouldUsePublicQueueFallback(error)) {
        throw error
      }

      console.warn('backendQueueApi: protected queue snapshot is unavailable, using public board fallback', error)

      return loadPublicQueueSnapshotFallback()
    }
  },

  async getBoardSnapshot(roomId?: string | number) {
    const backendRoomId = roomId ? await resolveBackendRoomIdForBoard(roomId) : undefined
    const response = roomId
      ? await publicApiClient
        .get<unknown>(`/queue/board/${encodeURIComponent(backendRoomId ?? String(roomId))}`)
        .catch((error) => {
          console.warn('backendQueueApi: public room board is not available, loading common board', error)

          return publicApiClient.get<unknown>('/queue/board')
        })
      : await publicApiClient.get<unknown>('/queue/board')
    const snapshot = toBoardQueueSnapshot(response.data)

    if (!roomId) {
      return snapshot
    }

    return filterBoardSnapshotByRoom(snapshot, roomId, backendRoomId ?? String(roomId))
  },

  async getPeriodAnalytics(period) {
    const response = await apiClient.get<unknown>(`/queue/analytics/period?period=${period}`)

    return toSharedAnalytics(toBackendAnalyticsPoints(response.data))
  },

  async getRoomQueueSnapshot(roomId: string | number) {
    return loadRoomQueueSnapshot(roomId)
  },

  async getRoomNoShowTickets(roomId: string | number) {
    const tickets = await getBackendNoShowTicketsForRoom(roomId)

    return tickets.map((ticket) => ({
      ...toSharedTicket(ticket),
      roomId: getBackendTicketRoomId(ticket) || String(roomId),
      status: 'no_show',
    }))
  },

  async getRoomPostponedTickets(roomId: string | number) {
    const tickets = await getBackendPostponedTicketsForRoom(roomId)

    return tickets.map((ticket) => ({
      ...toSharedTicket(ticket),
      roomId: getBackendTicketRoomId(ticket) || String(roomId),
      status: 'postponed',
    }))
  },

  async createTicket(input) {
    await assertRoomAcceptsTickets(input.roomId)

    const ticket = await createBackendTicket('/tickets', toBackendTicketCreateInput(input))

    await arriveCreatedTicket(ticket)

    return loadQueueSnapshot()
  },

  async createKioskTicket(input) {
    await assertRoomAcceptsTickets(input.roomId)

    const ticket = await createBackendTicket(
      '/tickets/kiosk',
      toBackendTicketCreateInput(input),
      publicApiClient,
    )

    await arriveCreatedTicket(ticket, publicApiClient, true)

    return loadQueueSnapshot()
  },

  async callNextTicket(roomId: string) {
    const response = await apiClient.get<BackendTicket | null>(`/queue/room/${roomId}/next`)
    const responseRoomId = response.data ? getBackendTicketRoomId(response.data) : undefined

    if (response.data?.id && (!responseRoomId || responseRoomId === String(roomId))) {
      await apiClient.post<BackendTicket>(`/tickets/${response.data.id}/call`)
    }

    return loadRelevantQueueSnapshot(roomId)
  },

  async startService(ticketId: string) {
    const roomId = await resolveTicketRoomId(ticketId)
    await apiClient.post<BackendTicket>(`/tickets/${ticketId}/start`)

    return loadRelevantQueueSnapshot(roomId)
  },

  async completeService(ticketId: string) {
    const roomId = await resolveTicketRoomId(ticketId)
    await apiClient.post<BackendTicket>(`/tickets/${ticketId}/complete`)

    return loadRelevantQueueSnapshot(roomId)
  },

  async postponeTicket(ticketId: string) {
    const roomId = await resolveTicketRoomId(ticketId)
    await apiClient.post<BackendTicket>(`/tickets/${ticketId}/postpone`)

    return loadRelevantQueueSnapshot(roomId)
  },

  async skipTicket(ticketId: string) {
    const roomId = await resolveTicketRoomId(ticketId)
    await apiClient.post<BackendTicket>(`/tickets/${ticketId}/no-show`)

    return loadRelevantQueueSnapshot(roomId)
  },

  async returnTicket(ticketId: string, roomId?: string | number) {
    const returnedTicket = await requestTicketReturn(ticketId, { roomId })
    let resolvedTicket = returnedTicket

    try {
      const ticketResponse = await apiClient.get<BackendTicket>(`/tickets/${ticketId}`)
      if (isNoShowTicket(ticketResponse.data)) {
        throw createServerDidNotReturnError()
      }

      if (isReturnedToQueue(ticketResponse.data)) {
        resolvedTicket = ticketResponse.data
      }
    } catch (error) {
      if (error instanceof Error && error.message === serverDidNotReturnMessage) {
        throw error
      }

      console.warn('backendQueueApi.returnTicket: GET /tickets/:id failed after return', error)
    }

    if (!isReturnedToQueue(resolvedTicket)) {
      throw createServerDidNotReturnError()
    }

    const resolvedRoomId = getBackendTicketRoomId(resolvedTicket)
      || getBackendTicketRoomId(returnedTicket)
      || (roomId !== undefined ? String(roomId) : undefined)

    if (resolvedRoomId) {
      const noShowTickets = (await getBackendNoShowTicketsForRoom(resolvedRoomId))
        .filter((ticket) => String(ticket.id) !== String(ticketId))

      return loadRoomQueueSnapshot(resolvedRoomId, [resolvedTicket, ...noShowTickets])
    }

    return loadQueueSnapshot()
  },

  async redirectTicket(input) {
    let redirectedTickets: BackendTicket[] = []

    try {
      const response = await apiClient.post<unknown>(`/tickets/${input.ticketId}/redirect`, toRedirectBody(input))
      redirectedTickets = toBackendTickets(response.data)
    } catch (error) {
      console.warn('backendQueueApi.redirectTicket: extended payload failed, retrying with newRoomId only', error)
      const response = await apiClient.post<unknown>(`/tickets/${input.ticketId}/redirect`, toRedirectBody(input, false))
      redirectedTickets = toBackendTickets(response.data)
    }

    const snapshot = await loadRelevantQueueSnapshot(input.roomId)
    const redirectedRoomId = String(input.roomId)
    const redirectedTicket = redirectedTickets.find((ticket) => String(ticket.id) === String(input.ticketId))
    const redirectedSnapshotTicket = redirectedTicket
      ? {
          ...toSharedTicket(redirectedTicket),
          roomId: getBackendTicketRoomId(redirectedTicket) || redirectedRoomId,
          status: toSharedStatus(redirectedTicket.status) === 'no_show'
            ? 'redirected'
            : toSharedStatus(redirectedTicket.status),
        }
      : undefined
    const snapshotHasTicket = snapshot.tickets.some((ticket) => ticket.id === input.ticketId)
    const tickets = snapshotHasTicket
      ? snapshot.tickets.map((ticket) => {
          if (ticket.id !== input.ticketId) {
            return ticket
          }

          return redirectedSnapshotTicket ?? {
            ...ticket,
            roomId: redirectedRoomId,
            status: ticket.status === 'no_show' ? 'redirected' : ticket.status,
          }
        })
      : redirectedSnapshotTicket
        ? [...snapshot.tickets, redirectedSnapshotTicket]
        : snapshot.tickets

    return {
      ...snapshot,
      tickets,
    }
  },

  async recalculateRoom(roomId: string | number) {
    await apiClient.post(`/queue/room/${roomId}/recalculate`)

    return loadRelevantQueueSnapshot(roomId)
  },

  async resolveRecommendation(id: string) {
    await apiClient.patch(`/recommendations/${id}/resolve`)

    return loadQueueSnapshot()
  },

  async getStats() {
    const [statsResponse, overloadResponse] = await Promise.all([
      apiClient.get<BackendQueueStats[]>('/queue/stats'),
      apiClient.get<BackendOverloadRoom[]>('/queue/overload'),
    ])

    return toQueueStats(statsResponse.data, overloadResponse.data)
  },

  async getRoomStats(): Promise<RoomQueueStat[]> {
    const response = await apiClient.get<BackendQueueStats[]>('/queue/stats')

    return response.data.map((item) => ({
      activeTickets: item.activeTickets,
      avgServiceMinutes: item.avgServiceMinutes,
      etaMinutes: item.etaMinutes,
      roomId: item.roomId,
      roomName: item.roomName,
    }))
  },

  async getQueueByRoom(roomId: string | number) {
    const response = await apiClient.get<BackendTicket[]>(`/queue/room/${roomId}`)

    return toArchitectureTickets(response.data)
  },

  async getNextTicket(roomId: string | number) {
    const response = await apiClient.get<BackendTicket | null>(`/queue/room/${roomId}/next`)
    const responseRoomId = response.data ? getBackendTicketRoomId(response.data) : undefined

    return response.data && (!responseRoomId || responseRoomId === String(roomId))
      ? toArchitectureTickets([response.data])[0]
      : undefined
  },

  async getHighPriority() {
    const response = await apiClient.get<BackendTicket[]>('/queue/high-priority')

    return toArchitectureTickets(response.data)
  },

  async checkOverload() {
    const response = await apiClient.get<BackendOverloadRoom[]>('/queue/overload')

    return toOverloadRooms(response.data)
  },

  async getQueue() {
    const response = await apiClient.get<BackendTicket[]>('/tickets?status=waiting')

    return toArchitectureTickets(response.data)
  },

  async getRooms() {
    const rooms = await getBackendRooms()

    if (rooms.length > 0) {
      return toArchitectureRooms(rooms)
    }

    const response = await apiClient.get<BackendQueueStats[]>('/queue/stats')

    return toRooms(response.data)
  },

  subscribeQueue(listener) {
    let active = true

    publicApiClient
      .get<BackendTicket[]>('/queue/board')
      .then((response) => {
        if (active) {
          listener(toArchitectureTickets(response.data))
        }
      })
      .catch((error) => {
        console.error('backendQueueApi.subscribeQueue failed', error)
      })

    return () => {
      active = false
    }
  },

  replaceQueue(_nextTickets: Ticket[]): void {
    throw new Error('queueApi.replaceQueue is available only in mock API mode.')
  },
}
