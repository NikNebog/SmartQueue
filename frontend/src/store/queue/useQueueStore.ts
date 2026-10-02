import { create } from 'zustand'
import { getApiErrorMessage, queueApi, socketClient } from '@services/api'
import { getRoomQueuePeopleAhead, getTicketPeopleAhead } from '@shared/utils'
import { useGlobalStore } from '@store/global'
import type {
  AnalyticsPoint,
  QueueEvent,
  QueueKpi,
  QueueRecommendation,
  QueueSnapshot,
  RedirectTicketInput,
  Room,
  Ticket,
  TicketCreateInput,
} from '@shared/types'

type QueueState = {
  analytics: AnalyticsPoint[]
  activeTickets: Ticket[]
  error: string | null
  events: QueueEvent[]
  hydrated: boolean
  kpi: QueueKpi
  lastUpdatedAt?: string
  loading: boolean
  noShowTickets: Ticket[]
  postponedTickets: Ticket[]
  recommendations: QueueRecommendation[]
  returnedTicketOverrides: Record<string, Ticket>
  rooms: Room[]
  selectedTicketId?: string
  statusMessage: string | null
  tickets: Ticket[]
  callNextTicket: (roomId: string) => Promise<void>
  completeService: (ticketId: string) => Promise<void>
  createTicket: (input: TicketCreateInput) => Promise<Ticket | undefined>
  loadQueue: (options?: { force?: boolean; successMessage?: string }) => Promise<void>
  loadRoomQueue: (roomId: string | number, options?: { silent?: boolean }) => Promise<void>
  loadRoomNoShowTickets: (roomId: string | number, options?: { silent?: boolean }) => Promise<void>
  loadRoomPostponedTickets: (roomId: string | number, options?: { silent?: boolean }) => Promise<void>
  postponeTicket: (ticketId: string) => Promise<void>
  redirectTicket: (input: RedirectTicketInput) => Promise<void>
  refreshAnalyticsData: () => Promise<void>
  resolveRecommendation: (id: string) => Promise<void>
  resolveRecommendations: (ids: string[]) => Promise<{ failedCount: number; hiddenIds: string[] }>
  returnTicket: (ticketId: string, roomId?: string | number) => Promise<void>
  selectTicket: (ticketId?: string) => void
  skipTicket: (ticketId: string) => Promise<void>
  startRealtime: () => void
  stopRealtime: () => void
  startService: (ticketId: string) => Promise<void>
}

const emptyKpi: QueueKpi = {
  activeTickets: 0,
  averageWaitMinutes: 0,
  completedToday: 0,
  overloadedRooms: 0,
}

const defaultSuccessMessage = 'Данные успешно обновлены'
const defaultErrorMessage = 'Не удалось загрузить данные'
const activeTicketStatuses = new Set<Ticket['status']>(['waiting', 'called', 'in_service', 'redirected'])
const warnedReturnedNoShowIds = new Set<string>()
let realtimeUnsubscribe: (() => void) | undefined

function getCurrentUserRoomIds(): string[] {
  const user = useGlobalStore.getState().user

  if (!user) {
    return []
  }

  return Array.from(new Set([
    user.roomId,
    ...(user.roomIds ?? []),
  ].filter((roomId) => roomId !== undefined && roomId !== null).map(String)))
}

function getQueueErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, defaultErrorMessage)
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  return (error as { response?: { status?: number } }).response?.status
}

function isRecommendationResolveUnsupported(error: unknown): boolean {
  const status = getHttpStatus(error)

  return status === 404 || status === 405 || status === 501
}

function isActiveTicket(ticket: Ticket): boolean {
  return activeTicketStatuses.has(ticket.status)
}

function isNoShowTicket(ticket: Ticket): boolean {
  return ticket.status === 'no_show'
}

function isPostponedTicket(ticket: Ticket): boolean {
  return ticket.status === 'postponed'
}

function isReturnedActiveTicket(ticket?: Ticket): boolean {
  return ticket?.status === 'waiting' || ticket?.status === 'in_service'
}

function getEventTime(event: QueueEvent): number {
  const timestamp = Date.parse(event.createdAt ?? event.occurredAt)

  return Number.isFinite(timestamp) ? timestamp : 0
}

function mergeQueueEvents(...eventGroups: QueueEvent[][]): QueueEvent[] {
  const eventMap = new Map<string, QueueEvent>()

  eventGroups.flat().forEach((event) => {
    eventMap.set(event.id, {
      ...event,
      createdAt: event.createdAt ?? event.occurredAt,
      occurredAt: event.occurredAt ?? event.createdAt,
    })
  })

  return Array.from(eventMap.values())
    .sort((left, right) => getEventTime(right) - getEventTime(left))
    .slice(0, 50)
}

