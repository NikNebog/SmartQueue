import type {
  AnalyticsPoint,
  QueueKpi,
  QueueRecommendation,
  QueueSnapshot,
  Room,
  ServiceType,
  Ticket,
  TicketCreateInput,
  TicketPriority,
  TicketStatus,
} from '@shared/types'
import { isSmartQLanguage } from '@shared/locales/types'
import {
  formatWaitingTime,
  getAverageWaitingMinutes,
  getWaitingMinutes,
} from '@shared/utils/time'
import { formatRoomName } from '@shared/utils/room'
import { createRoomWorkTimeRecommendation } from '@shared/utils/workingHours'
import { ticketLanguageService } from '@services/ticketLanguageService'
import { planRoomLoads } from '@shared/utils/queuePlanning'
import type {
  Room as ArchitectureRoom,
  ServiceType as ArchitectureServiceType,
  Ticket as ArchitectureTicket,
  TicketPriority as ArchitectureTicketPriority,
  TicketStatus as ArchitectureTicketStatus,
} from '../../types'

export type BackendTicketStatus =
  | 'created'
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'postponed'
  | 'redirected'

export type BackendServiceType = {
  id: number | string
  code?: string
  name: string
  nameEn?: string | null
  nameKk?: string | null
  name_en?: string | null
  name_kk?: string | null
  averageDurationMinutes?: number
  priorityWeight?: number
}

export type BackendRoom = {
  _id?: number | string
  active?: boolean
  estimatedWaitMinutes?: number | string | null
  id?: number | string
  isActive?: boolean
  isTicketIssueEnabled?: boolean
  kioskEnabled?: boolean
  name?: string
  number?: number | string
  place_type?: string
  placeType?: string
  room_id?: number | string
  room_name?: string
  roomId?: number | string
  roomName?: string
  serviceTypeId?: number | string
  services?: unknown[]
  serviceTypeIds?: Array<number | string>
  serviceTypes?: unknown[]
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

export type BackendTicket = {
  assignedRoom?: BackendRoom | null
  assignedRoomId?: number | string | null
  assignedTo?: number | string | null
  assigned_to?: number | string | null
  called_at?: string | null
  doctor?: { _id?: number | string; id?: number | string } | null
  doctorId?: number | string | null
  doctor_id?: number | string | null
  id: number | string
  number?: string
  priority?: number
  status?: BackendTicketStatus | string
  etaMinutes?: number | null
  waitMinutes?: number | null
  peopleAhead?: number | string | null
  people_ahead?: number | string | null
  position?: number | string | null
  queuePosition?: number | string | null
  queue_position?: number | string | null
  language?: unknown
  serviceTypeId?: number | string
  serviceTypeName?: string | null
  serviceName?: string | null
  room_id?: number | string | null
  room_name?: string | null
  roomId?: number | string | null
  destinationRoomId?: number | string | null
  newRoomId?: number | string | null
  redirectedToRoomId?: number | string | null
  targetRoomId?: number | string | null
  toRoomId?: number | string | null
  createdAt?: string
  created_at?: string
  updatedAt?: string | null
  updated_at?: string | null
  calledAt?: string | null
  serviceStartedAt?: string | null
  service_started_at?: string | null
  startedAt?: string | null
  completedAt?: string | null
  completed_at?: string | null
  ticketNumber?: string
  serviceType?: BackendServiceType
  service?: BackendServiceType
  room?: BackendRoom | null
  roomName?: string | null
  specialist?: { _id?: number | string; id?: number | string } | null
  specialistId?: number | string | null
  specialist_id?: number | string | null
  user?: { _id?: number | string; id?: number | string } | null
  userId?: number | string | null
  user_id?: number | string | null
  events?: Array<{
    id?: number | string
    eventType?: string
    event_type?: string
    oldStatus?: BackendTicketStatus | string | null
    old_status?: BackendTicketStatus | string | null
    newStatus?: BackendTicketStatus | string | null
    new_status?: BackendTicketStatus | string | null
    payload?: Record<string, unknown> | null
    createdAt?: string
    created_at?: string
  }>
}

export type BackendQueueStats = {
  roomId: number | string
  roomName: string
  activeTickets: number
  avgServiceMinutes: number
  etaMinutes: number
}

export type BackendOverloadRoom = {
  roomId: number | string
  roomName: string
  queueCount: number
}

export type BackendRecommendation = {
  _id?: number | string
  action?: string
  createdAt?: string
  created_at?: string
  description?: string
  id?: number | string
  isRead?: boolean
  isResolved?: boolean
  is_resolved?: boolean
  level?: string
  message?: string
  read?: boolean
  relatedRoomId?: number | string
  resolved?: boolean
  roomId?: number | string
  roomName?: string
  severity?: string
  text?: string
  ticketId?: number | string
  ticket_id?: number | string
  ticketNumber?: string
  title?: string
}

export type BackendAnalyticsPoint = {
  averageWaitMinutes?: number | string | null
  average_wait_minutes?: number | string | null
  avgServiceMinutes?: number | string | null
  avgWaitMinutes?: number | string | null
  avg_wait_minutes?: number | string | null
  completed?: number | string | null
  completedCount?: number | string | null
  completed_count?: number | string | null
  completedTickets?: number | string | null
  date?: string | number | null
  hour?: string | number | null
  label?: string | number | null
  period?: string | number | null
  roomName?: string | number | null
  serviceName?: string | number | null
  time?: string | number | null
  waiting?: number | string | null
  waitingCount?: number | string | null
  waiting_count?: number | string | null
  waitingTickets?: number | string | null
}

const serviceTypeByBackendId: Record<number, ServiceType> = {
  1: 'consultation',
  2: 'billing',
  3: 'diagnostics',
  4: 'laboratory',
  5: 'registration',
}

const backendIdByServiceType: Record<ServiceType, number> = {
  billing: 2,
  consultation: 1,
  diagnostics: 3,
  laboratory: 4,
  pharmacy: 5,
  registration: 5,
}

const serviceTypeByBackendName: Record<string, ServiceType> = {
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
  диагностика: 'diagnostics',
  другое: 'registration',
  консультация: 'consultation',
  лаборатория: 'laboratory',
  оплата: 'billing',
  регистрация: 'registration',
  рентген: 'diagnostics',
}

const architectureServiceByBackendName: Record<string, ArchitectureServiceType['code']> = {
  analysis: 'analysis',
  consultation: 'consultation',
  other: 'consultation',
  payment: 'consultation',
  xray: 'xray',
}

function toId(value?: number | string | null): string {
  return value == null ? '' : String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRecordString(record: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number') {
      return String(value)
    }
  }

  return fallback
}

function getRecordBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'boolean') {
      return value
    }
  }

  return undefined
}

function getRecordNumber(record: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const numberValue = Number(value)

      if (Number.isFinite(numberValue)) {
        return numberValue
      }
    }
  }

  return fallback
}

function getRecordNumberOptional(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const numberValue = Number(value)

      if (Number.isFinite(numberValue)) {
        return numberValue
      }
    }
  }

  return undefined
}

function getBackendRoomId(room?: BackendRoom | null): string {
  return toId(room?.id ?? room?.roomId ?? room?.room_id ?? room?._id)
}

function getBackendRoomName(room?: BackendRoom | null): string {
  return formatRoomName({
    id: room?.id ?? room?.roomId ?? room?.room_id ?? room?._id,
    name: room?.name,
    number: room?.number,
    placeType: room?.placeType ?? room?.place_type,
    roomName: room?.roomName ?? room?.room_name,
    title: room?.title,
  })
}

export function getBackendTicketRoomId(ticket: BackendTicket): string {
  const redirectedRoomId = ticket.status?.trim().toLowerCase().replace(/-/g, '_') === 'redirected'
    ? toId(
        ticket.newRoomId
        ?? ticket.targetRoomId
        ?? ticket.destinationRoomId
        ?? ticket.redirectedToRoomId
        ?? ticket.toRoomId,
      )
    : ''

  if (redirectedRoomId) {
    return redirectedRoomId
  }

  const roomId = toId(ticket.roomId ?? ticket.room_id)

  if (roomId) {
    return roomId
  }

  const nestedRoomId = getBackendRoomId(ticket.room)

  if (nestedRoomId) {
    return nestedRoomId
  }

  const assignedRoomId = toId(ticket.assignedRoomId)

  if (assignedRoomId) {
    return assignedRoomId
  }

  return getBackendRoomId(ticket.assignedRoom)
}

function getBackendTicketRoomName(ticket: BackendTicket): string {
  const nestedRoomName = ticket.room?.name ?? ticket.room?.title ?? ticket.room?.roomName ?? ticket.room?.room_name

  if (nestedRoomName) {
    return formatRoomName({
      id: getBackendRoomId(ticket.room),
      name: nestedRoomName,
      number: ticket.room?.number,
      placeType: ticket.room?.placeType ?? ticket.room?.place_type,
    })
  }

  const directRoomName = ticket.roomName?.trim()

  if (directRoomName) {
    return formatRoomName({
      id: getBackendTicketRoomId(ticket),
      name: directRoomName,
    })
  }

  const snakeRoomName = ticket.room_name?.trim()

  if (snakeRoomName) {
    return formatRoomName({
      id: getBackendTicketRoomId(ticket),
      name: snakeRoomName,
    })
  }

  const assignedRoomName = ticket.assignedRoom?.name
    ?? ticket.assignedRoom?.title
    ?? ticket.assignedRoom?.roomName
    ?? ticket.assignedRoom?.room_name

  if (assignedRoomName) {
    return formatRoomName({
      id: getBackendRoomId(ticket.assignedRoom),
      name: assignedRoomName,
      number: ticket.assignedRoom?.number,
      placeType: ticket.assignedRoom?.placeType ?? ticket.assignedRoom?.place_type,
    })
  }

  const roomId = getBackendTicketRoomId(ticket)

  return formatRoomName({ id: roomId })
}

function getBackendRoomActive(room?: BackendRoom | null): boolean {
  if (!room) {
    return true
  }

  if (typeof room.isActive === 'boolean') {
    return room.isActive
  }

  if (typeof room.active === 'boolean') {
    return room.active
  }

  return room.status !== 'paused' && room.status !== 'inactive' && room.status !== 'deleted'
}

function getBackendRoomTicketIssueEnabled(room?: BackendRoom | null): boolean {
  if (!room) {
    return true
  }

  return (room.ticketIssueEnabled ?? room.isTicketIssueEnabled ?? room.kioskEnabled) !== false
}

export function toBackendRooms(value: unknown): BackendRoom[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as BackendRoom[]
  }

  if (!isRecord(value)) {
    return []
  }

  if (Array.isArray(value.rooms)) {
    return value.rooms.filter(isRecord) as BackendRoom[]
  }

  if (Array.isArray(value.data)) {
    return value.data.filter(isRecord) as BackendRoom[]
  }

  if (isRecord(value.data)) {
    return toBackendRooms(value.data)
  }

  return []
}

function getBackendServiceName(ticket: BackendTicket): string {
  return ticket.serviceType?.name?.trim().toLowerCase()
    ?? ticket.service?.name?.trim().toLowerCase()
    ?? ticket.serviceTypeName?.trim().toLowerCase()
    ?? ticket.serviceName?.trim().toLowerCase()
    ?? ''
}

function getBackendServiceDisplayName(ticket: BackendTicket): string {
  return ticket.serviceType?.name?.trim()
    ?? ticket.service?.name?.trim()
    ?? ticket.serviceTypeName?.trim()
    ?? ticket.serviceName?.trim()
    ?? ''
}

function getBackendTicketNumber(ticket: BackendTicket): string {
  return ticket.number ?? ticket.ticketNumber ?? `Талон ${toId(ticket.id)}`
}

function hasBackendCreatedAt(ticket: BackendTicket): boolean {
  return Boolean(ticket.createdAt ?? ticket.created_at)
}

function getBackendCreatedAt(ticket: BackendTicket): string {
  return ticket.createdAt ?? ticket.created_at ?? new Date().toISOString()
}

