import type { SmartQLanguage } from '@shared/locales/types'

export type TicketStatus =
  | 'created'
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'postponed'
  | 'redirected'

export type TicketPriority = 'low' | 'normal' | 'above_normal' | 'high' | 'critical'

export type AnalyticsPeriod = 'day' | 'week' | 'month'

export type ServiceType =
  | 'registration'
  | 'consultation'
  | 'diagnostics'
  | 'laboratory'
  | 'pharmacy'
  | 'billing'

export type RoomStatus = 'open' | 'busy' | 'paused'

export type ServicePlaceType = 'room' | 'window' | 'desk'

export type Ticket = {
  id: string
  number: string
  patientName: string
  serviceType: ServiceType
  serviceTypeId?: string | number
  serviceTypeName?: string
  priority: TicketPriority
  status: TicketStatus
  createdAt: string
  hasActualCreatedAt?: boolean
  calledAt?: string
  serviceStartedAt?: string
  startedAt?: string
  completedAt?: string
  updatedAt?: string
  roomId?: string
  roomName?: string
  assignedTo?: string
  language?: SmartQLanguage
  etaMinutes: number
  notes?: string
  peopleAhead?: number
  queuePosition?: number
  events?: TicketEvent[]
}

export type Room = {
  id: string
  name: string
  number?: string | number
  placeType?: ServicePlaceType | string
  estimatedWaitMinutes?: number
  department: string
  specialistName: string
  status: RoomStatus
  active?: boolean
  isActive?: boolean
  isTicketIssueEnabled?: boolean
  kioskEnabled?: boolean
  serviceTypeId?: string | number
  serviceTypeIds?: Array<string | number>
  serviceTypes?: Array<string | number | {
    _id?: string | number
    id?: string | number
    name?: string
    serviceTypeId?: string | number
    title?: string
    translations?: Partial<Record<SmartQLanguage, string>>
  }>
  services?: Array<string | number | {
    _id?: string | number
    id?: string | number
    name?: string
    serviceTypeId?: string | number
    title?: string
    translations?: Partial<Record<SmartQLanguage, string>>
  }>
  ticketIssueEnabled?: boolean
  currentTicketId?: string
  workload?: number
  loadPercent: number
  workEndTime?: string
  workStartTime?: string
  workingEndTime?: string
  workingStartTime?: string
}

export type QueueEventType =
  | 'status_update'
  | 'ticket_created'
  | 'patient_arrived'
  | 'ticket_called'
  | 'service_started'
  | 'service_completed'
  | 'ticket_cancelled'
  | 'ticket_postponed'
  | 'patient_redirected'
  | 'queue_overloaded'

export type TicketEvent = {
  id: string | number
  eventType: QueueEventType | string
  oldStatus?: TicketStatus | null
  newStatus?: TicketStatus | null
  payload?: Record<string, unknown> | null
  createdAt: string
}

export type QueueEvent = {
  id: string
  type: QueueEventType
  ticketId?: string | number
  ticketNumber?: string
  roomId?: string | number
  roomName?: string
  specialistId?: string | number
  status?: string
  createdAt: string
  occurredAt: string
  message: string
}

export type QueueRecommendation = {
  id: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  action: string
  isResolved?: boolean
  relatedRoomId?: string
  relatedRoomName?: string
  ticketId?: string
  ticket?: Ticket
  createdAt: string
}

export type AnalyticsPoint = {
  label: string
  waiting: number
  completed: number
  noShow?: number
  avgWaitMinutes: number
  avgServiceMinutes?: number
}

export type QueueKpi = {
  activeTickets: number
  averageWaitMinutes: number
  completedToday: number
  overloadedRooms: number
}

export type QueueSnapshot = {
  tickets: Ticket[]
  rooms: Room[]
  events: QueueEvent[]
  recommendations: QueueRecommendation[]
  analytics: AnalyticsPoint[]
  kpi: QueueKpi
  updatedAt?: string
}

export type TicketCreateInput = {
  patientName: string
  serviceType: ServiceType
  serviceTypeId?: string | number
  priority: TicketPriority
  roomId?: string | number
  language?: SmartQLanguage
  notes?: string
}

export type RedirectTicketInput = {
  ticketId: string
  roomId: string | number
  reason?: string
  serviceTypeId?: string | number
  note?: string
  comment?: string
}