function mergeTicketsById(...ticketGroups: Ticket[][]): Ticket[] {
  const ticketMap = new Map<string, Ticket>()

  ticketGroups.flat().forEach((ticket) => {
    ticketMap.set(ticket.id, ticket)
  })

  return Array.from(ticketMap.values())
}

function mergeRoomPreservingMetadata(nextRoom: Room, currentRoom?: Room): Room {
  if (!currentRoom) {
    return nextRoom
  }

  return {
    ...currentRoom,
    ...nextRoom,
    department: nextRoom.department ?? currentRoom.department,
    isTicketIssueEnabled: nextRoom.isTicketIssueEnabled ?? currentRoom.isTicketIssueEnabled,
    kioskEnabled: nextRoom.kioskEnabled ?? currentRoom.kioskEnabled,
    number: nextRoom.number ?? currentRoom.number,
    placeType: nextRoom.placeType ?? currentRoom.placeType,
    serviceTypeId: nextRoom.serviceTypeId ?? currentRoom.serviceTypeId,
    serviceTypeIds: nextRoom.serviceTypeIds ?? currentRoom.serviceTypeIds,
    serviceTypes: nextRoom.serviceTypes ?? currentRoom.serviceTypes,
    services: nextRoom.services ?? currentRoom.services,
    specialistName: nextRoom.specialistName ?? currentRoom.specialistName,
    ticketIssueEnabled: nextRoom.ticketIssueEnabled ?? currentRoom.ticketIssueEnabled,
    workEndTime: nextRoom.workEndTime ?? currentRoom.workEndTime,
    workStartTime: nextRoom.workStartTime ?? currentRoom.workStartTime,
    workingEndTime: nextRoom.workingEndTime ?? currentRoom.workingEndTime,
    workingStartTime: nextRoom.workingStartTime ?? currentRoom.workingStartTime,
  }
}

function mergeRoomsPreservingMetadata(nextRooms: Room[], currentRooms: Room[]): Room[] {
  const currentRoomsById = new Map(currentRooms.map((room) => [String(room.id), room]))

  return nextRooms.map((room) => mergeRoomPreservingMetadata(room, currentRoomsById.get(String(room.id))))
}

function replaceRoomTickets(currentTickets: Ticket[], roomTickets: Ticket[], roomId: string | number): Ticket[] {
  const roomIdValue = String(roomId)

  return mergeTicketsById(
    currentTickets.filter((ticket) => String(ticket.roomId) !== roomIdValue),
    roomTickets,
  )
}

function warnReturnedNoShow(ticketId: string): void {
  if (!import.meta.env.DEV || warnedReturnedNoShowIds.has(ticketId)) {
    return
  }

  warnedReturnedNoShowIds.add(ticketId)
  console.warn('Backend вернул талон как no_show после успешного возврата')
}

function applyReturnedOverrides(
  tickets: Ticket[],
  returnedTicketOverrides: Record<string, Ticket>,
): { returnedTicketOverrides: Record<string, Ticket>; tickets: Ticket[] } {
  const nextOverrides = { ...returnedTicketOverrides }
  const visibleTickets: Ticket[] = []

  tickets.forEach((ticket) => {
    const returnedTicket = nextOverrides[ticket.id]

    if (!returnedTicket) {
      visibleTickets.push(ticket)
      return
    }

    if (ticket.status === 'no_show') {
      warnReturnedNoShow(ticket.id)
      return
    }

    delete nextOverrides[ticket.id]
    visibleTickets.push(ticket)
  })

  return {
    returnedTicketOverrides: nextOverrides,
    tickets: mergeTicketsById(visibleTickets, Object.values(nextOverrides)),
  }
}

function getClosedTickets(tickets: Ticket[]): Ticket[] {
  return tickets.filter((ticket) => !isActiveTicket(ticket) && !isNoShowTicket(ticket) && !isPostponedTicket(ticket))
}