function getBackendCalledAt(ticket: BackendTicket): string | undefined {
  return ticket.calledAt ?? ticket.called_at ?? undefined
}

function getBackendUpdatedAt(ticket: BackendTicket): string | undefined {
  return ticket.updatedAt ?? ticket.updated_at ?? undefined
}

function getBackendBoardCalledAt(ticket: BackendTicket): string | undefined {
  return getBackendCalledAt(ticket)
}

function getBackendStartedAt(ticket: BackendTicket): string | undefined {
  return ticket.serviceStartedAt ?? ticket.service_started_at ?? ticket.startedAt ?? undefined
}

function getBackendCompletedAt(ticket: BackendTicket): string | undefined {
  return ticket.completedAt ?? ticket.completed_at ?? undefined
}

function getBackendTicketAssigneeId(ticket: BackendTicket): string {
  return toId(
    ticket.assignedTo
      ?? ticket.assigned_to
      ?? ticket.doctorId
      ?? ticket.doctor_id
      ?? ticket.specialistId
      ?? ticket.specialist_id
      ?? ticket.userId
      ?? ticket.user_id
      ?? ticket.doctor?.id
      ?? ticket.doctor?._id
      ?? ticket.specialist?.id
      ?? ticket.specialist?._id
      ?? ticket.user?.id
      ?? ticket.user?._id,
  )
}

function toSharedTicketEvents(ticket: BackendTicket): Ticket['events'] {
  return ticket.events?.map((event, index) => ({
    id: event.id ?? `${ticket.id}-${index}`,
    eventType: event.eventType ?? event.event_type ?? 'status_update',
    oldStatus: event.oldStatus || event.old_status ? toSharedStatus(event.oldStatus ?? event.old_status ?? undefined) : null,
    newStatus: event.newStatus || event.new_status ? toSharedStatus(event.newStatus ?? event.new_status ?? undefined) : null,
    payload: event.payload ?? null,
    createdAt: event.createdAt ?? event.created_at ?? getBackendCreatedAt(ticket),
  })) ?? []
}

function toSharedLanguage(value: unknown): Ticket['language'] {
  return isSmartQLanguage(value) ? value : undefined
}

export function toBackendServiceTypeId(serviceType: ServiceType): number {
  return backendIdByServiceType[serviceType]
}

export function toBackendPriority(priority?: TicketPriority | ArchitectureTicketPriority): number {
  if (priority === 'low') {
    return 1
  }

  if (priority === 'high') {
    return 4
  }

  if (priority === 'above_normal') {
    return 3
  }

  if (priority === 'critical') {
    return 5
  }

  return 2
}

export function toSharedPriority(priority = 2): TicketPriority {
  if (priority <= 1) {
    return 'low'
  }

  if (priority >= 5) {
    return 'critical'
  }

  if (priority >= 4) {
    return 'high'
  }

  if (priority >= 3) {
    return 'above_normal'
  }

  return 'normal'
}

export function toArchitecturePriority(priority = 2): ArchitectureTicketPriority {
  if (priority <= 1) {
    return 'low'
  }

  if (priority >= 3) {
    return 'high'
  }

  return 'normal'
}

export function toSharedStatus(status?: BackendTicketStatus | string): TicketStatus {
  const normalizedStatus = status?.trim().toLowerCase().replace(/-/g, '_')

  if (normalizedStatus === 'created') {
    return 'waiting'
  }

  if (
    normalizedStatus === 'completed' ||
    normalizedStatus === 'complete' ||
    normalizedStatus === 'finished' ||
    normalizedStatus === 'done'
  ) {
    return 'completed'
  }

  if (normalizedStatus === 'in_service' || normalizedStatus === 'service') {
    return 'in_service'
  }

  if (normalizedStatus === 'no_show' || normalizedStatus === 'noshow') {
    return 'no_show'
  }

  if (
    normalizedStatus === 'postponed' ||
    normalizedStatus === 'on_hold' ||
    normalizedStatus === 'hold' ||
    normalizedStatus === 'held' ||
    normalizedStatus === 'deferred'
  ) {
    return 'postponed'
  }

  if (
    normalizedStatus === 'waiting' ||
    normalizedStatus === 'called' ||
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'redirected'
  ) {
    return normalizedStatus
  }

  return 'waiting'
}

export function toArchitectureStatus(status?: BackendTicketStatus | string): ArchitectureTicketStatus {
  return toSharedStatus(status) as ArchitectureTicketStatus
}

export function toSharedServiceType(ticket: BackendTicket): ServiceType {
  const backendName = getBackendServiceName(ticket)

  if (backendName && serviceTypeByBackendName[backendName]) {
    return serviceTypeByBackendName[backendName]
  }

  const serviceTypeId = Number(ticket.serviceTypeId ?? ticket.serviceType?.id ?? ticket.service?.id)

  return serviceTypeByBackendId[serviceTypeId] ?? 'consultation'
}

export function toSharedTicket(ticket: BackendTicket): Ticket {
  const serviceType = toSharedServiceType(ticket)
  const roomId = getBackendTicketRoomId(ticket)
  const serviceTypeId = toId(ticket.serviceTypeId ?? ticket.serviceType?.id ?? ticket.service?.id)
  const assignedTo = getBackendTicketAssigneeId(ticket)
  const ticketRecord = ticket as Record<string, unknown>
  const peopleAhead = getRecordNumberOptional(ticketRecord, ['peopleAhead', 'people_ahead'])
  const queuePosition = getRecordNumberOptional(ticketRecord, ['queuePosition', 'queue_position', 'position'])

  return {
    id: toId(ticket.id),
    number: getBackendTicketNumber(ticket),
    patientName: `Пациент ${getBackendTicketNumber(ticket)}`,
    serviceType,
    serviceTypeId: serviceTypeId || undefined,
    serviceTypeName: getBackendServiceDisplayName(ticket) || undefined,
    priority: toSharedPriority(ticket.priority),
    status: toSharedStatus(ticket.status),
    createdAt: getBackendCreatedAt(ticket),
    hasActualCreatedAt: hasBackendCreatedAt(ticket),
    calledAt: getBackendCalledAt(ticket),
    startedAt: getBackendStartedAt(ticket),
    completedAt: getBackendCompletedAt(ticket),
    updatedAt: getBackendUpdatedAt(ticket),
    roomId: roomId || undefined,
    roomName: getBackendTicketRoomName(ticket),
    assignedTo: assignedTo || undefined,
    language: toSharedLanguage(ticket.language) ?? ticketLanguageService.getTicketLanguage(ticket.id),
    etaMinutes: ticket.etaMinutes ?? ticket.waitMinutes ?? 0,
    peopleAhead,
    queuePosition,
    events: toSharedTicketEvents(ticket),
  }
}

