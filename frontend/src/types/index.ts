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

export type TicketPriority = 'low' | 'normal' | 'high'

export type UserRole = 'admin' | 'manager' | 'specialist'

export interface ServiceType {
  id: string
  code: 'consultation' | 'xray' | 'analysis'
  name: string
}

export interface Room {
  id: string
  name: string
  serviceTypes: ServiceType[]
}

export interface Ticket {
  calledAt?: string
  completedAt?: string
  createdAt?: string
  id: string
  number: string
  serviceType: ServiceType
  status: TicketStatus
  room: Room
  priority: TicketPriority
  startedAt?: string
  eta: number
}

export interface User {
  id: string
  name: string
  role: UserRole
}

export interface QueueStats {
  activeTickets: number
  averageWaitMinutes: number
  completedToday: number
  overloadedRooms: number
}

export type CreateTicketInput = {
  serviceTypeId: string
  priority: TicketPriority
  roomId?: string | number
}

export type UpdateTicketStatusInput = {
  ticketId: string
  status: TicketStatus
}