function createSnapshotUpdate(
  snapshot: Pick<QueueState, 'analytics' | 'events' | 'kpi' | 'recommendations' | 'rooms'> & { tickets: Ticket[] },
  state: QueueState,
) {
  const resolved = applyReturnedOverrides(snapshot.tickets, state.returnedTicketOverrides)
  const activeTickets = resolved.tickets.filter(isActiveTicket)
  const noShowTickets = resolved.tickets.filter(isNoShowTicket)
  const postponedTickets = resolved.tickets.filter(isPostponedTicket)

  return {
    ...snapshot,
    activeTickets,
    noShowTickets,
    postponedTickets,
    events: mergeQueueEvents(snapshot.events, state.events),
    returnedTicketOverrides: resolved.returnedTicketOverrides,
    rooms: mergeRoomsPreservingMetadata(snapshot.rooms, state.rooms),
    tickets: resolved.tickets,
  }
}

function createRoomActiveUpdate(
  snapshot: Pick<QueueState, 'analytics' | 'events' | 'kpi' | 'recommendations' | 'rooms'> & { tickets: Ticket[] },
  state: QueueState,
  roomId: string | number,
) {
  const resolved = applyReturnedOverrides(snapshot.tickets, state.returnedTicketOverrides)
  const nextRoomActiveTickets = resolved.tickets.filter(isActiveTicket)
  const activeTickets = replaceRoomTickets(state.activeTickets, nextRoomActiveTickets, roomId)
  const tickets = mergeTicketsById(getClosedTickets(state.tickets), activeTickets, state.noShowTickets, state.postponedTickets)

  return {
    ...snapshot,
    activeTickets,
    events: mergeQueueEvents(snapshot.events, state.events),
    noShowTickets: state.noShowTickets,
    postponedTickets: state.postponedTickets,
    returnedTicketOverrides: resolved.returnedTicketOverrides,
    rooms: mergeRoomsPreservingMetadata(snapshot.rooms, state.rooms),
    tickets,
  }
}

function createRoomSnapshotUpdate(
  snapshot: Pick<QueueState, 'analytics' | 'events' | 'kpi' | 'recommendations' | 'rooms'> & { tickets: Ticket[] },
  state: QueueState,
  roomId: string | number,
) {
  const roomIdValue = String(roomId)
  const resolved = applyReturnedOverrides(snapshot.tickets, state.returnedTicketOverrides)
  const roomTickets = resolved.tickets.filter((ticket) => String(ticket.roomId) === roomIdValue)
  const activeTickets = replaceRoomTickets(state.activeTickets, roomTickets.filter(isActiveTicket), roomId)
  const noShowTickets = replaceRoomTickets(state.noShowTickets, roomTickets.filter(isNoShowTicket), roomId)
  const postponedTickets = replaceRoomTickets(state.postponedTickets, roomTickets.filter(isPostponedTicket), roomId)
  const newClosedTickets = roomTickets.filter((ticket) => !isActiveTicket(ticket) && !isNoShowTicket(ticket) && !isPostponedTicket(ticket))

  return {
    ...snapshot,
    activeTickets,
    events: mergeQueueEvents(snapshot.events, state.events),
    noShowTickets,
    postponedTickets,
    returnedTicketOverrides: resolved.returnedTicketOverrides,
    rooms: mergeRoomsPreservingMetadata(snapshot.rooms, state.rooms),
    tickets: mergeTicketsById(getClosedTickets(state.tickets), newClosedTickets, activeTickets, noShowTickets, postponedTickets),
  }
}

function createRoomNoShowUpdate(noShowSnapshotTickets: Ticket[], state: QueueState, roomId: string | number) {
  const resolved = applyReturnedOverrides(noShowSnapshotTickets, state.returnedTicketOverrides)
  const activeFromOverrides = resolved.tickets.filter(isActiveTicket)
  const roomNoShowTickets = resolved.tickets.filter(isNoShowTicket)
  const activeTickets = mergeTicketsById(state.activeTickets, activeFromOverrides)
  const noShowTickets = replaceRoomTickets(state.noShowTickets, roomNoShowTickets, roomId)

  return {
    activeTickets,
    noShowTickets,
    postponedTickets: state.postponedTickets,
    returnedTicketOverrides: resolved.returnedTicketOverrides,
    tickets: mergeTicketsById(getClosedTickets(state.tickets), activeTickets, noShowTickets, state.postponedTickets),
  }
}

function createRoomPostponedUpdate(postponedSnapshotTickets: Ticket[], state: QueueState, roomId: string | number) {
  const roomPostponedTickets = postponedSnapshotTickets.filter(isPostponedTicket)
  const postponedTickets = replaceRoomTickets(state.postponedTickets, roomPostponedTickets, roomId)

  return {
    postponedTickets,
    tickets: mergeTicketsById(getClosedTickets(state.tickets), state.activeTickets, state.noShowTickets, postponedTickets),
  }
}