export function normalizeBoardTicket(ticket: BackendTicket): Ticket {
  const sharedTicket = toSharedTicket(ticket)

  return {
    ...sharedTicket,
    calledAt: getBackendBoardCalledAt(ticket),
    roomName: getBackendTicketRoomName(ticket),
    updatedAt: getBackendUpdatedAt(ticket),
  }
}

export function toSharedTickets(tickets: BackendTicket[]): Ticket[] {
  return tickets.map(toSharedTicket)
}

export function toArchitectureTicket(ticket: BackendTicket): ArchitectureTicket {
  const serviceName = getBackendServiceName(ticket)
  const code = architectureServiceByBackendName[serviceName] ?? 'consultation'
  const serviceType: ArchitectureServiceType = {
    id: toId(ticket.serviceTypeId ?? ticket.serviceType?.id ?? ticket.service?.id),
    code,
    name: serviceName || code,
  }
  const roomId = getBackendTicketRoomId(ticket)
  const room: ArchitectureRoom = {
    id: roomId,
    name: getBackendTicketRoomName(ticket),
    serviceTypes: [serviceType],
  }

  return {
    calledAt: getBackendCalledAt(ticket),
    completedAt: getBackendCompletedAt(ticket),
    createdAt: getBackendCreatedAt(ticket),
    id: toId(ticket.id),
    number: getBackendTicketNumber(ticket),
    serviceType,
    status: toArchitectureStatus(ticket.status),
    room,
    priority: toArchitecturePriority(ticket.priority),
    startedAt: getBackendStartedAt(ticket),
    eta: ticket.etaMinutes ?? ticket.waitMinutes ?? 0,
  }
}

export function toArchitectureTickets(tickets: BackendTicket[]): ArchitectureTicket[] {
  return tickets.map(toArchitectureTicket)
}

export function toArchitectureRooms(rooms: BackendRoom[]): ArchitectureRoom[] {
  return rooms
    .filter(getBackendRoomActive)
    .map((room) => ({
      id: getBackendRoomId(room),
      name: getBackendRoomName(room),
      serviceTypes: [],
    }))
    .filter((room) => room.id)
}

export function toBackendTicketCreateInput(input: TicketCreateInput): {
  language?: TicketCreateInput['language']
  priority: number
  roomId?: number
  serviceTypeId: number | string
} {
  const roomId = Number(input.roomId)
  const serviceTypeId = Number(input.serviceTypeId)

  return {
    priority: toBackendPriority(input.priority),
    ...(input.language ? { language: input.language } : {}),
    ...(Number.isFinite(roomId) ? { roomId } : {}),
    serviceTypeId: Number.isFinite(serviceTypeId)
      ? serviceTypeId
      : input.serviceTypeId ?? toBackendServiceTypeId(input.serviceType),
  }
}

export function toBackendArchitectureTicketCreateInput(input: {
  priority?: ArchitectureTicketPriority
  roomId?: string | number
  serviceTypeId: number | string
}): {
  priority: number
  roomId?: number
  serviceTypeId: number
} {
  const roomId = Number(input.roomId)

  return {
    priority: toBackendPriority(input.priority),
    ...(Number.isFinite(roomId) ? { roomId } : {}),
    serviceTypeId: Number(input.serviceTypeId),
  }
}

export function toSharedRooms(
  tickets: BackendTicket[],
  stats: BackendQueueStats[] = [],
  backendRooms: BackendRoom[] = [],
): Room[] {
  const rooms = new Map<string, Room>()
  const hasBackendRooms = backendRooms.length > 0
  const inactiveRoomIds = new Set(
    backendRooms
      .filter((room) => !getBackendRoomActive(room))
      .map(getBackendRoomId)
      .filter(Boolean),
  )

  backendRooms.forEach((room) => {
    const id = getBackendRoomId(room)

    if (!id) {
      return
    }

    const isActive = getBackendRoomActive(room)
    const ticketIssueEnabled = getBackendRoomTicketIssueEnabled(room)

    rooms.set(id, {
      id,
      active: isActive,
      isActive,
      isTicketIssueEnabled: room.isTicketIssueEnabled,
      kioskEnabled: room.kioskEnabled,
      name: getBackendRoomName(room),
      number: room.number,
      placeType: room.placeType ?? room.place_type,
      estimatedWaitMinutes: typeof room.estimatedWaitMinutes === 'number'
        ? room.estimatedWaitMinutes
        : typeof room.estimatedWaitMinutes === 'string' && room.estimatedWaitMinutes.trim() !== ''
          ? Number(room.estimatedWaitMinutes)
          : undefined,
      department: getBackendRoomName(room),
      serviceTypeId: room.serviceTypeId,
      serviceTypeIds: room.serviceTypeIds,
      serviceTypes: room.serviceTypes as Room['serviceTypes'],
      services: room.services as Room['services'],
      specialistName: getBackendRoomName(room),
      status: isActive ? 'open' : 'paused',
      ticketIssueEnabled,
      loadPercent: 0,
      workload: 0,
      workEndTime: room.workEndTime ?? room.workingEndTime ?? room.work_end_time,
      workStartTime: room.workStartTime ?? room.workingStartTime ?? room.work_start_time,
      workingEndTime: room.workingEndTime,
      workingStartTime: room.workingStartTime,
    })
  })

  stats.forEach((stat) => {
    const id = toId(stat.roomId)

    if (!id || inactiveRoomIds.has(id)) {
      return
    }

    const existingRoom = rooms.get(id)

    if (hasBackendRooms && !existingRoom) {
      return
    }

    const workload = Math.min(100, Math.max(0, stat.activeTickets * 10))

    rooms.set(id, {
      ...existingRoom,
      id,
      active: existingRoom?.active ?? existingRoom?.isActive ?? true,
      isActive: existingRoom?.isActive ?? true,
      isTicketIssueEnabled: existingRoom?.isTicketIssueEnabled,
      kioskEnabled: existingRoom?.kioskEnabled,
      name: existingRoom?.name ?? stat.roomName,
      number: existingRoom?.number,
      placeType: existingRoom?.placeType,
      estimatedWaitMinutes: existingRoom?.estimatedWaitMinutes,
      department: existingRoom?.department ?? stat.roomName,
      serviceTypeId: existingRoom?.serviceTypeId,
      serviceTypeIds: existingRoom?.serviceTypeIds,
      serviceTypes: existingRoom?.serviceTypes,
      services: existingRoom?.services,
      specialistName: existingRoom?.specialistName ?? stat.roomName,
      status: 'open',
      ticketIssueEnabled: existingRoom?.ticketIssueEnabled ?? true,
      loadPercent: workload,
      workload,
      workEndTime: existingRoom?.workEndTime ?? existingRoom?.workingEndTime,
      workStartTime: existingRoom?.workStartTime ?? existingRoom?.workingStartTime,
      workingEndTime: existingRoom?.workingEndTime,
      workingStartTime: existingRoom?.workingStartTime,
    })
  })

  tickets.forEach((ticket) => {
    const roomId = getBackendTicketRoomId(ticket)

    if (!roomId || rooms.has(roomId) || inactiveRoomIds.has(roomId)) {
      return
    }

    if (hasBackendRooms) {
      return
    }

    const serviceType = toSharedServiceType(ticket)
    const roomName = getBackendTicketRoomName(ticket)

    rooms.set(roomId, {
      id: roomId,
      active: getBackendRoomActive(ticket.room),
      isActive: getBackendRoomActive(ticket.room),
      isTicketIssueEnabled: ticket.room?.isTicketIssueEnabled,
      kioskEnabled: ticket.room?.kioskEnabled,
      name: roomName,
      number: ticket.room?.number,
      placeType: ticket.room?.placeType ?? ticket.room?.place_type,
      estimatedWaitMinutes: typeof ticket.room?.estimatedWaitMinutes === 'number'
        ? ticket.room.estimatedWaitMinutes
        : typeof ticket.room?.estimatedWaitMinutes === 'string' && ticket.room.estimatedWaitMinutes.trim() !== ''
          ? Number(ticket.room.estimatedWaitMinutes)
          : undefined,
      department: serviceType,
      serviceTypeId: ticket.room?.serviceTypeId,
      serviceTypeIds: ticket.room?.serviceTypeIds,
      serviceTypes: ticket.room?.serviceTypes as Room['serviceTypes'],
      services: ticket.room?.services as Room['services'],
      specialistName: roomName,
      status: getBackendRoomActive(ticket.room) ? 'open' : 'paused',
      ticketIssueEnabled: getBackendRoomTicketIssueEnabled(ticket.room),
      loadPercent: 0,
      workload: 0,
      workEndTime: ticket.room?.workEndTime ?? ticket.room?.workingEndTime ?? ticket.room?.work_end_time,
      workStartTime: ticket.room?.workStartTime ?? ticket.room?.workingStartTime ?? ticket.room?.work_start_time,
      workingEndTime: ticket.room?.workingEndTime,
      workingStartTime: ticket.room?.workingStartTime,
    })
  })

  return Array.from(rooms.values()).map((room) => {
    const currentTicket = tickets.find((ticket) => {
      const ticketRoomId = getBackendTicketRoomId(ticket)

      return ticketRoomId === room.id && ['called', 'in_service'].includes(ticket.status ?? '')
    })

    return {
      ...room,
      currentTicketId: currentTicket ? toId(currentTicket.id) : undefined,
      status: currentTicket && room.isActive !== false ? 'busy' : room.status,
    }
  })
}

export function toQueueKpi(
  tickets: BackendTicket[],
  _stats: BackendQueueStats[] = [],
  overload: BackendOverloadRoom[] = [],
): QueueKpi {
  const activeWaitTickets = tickets.filter((ticket) =>
    ['created', 'waiting', 'called', 'in_service', 'redirected'].includes(ticket.status ?? ''),
  )
  const activeTickets = activeWaitTickets.length
  const averageWaitingFromTickets = getAverageWaitingMinutes(tickets.map(toSharedTicket))

  return {
    activeTickets,
    averageWaitMinutes: averageWaitingFromTickets ?? 0,
    completedToday: tickets.filter((ticket) => ticket.status === 'completed').length,
    overloadedRooms: overload.length,
  }
}

function toRecommendationSeverity(
  value?: string,
): QueueRecommendation['severity'] {
  const normalizedValue = value?.toLowerCase()

  if (normalizedValue === 'critical' || normalizedValue === 'danger' || normalizedValue === 'high') {
    return 'critical'
  }

  if (normalizedValue === 'warning' || normalizedValue === 'warn' || normalizedValue === 'medium') {
    return 'warning'
  }

  return 'info'
}

function getRecommendationId(recommendation: BackendRecommendation, index: number): string {
  return toId(recommendation.id ?? recommendation._id) || `recommendation-${index}`
}

export function toBackendRecommendations(value: unknown): BackendRecommendation[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord).map((item) => item as BackendRecommendation)
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items.filter(isRecord).map((item) => item as BackendRecommendation)
  }

  if (isRecord(value) && Array.isArray(value.recommendations)) {
    return value.recommendations.filter(isRecord).map((item) => item as BackendRecommendation)
  }

  return []
}