async function getRoomSnapshotWithNoShow(roomId: string | number): Promise<{
  roomId: string | number
  snapshot: QueueSnapshot
}> {
  const [snapshot, noShowTickets, postponedTickets] = await Promise.all([
    queueApi.getRoomQueueSnapshot(roomId),
    queueApi.getRoomNoShowTickets(roomId),
    queueApi.getRoomPostponedTickets(roomId),
  ])

  return {
    roomId,
    snapshot: {
      ...snapshot,
      tickets: mergeTicketsById(snapshot.tickets, noShowTickets, postponedTickets),
    },
  }
}

export const useQueueStore = create<QueueState>((set, get) => ({
  activeTickets: [],
  analytics: [],
  error: null,
  events: [],
  hydrated: false,
  kpi: emptyKpi,
  loading: false,
  noShowTickets: [],
  postponedTickets: [],
  recommendations: [],
  returnedTicketOverrides: {},
  rooms: [],
  statusMessage: null,
  tickets: [],

  callNextTicket: async (roomId) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.callNextTicket(roomId)
      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        statusMessage: defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue call next failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  completeService: async (ticketId) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.completeService(ticketId)
      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        statusMessage: defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue complete service failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  createTicket: async (input) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const before = get().tickets
      const peopleAhead = getRoomQueuePeopleAhead(input.roomId, before)
      const snapshot = await queueApi.createTicket(input)
      const createdTicket = snapshot.tickets.find(
        (ticket) => !before.some((item) => item.id === ticket.id),
      )
      const enrichedCreatedTicket = createdTicket
        ? {
            ...createdTicket,
            peopleAhead: getTicketPeopleAhead(createdTicket, peopleAhead),
            queuePosition: createdTicket.queuePosition ?? getTicketPeopleAhead(createdTicket, peopleAhead) + 1,
          }
        : undefined
      const nextSnapshot = enrichedCreatedTicket
        ? {
            ...snapshot,
            tickets: snapshot.tickets.map((ticket) => (
              ticket.id === enrichedCreatedTicket.id ? enrichedCreatedTicket : ticket
            )),
          }
        : snapshot

      set((state) => ({
        ...createSnapshotUpdate(nextSnapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        selectedTicketId: enrichedCreatedTicket?.id,
        statusMessage: defaultSuccessMessage,
      }))

      return enrichedCreatedTicket
    } catch (error) {
      console.error('Queue ticket create failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  loadQueue: async (options) => {
    if (get().loading && !options?.force) {
      return
    }

    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.getQueueSnapshot()
      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        statusMessage: options?.successMessage ?? defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue load failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
    }
  },

  loadRoomQueue: async (roomId, options) => {
    if (!options?.silent) {
      set({ error: null, loading: true, statusMessage: null })
    }

    try {
      const snapshot = await queueApi.getRoomQueueSnapshot(roomId)
      const roomIdValue = String(roomId)
      const currentRoom = get().rooms.find((room) => String(room.id) === roomIdValue)
      const snapshotHasRoom = snapshot.rooms.some((room) => String(room.id) === roomIdValue)
      set((state) => ({
        ...createRoomActiveUpdate(snapshot, state, roomId),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: options?.silent ? state.loading : false,
        rooms: mergeRoomsPreservingMetadata(
          snapshotHasRoom || !currentRoom ? snapshot.rooms : [currentRoom, ...snapshot.rooms],
          state.rooms,
        ),
        statusMessage: options?.silent ? state.statusMessage : defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Ошибка загрузки очереди:', error)
      set((state) => ({
        error: getQueueErrorMessage(error),
        loading: options?.silent ? state.loading : false,
        statusMessage: options?.silent ? state.statusMessage : null,
      }))
    }
  },

  loadRoomNoShowTickets: async (roomId, options) => {
    if (!options?.silent) {
      set({ error: null, loading: true, statusMessage: null })
    }

    try {
      const tickets = await queueApi.getRoomNoShowTickets(roomId)

      set((state) => ({
        ...createRoomNoShowUpdate(tickets, state, roomId),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: options?.silent ? state.loading : false,
        statusMessage: options?.silent ? state.statusMessage : defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue no-show load failed', error)
      set((state) => ({
        error: getQueueErrorMessage(error),
        loading: options?.silent ? state.loading : false,
        statusMessage: options?.silent ? state.statusMessage : null,
      }))
    }
  },

  loadRoomPostponedTickets: async (roomId, options) => {
    if (!options?.silent) {
      set({ error: null, loading: true, statusMessage: null })
    }

    try {
      const tickets = await queueApi.getRoomPostponedTickets(roomId)

      set((state) => ({
        ...createRoomPostponedUpdate(tickets, state, roomId),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: options?.silent ? state.loading : false,
        statusMessage: options?.silent ? state.statusMessage : defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue postponed tickets load failed', error)
      set((state) => ({
        error: getQueueErrorMessage(error),
        loading: options?.silent ? state.loading : false,
        statusMessage: options?.silent ? state.statusMessage : null,
      }))
    }
  },

  postponeTicket: async (ticketId) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.postponeTicket(ticketId)
      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        selectedTicketId: undefined,
        statusMessage: defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue postpone ticket failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  redirectTicket: async (input) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const previousRoomId = get().tickets.find((ticket) => ticket.id === input.ticketId)?.roomId
        ?? get().activeTickets.find((ticket) => ticket.id === input.ticketId)?.roomId
      const snapshot = await queueApi.redirectTicket(input)
      const redirectedTicket = snapshot.tickets.find((ticket) => ticket.id === input.ticketId)
      const roomIds = Array.from(new Set(
        [previousRoomId, input.roomId]
          .filter((roomId): roomId is string | number => roomId !== undefined)
          .map(String),
      ))
      const roomResults = await Promise.allSettled(roomIds.map(getRoomSnapshotWithNoShow))

      set((state) => {
        let nextState: QueueState = {
          ...state,
          ...createSnapshotUpdate(snapshot, state),
          error: null,
          hydrated: true,
          lastUpdatedAt: new Date().toISOString(),
          loading: false,
          statusMessage: defaultSuccessMessage,
        }

        roomResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            nextState = {
              ...nextState,
              ...createRoomSnapshotUpdate(result.value.snapshot, nextState, result.value.roomId),
            }
          }
        })

        if (redirectedTicket && isActiveTicket(redirectedTicket)) {
          const activeTickets = mergeTicketsById(
            nextState.activeTickets.filter((ticket) => ticket.id !== redirectedTicket.id),
            [redirectedTicket],
          )
          const noShowTickets = nextState.noShowTickets.filter((ticket) => ticket.id !== redirectedTicket.id)

          nextState = {
            ...nextState,
            activeTickets,
            noShowTickets,
            tickets: mergeTicketsById(getClosedTickets(nextState.tickets), activeTickets, noShowTickets),
          }
        }

        return nextState
      })
    } catch (error) {
      console.error('Queue redirect ticket failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  refreshAnalyticsData: async () => {
    await get().loadQueue({
      force: true,
      successMessage: 'Аналитика обновлена',
    })
  },

  resolveRecommendation: async (id) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.resolveRecommendation(id)

      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        statusMessage: 'Уведомление закрыто',
      }))
    } catch (error) {
      console.error('Queue resolve recommendation failed', error)
      set((state) => ({
        error: null,
        loading: false,
        recommendations: state.recommendations.filter((recommendation) => recommendation.id !== id),
        statusMessage: 'Уведомление закрыто',
      }))
    }
  },

  resolveRecommendations: async (ids) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean)

    if (uniqueIds.length === 0) {
      return { failedCount: 0, hiddenIds: [] }
    }

    set({ error: null, loading: true, statusMessage: null })

    const results = await Promise.allSettled(
      uniqueIds.map((id) => queueApi.resolveRecommendation(id)),
    )
    const hiddenIds = results.flatMap((result, index) => (
      result.status === 'fulfilled' || isRecommendationResolveUnsupported(result.reason)
        ? [uniqueIds[index]]
        : []
    ))
    const failedCount = uniqueIds.length - hiddenIds.length

    try {
      if (results.some((result) => result.status === 'fulfilled')) {
        const snapshot = await queueApi.getQueueSnapshot()

        set((state) => ({
          ...createSnapshotUpdate(snapshot, state),
          error: failedCount > 0 ? 'Не удалось закрыть часть уведомлений' : null,
          hydrated: true,
          lastUpdatedAt: new Date().toISOString(),
          loading: false,
          recommendations: snapshot.recommendations.filter(
            (recommendation) => !hiddenIds.includes(recommendation.id),
          ),
          statusMessage: failedCount > 0 ? null : 'Все уведомления закрыты',
        }))
      } else {
        set((state) => ({
          error: failedCount > 0 ? 'Не удалось закрыть часть уведомлений' : null,
          loading: false,
          recommendations: state.recommendations.filter(
            (recommendation) => !hiddenIds.includes(recommendation.id),
          ),
          statusMessage: failedCount > 0 ? null : 'Уведомления скрыты до следующей загрузки',
        }))
      }
    } catch (error) {
      console.error('Queue resolve recommendations refresh failed', error)
      set((state) => ({
        error: failedCount > 0 ? 'Не удалось закрыть часть уведомлений' : null,
        loading: false,
        recommendations: state.recommendations.filter(
          (recommendation) => !hiddenIds.includes(recommendation.id),
        ),
        statusMessage: failedCount > 0 ? null : 'Все уведомления закрыты',
      }))
    }

    return { failedCount, hiddenIds }
  },

  returnTicket: async (ticketId, roomId) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const currentTicket = get().tickets.find((ticket) => ticket.id === ticketId)
        ?? get().noShowTickets.find((ticket) => ticket.id === ticketId)
        ?? get().postponedTickets.find((ticket) => ticket.id === ticketId)
      const currentRoomId = roomId ?? currentTicket?.roomId
      const snapshot = await queueApi.returnTicket(ticketId, currentRoomId)
      const returnedTicket = snapshot.tickets.find((ticket) => ticket.id === ticketId) ?? currentTicket

      if (!isReturnedActiveTicket(returnedTicket)) {
        throw new Error('Сервер не вернул пациента в очередь')
      }

      set((state) => {
        const nextState: QueueState = currentRoomId !== undefined
          ? {
              ...state,
              ...createRoomSnapshotUpdate(snapshot, state, currentRoomId),
            }
          : {
              ...state,
              ...createSnapshotUpdate(snapshot, state),
            }

        return {
          ...nextState,
          error: null,
          hydrated: true,
          lastUpdatedAt: new Date().toISOString(),
          loading: false,
          selectedTicketId: ticketId,
          statusMessage: defaultSuccessMessage,
        }
      })
    } catch (error) {
      console.error('Queue return ticket failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  selectTicket: (ticketId) => set({ selectedTicketId: ticketId }),

  skipTicket: async (ticketId) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.skipTicket(ticketId)
      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        selectedTicketId: undefined,
        statusMessage: defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue skip ticket failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },

  startRealtime: () => {
    if (realtimeUnsubscribe) {
      return
    }

    realtimeUnsubscribe = socketClient.subscribe((event) => {
      set((state) => ({
        events: mergeQueueEvents([event], state.events),
      }))

      const user = useGlobalStore.getState().user

      if (user?.role === 'specialist') {
        const roomIds = getCurrentUserRoomIds()

        if (roomIds.length === 0) {
          return
        }

        void Promise.allSettled(roomIds.map(getRoomSnapshotWithNoShow))
          .then((results) => {
            set((state) => {
              let nextState: QueueState = {
                ...state,
                error: null,
                hydrated: true,
                lastUpdatedAt: new Date().toISOString(),
                loading: state.loading,
                statusMessage: state.statusMessage,
              }

              results.forEach((result) => {
                if (result.status === 'fulfilled') {
                  nextState = {
                    ...nextState,
                    ...createRoomSnapshotUpdate(result.value.snapshot, nextState, result.value.roomId),
                  }
                }
              })

              return nextState
            })
          })
          .catch((error) => {
            console.error('Queue realtime refresh failed', error)
          })

        return
      }

      void queueApi.getQueueSnapshot()
        .then((snapshot) => {
          set((state) => ({
            ...createSnapshotUpdate(snapshot, state),
            error: null,
            hydrated: true,
            lastUpdatedAt: new Date().toISOString(),
            loading: state.loading,
            statusMessage: state.statusMessage,
          }))
        })
        .catch((error) => {
          console.error('Queue realtime refresh failed', error)
        })
    })
    socketClient.connect()
  },

  stopRealtime: () => {
    realtimeUnsubscribe?.()
    realtimeUnsubscribe = undefined
    socketClient.disconnect()
  },

  startService: async (ticketId) => {
    set({ error: null, loading: true, statusMessage: null })

    try {
      const snapshot = await queueApi.startService(ticketId)
      set((state) => ({
        ...createSnapshotUpdate(snapshot, state),
        error: null,
        hydrated: true,
        lastUpdatedAt: new Date().toISOString(),
        loading: false,
        statusMessage: defaultSuccessMessage,
      }))
    } catch (error) {
      console.error('Queue start service failed', error)
      set({ error: getQueueErrorMessage(error), loading: false, statusMessage: null })
      throw error
    }
  },
}))