export function toBackendAnalyticsPoints(value: unknown): BackendAnalyticsPoint[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord).map((item) => item as BackendAnalyticsPoint)
  }

  if (!isRecord(value)) {
    return []
  }

  const arrayKeys = [
    'analytics',
    'data',
    'items',
    'periods',
    'points',
    'rooms',
    'rows',
    'serviceTime',
    'service_time',
  ]

  for (const key of arrayKeys) {
    const nested = value[key]

    if (Array.isArray(nested)) {
      return nested.filter(isRecord).map((item) => item as BackendAnalyticsPoint)
    }

    if (isRecord(nested)) {
      const nestedPoints = toBackendAnalyticsPoints(nested)

      if (nestedPoints.length > 0) {
        return nestedPoints
      }
    }
  }

  return [value as BackendAnalyticsPoint]
}

export function toBackendTickets(value: unknown): BackendTicket[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord).map((item) => item as BackendTicket)
  }

  if (!isRecord(value)) {
    return []
  }

  const arrayKeys = [
    'tickets',
    'items',
    'queue',
    'board',
    'calls',
    'recent',
    'recentCalls',
    'recent_calls',
    'called',
    'results',
  ]
  const singleKeys = [
    'current',
    'currentTicket',
    'current_ticket',
    'lastCall',
    'last_call',
    'lastCalled',
    'last_called',
  ]
  const records: BackendTicket[] = []

  for (const key of singleKeys) {
    const nested = value[key]

    if (isRecord(nested)) {
      records.push(nested as BackendTicket)
    }
  }

  for (const key of arrayKeys) {
    const nested = value[key]

    if (Array.isArray(nested)) {
      records.push(...nested.filter(isRecord).map((item) => item as BackendTicket))
    }

    if (isRecord(nested)) {
      records.push(...toBackendTickets(nested))
    }
  }

  if (Array.isArray(value.data)) {
    records.push(...value.data.filter(isRecord).map((item) => item as BackendTicket))
  }

  if (isRecord(value.data)) {
    records.push(...toBackendTickets(value.data))
  }

  if (records.length > 0) {
    const ticketMap = new Map<string, BackendTicket>()

    records.forEach((ticket, index) => {
      ticketMap.set(toId(ticket.id) || `ticket-${index}`, ticket)
    })

    return Array.from(ticketMap.values())
  }

  if (value.id !== undefined) {
    return [value as BackendTicket]
  }

  return []
}

function getRecommendationTicketId(recommendation: BackendRecommendation): string {
  return toId(recommendation.ticketId ?? recommendation.ticket_id)
}

function getRecommendationRoomId(recommendation: BackendRecommendation): string {
  return toId(recommendation.relatedRoomId ?? recommendation.roomId)
}

function getRecommendationCreatedAt(recommendation: BackendRecommendation): string {
  return recommendation.createdAt ?? recommendation.created_at ?? new Date().toISOString()
}

function getTicketRoomName(ticket?: Ticket, rooms: Room[] = []): string | undefined {
  if (!ticket?.roomId) {
    return undefined
  }

  const room = rooms.find((item) => item.id === ticket.roomId)

  return room ? formatRoomName(room) : formatRoomName({ id: ticket.roomId, name: ticket.roomName })
}

function findRecommendationTicket(
  recommendation: BackendRecommendation,
  tickets: Ticket[],
  highPriorityTickets: Ticket[],
): Ticket | undefined {
  const ticketId = getRecommendationTicketId(recommendation)

  if (ticketId) {
    return tickets.find((ticket) => ticket.id === ticketId)
      ?? highPriorityTickets.find((ticket) => ticket.id === ticketId)
  }

  const ticketNumber = recommendation.ticketNumber?.trim()

  if (ticketNumber) {
    return tickets.find((ticket) => ticket.number === ticketNumber)
      ?? highPriorityTickets.find((ticket) => ticket.number === ticketNumber)
  }

  const roomId = getRecommendationRoomId(recommendation)

  if (roomId) {
    return highPriorityTickets.find((ticket) => ticket.roomId === roomId)
      ?? tickets.find((ticket) =>
        ticket.roomId === roomId &&
        ['critical', 'high'].includes(ticket.priority) &&
        ['created', 'waiting', 'called', 'redirected'].includes(ticket.status),
      )
  }

  return highPriorityTickets[0]
    ?? tickets.find((ticket) =>
      ['critical', 'high'].includes(ticket.priority) &&
      ['created', 'waiting', 'called', 'redirected'].includes(ticket.status),
    )
}

function createTicketRecommendation(ticket: Ticket, rooms: Room[]): QueueRecommendation {
  const roomName = getTicketRoomName(ticket, rooms)
  const waitingTime = formatWaitingTime(getWaitingMinutes(ticket))

  return {
    action: 'Проверьте маршрут и приоритет талона.',
    createdAt: ticket.createdAt,
    description: `Услуга: ${ticket.serviceType}. Кабинет: ${roomName ?? 'Не назначен'}.`,
    id: `ticket-${ticket.id}-priority`,
    isResolved: false,
    message: `Талон ${ticket.number} — высокий приоритет, ожидает ${waitingTime}`,
    relatedRoomId: ticket.roomId,
    relatedRoomName: roomName,
    severity: ticket.priority === 'critical' ? 'critical' : 'warning',
    ticket,
    ticketId: ticket.id,
    title: 'Приоритетный талон ожидает',
  }
}

function createOverloadRecommendation(room: BackendOverloadRoom): QueueRecommendation {
  return {
    action: 'Проверьте распределение врачей и кабинетов.',
    createdAt: new Date().toISOString(),
    description: `В кабинете сейчас ${room.queueCount} активных талонов.`,
    id: `room-${room.roomId}-overload`,
    isResolved: false,
    message: `${room.roomName}: высокая нагрузка`,
    relatedRoomId: toId(room.roomId),
    relatedRoomName: room.roomName,
    severity: room.queueCount >= 8 ? 'critical' : 'warning',
    title: 'Перегрузка кабинета',
  }
}

function getAnalyticsLabel(point: BackendAnalyticsPoint, index: number): string {
  const record = point as Record<string, unknown>
  const rawLabel = getRecordString(record, [
    'label',
    'period',
    'time',
    'hour',
    'date',
    'roomName',
    'serviceName',
  ])

  if (!rawLabel) {
    return `Период ${index + 1}`
  }

  const hourValue = Number(rawLabel)

  if (Number.isInteger(hourValue) && hourValue >= 0 && hourValue <= 23) {
    return `${String(hourValue).padStart(2, '0')}:00`
  }

  return rawLabel
}

export function toSharedAnalytics(points: BackendAnalyticsPoint[] = []): AnalyticsPoint[] {
  const analyticsByLabel = new Map<string, AnalyticsPoint>()

  points.forEach((point, index) => {
    const record = point as Record<string, unknown>
    const label = getAnalyticsLabel(point, index)
    const existing = analyticsByLabel.get(label)
    const avgServiceMinutes = getRecordNumberOptional(record, [
      'avgServiceMinutes',
      'averageServiceMinutes',
      'avg_service_minutes',
      'average_service_minutes',
    ])
    const noShow = getRecordNumberOptional(record, [
      'noShow',
      'noShowCount',
      'no_show',
      'no_show_count',
      'noShowTickets',
    ])
    const nextPoint: AnalyticsPoint = {
      label,
      waiting: getRecordNumber(record, [
        'waiting',
        'waitingCount',
        'waiting_count',
        'waitingTickets',
        'activeTickets',
      ], existing?.waiting ?? 0),
      completed: getRecordNumber(record, [
        'completed',
        'completedCount',
        'completed_count',
        'completedTickets',
      ], existing?.completed ?? 0),
      noShow: noShow ?? existing?.noShow,
      avgWaitMinutes: getRecordNumber(record, [
        'avgWaitMinutes',
        'averageWaitMinutes',
        'avg_wait_minutes',
        'average_wait_minutes',
      ], existing?.avgWaitMinutes ?? 0),
      avgServiceMinutes: avgServiceMinutes ?? existing?.avgServiceMinutes,
    }

    analyticsByLabel.set(label, {
      label,
      waiting: existing ? Math.max(existing.waiting, nextPoint.waiting) : nextPoint.waiting,
      completed: existing ? Math.max(existing.completed, nextPoint.completed) : nextPoint.completed,
      noShow: nextPoint.noShow ?? existing?.noShow,
      avgWaitMinutes: nextPoint.avgWaitMinutes || existing?.avgWaitMinutes || 0,
      avgServiceMinutes: nextPoint.avgServiceMinutes ?? existing?.avgServiceMinutes,
    })
  })

  return Array.from(analyticsByLabel.values())
}

const activeWaitingStatuses = new Set<TicketStatus>(['created', 'waiting', 'called', 'in_service', 'redirected'])
const queueWaitingStatuses = new Set<TicketStatus>(['created', 'waiting', 'redirected'])

function parseAnalyticsTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getPositiveDiffMinutes(start?: string, end?: string): number | null {
  const startTime = parseAnalyticsTimestamp(start)
  const endTime = parseAnalyticsTimestamp(end)

  if (startTime === undefined || endTime === undefined || endTime < startTime) {
    return null
  }

  return Math.round((endTime - startTime) / 60_000)
}

function getActualWaitingMinutes(ticket: Ticket, now = Date.now()): number | null {
  if (ticket.hasActualCreatedAt === false) {
    return null
  }

  const createdAt = parseAnalyticsTimestamp(ticket.createdAt)

  if (createdAt === undefined) {
    return null
  }

  const calledAt = parseAnalyticsTimestamp(ticket.calledAt)
  if (calledAt !== undefined) {
    return Math.max(0, Math.round((calledAt - createdAt) / 60_000))
  }

  if (activeWaitingStatuses.has(ticket.status)) {
    return Math.max(0, Math.round((now - createdAt) / 60_000))
  }

  return null
}

function getActualServiceMinutes(ticket: Ticket): number | null {
  if (ticket.status !== 'completed') {
    return null
  }

  return getPositiveDiffMinutes(ticket.startedAt, ticket.completedAt)
}

function getTicketHourLabel(ticket: Ticket): string | undefined {
  const createdAt = parseAnalyticsTimestamp(ticket.createdAt)

  if (createdAt === undefined) {
    return undefined
  }

  const hour = new Date(createdAt).getHours()

  return `${String(hour).padStart(2, '0')}:00`
}

function getAverageMinutes(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function createAnalyticsFromTickets(tickets: Ticket[], now = Date.now()): AnalyticsPoint[] {
  const groupedTickets = new Map<string, Ticket[]>()

  tickets.forEach((ticket) => {
    const label = getTicketHourLabel(ticket)

    if (!label) {
      return
    }

    groupedTickets.set(label, [...(groupedTickets.get(label) ?? []), ticket])
  })

  return Array.from(groupedTickets.entries())
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel))
    .map(([label, groupTickets]) => {
      const waitingMinutes = groupTickets
        .map((ticket) => getActualWaitingMinutes(ticket, now))
        .filter((minutes): minutes is number => minutes !== null)
      const serviceMinutes = groupTickets
        .map(getActualServiceMinutes)
        .filter((minutes): minutes is number => minutes !== null)

      return {
        label,
        waiting: groupTickets.filter((ticket) => queueWaitingStatuses.has(ticket.status)).length,
        completed: groupTickets.filter((ticket) => ticket.status === 'completed').length,
        noShow: groupTickets.filter((ticket) => ticket.status === 'no_show').length,
        avgWaitMinutes: getAverageMinutes(waitingMinutes),
        avgServiceMinutes: serviceMinutes.length > 0 ? getAverageMinutes(serviceMinutes) : undefined,
      }
    })
}

function mergeAnalyticsPoints(
  endpointAnalytics: AnalyticsPoint[],
  ticketAnalytics: AnalyticsPoint[],
): AnalyticsPoint[] {
  if (ticketAnalytics.length === 0) {
    return endpointAnalytics.sort((left, right) => left.label.localeCompare(right.label))
  }

  return ticketAnalytics.sort((left, right) => left.label.localeCompare(right.label))
}

export function toSharedRecommendations(
  recommendations: BackendRecommendation[] = [],
  tickets: Ticket[] = [],
  rooms: Room[] = [],
  highPriorityTickets: Ticket[] = [],
  overload: BackendOverloadRoom[] = [],
): QueueRecommendation[] {
  const baseRecommendations = recommendations
    .filter((recommendation) => {
      const record = recommendation as Record<string, unknown>
      const resolved = getRecordBoolean(record, ['resolved', 'isResolved', 'is_resolved'])
      const read = getRecordBoolean(record, ['read', 'isRead'])

      return resolved !== true && read !== true
    })
    .map((recommendation, index) => {
      const record = recommendation as Record<string, unknown>
      const ticket = findRecommendationTicket(recommendation, tickets, highPriorityTickets)
      const roomId = getRecommendationRoomId(recommendation) || ticket?.roomId
      const roomName = recommendation.roomName
        ?? getTicketRoomName(ticket, rooms)
        ?? rooms.find((room) => room.id === roomId)?.name
        ?? (roomId ? `Кабинет ${roomId}` : undefined)
      const message = getRecordString(record, ['message', 'text', 'description'], 'Новое уведомление')
      const title = getRecordString(record, ['title'], 'Уведомление')
      const description = getRecordString(record, ['description', 'message', 'text'], message)
      const fallbackTicketId = getRecommendationTicketId(recommendation)

      return {
        action: getRecordString(record, ['action'], 'Проверить очередь'),
        createdAt: getRecommendationCreatedAt(recommendation),
        description,
        id: getRecommendationId(recommendation, index),
        isResolved: false,
        message,
        relatedRoomId: roomId || undefined,
        relatedRoomName: roomName,
        severity: toRecommendationSeverity(recommendation.severity ?? recommendation.level),
        ticket,
        ticketId: (ticket?.id ?? fallbackTicketId) || undefined,
        title,
      }
    })
  const existingIds = new Set(baseRecommendations.map((recommendation) => recommendation.id))
  const existingTicketIds = new Set(baseRecommendations.map((recommendation) => recommendation.ticketId).filter(Boolean))
  const highPriorityRecommendations = highPriorityTickets
    .filter((ticket) => !existingTicketIds.has(ticket.id))
    .map((ticket) => createTicketRecommendation(ticket, rooms))
    .filter((recommendation) => !existingIds.has(recommendation.id))
  const existingRoomIds = new Set(baseRecommendations.map((recommendation) => recommendation.relatedRoomId).filter(Boolean))
  const overloadRecommendations = overload
    .filter((room) => !existingRoomIds.has(toId(room.roomId)))
    .map(createOverloadRecommendation)
    .filter((recommendation) => !existingIds.has(recommendation.id))
  const recommendationIds = new Set([
    ...baseRecommendations,
    ...highPriorityRecommendations,
    ...overloadRecommendations,
  ].map((recommendation) => recommendation.id))
  const workTimeRecommendations = rooms
    .map((room) => createRoomWorkTimeRecommendation(room, tickets))
    .filter((recommendation): recommendation is QueueRecommendation => Boolean(recommendation))
    .filter((recommendation) => !recommendationIds.has(recommendation.id))

  return [
    ...baseRecommendations,
    ...highPriorityRecommendations,
    ...overloadRecommendations,
    ...workTimeRecommendations,
  ]
}

export function toQueueSnapshot(
  tickets: BackendTicket[],
  stats: BackendQueueStats[] = [],
  overload: BackendOverloadRoom[] = [],
  rooms: BackendRoom[] = [],
  recommendations: BackendRecommendation[] = [],
  highPriorityTickets: BackendTicket[] = [],
  analytics: BackendAnalyticsPoint[] = [],
): QueueSnapshot {
  const initialTickets = toSharedTickets(tickets)
  const initialRooms = toSharedRooms(tickets, stats, rooms)
  const plannedQueue = planRoomLoads(initialRooms, initialTickets)
  const sharedTickets = plannedQueue.tickets
  const sharedRooms = plannedQueue.rooms
  const sharedHighPriorityTickets = toSharedTickets(highPriorityTickets)
  const endpointAnalytics = toSharedAnalytics(analytics)
  const ticketAnalytics = createAnalyticsFromTickets(sharedTickets)

  return {
    tickets: sharedTickets,
    rooms: sharedRooms,
    events: [],
    recommendations: toSharedRecommendations(
      recommendations,
      sharedTickets,
      sharedRooms,
      sharedHighPriorityTickets,
      overload,
    ),
    analytics: mergeAnalyticsPoints(endpointAnalytics, ticketAnalytics),
    kpi: {
      ...toQueueKpi(tickets, stats, overload),
      overloadedRooms: sharedRooms.filter((room) => room.loadPercent >= 75).length,
    },
    updatedAt: sharedTickets
      .flatMap((ticket) => [ticket.updatedAt, ticket.calledAt, ticket.completedAt, ticket.createdAt])
      .filter((value): value is string => typeof value === 'string')
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0],
  }
}

function getBoardTicketSortTime(ticket: Ticket): number {
  const timestamp = Date.parse(ticket.calledAt ?? ticket.updatedAt ?? ticket.createdAt)

  return Number.isFinite(timestamp) ? timestamp : 0
}

function isBoardCallTicket(ticket: Ticket): boolean {
  return Boolean(ticket.calledAt)
}

export function toBoardQueueSnapshot(value: unknown): QueueSnapshot {
  const tickets = toBackendTickets(value)
  const rooms = toBackendRooms(value)
  const boardTickets = tickets
    .map(normalizeBoardTicket)
    .filter(isBoardCallTicket)
    .sort((left, right) => getBoardTicketSortTime(right) - getBoardTicketSortTime(left))
  const updatedAt = isRecord(value) && typeof value.updatedAt === 'string'
    ? value.updatedAt
    : boardTickets
      .flatMap((ticket) => [ticket.updatedAt, ticket.calledAt, ticket.completedAt, ticket.createdAt])
      .filter((timestamp): timestamp is string => typeof timestamp === 'string')
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0]

  return {
    tickets: boardTickets,
    rooms: planRoomLoads(toSharedRooms(tickets, [], rooms), toSharedTickets(tickets)).rooms,
    events: [],
    recommendations: [],
    analytics: [],
    kpi: toQueueKpi(tickets),
    updatedAt,
  }
}
