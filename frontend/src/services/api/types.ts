import type {
  QueueSnapshot,
  RedirectTicketInput,
  AnalyticsPeriod as SharedAnalyticsPeriod,
  Room as SharedRoom,
  ServiceType as SharedServiceType,
  Ticket as SharedTicket,
  TicketCreateInput as SharedTicketCreateInput,
  TicketPriority as SharedTicketPriority,
  TicketStatus as SharedTicketStatus,
  User as SharedUser,
} from '@shared/types'
import type { SmartQLanguage } from '@shared/locales/types'
import type { BoardStyleSettings } from '../boardStyleSettingsService'
import type {
  CreateTicketInput as ArchitectureCreateTicketInput,
  QueueStats as ArchitectureQueueStats,
  Room as ArchitectureRoom,
  Ticket as ArchitectureTicket,
  UpdateTicketStatusInput,
} from '../../types'

export type QueueOverloadRoom = {
  roomId: string
  roomName: string
  queueCount: number
}

export type TicketSettingsServiceTypeOption = {
  active?: boolean
  averageDurationMinutes?: number
  id: string | number
  code: SharedServiceType
  name: string
  priorityWeight?: number
  ticketPrefix?: string
  translations?: Partial<Record<SmartQLanguage, string>>
}

export type TicketSettingsUserOption = {
  assignedRoomId?: string | number
  assignedRoomIds?: Array<string | number>
  id: string | number
  name: string
  role?: SharedUser['role']
  roomId?: string | number
  roomIds?: Array<string | number>
}

export type TicketSettingsRoomServiceOption = {
  _id?: string | number
  id?: string | number
  name?: string
  serviceTypeId?: string | number
  title?: string
}

export type TicketSettingsRoomOption = Pick<SharedRoom, 'id' | 'name'> & {
  active?: boolean
  isActive?: boolean
  isTicketIssueEnabled?: boolean
  kioskEnabled?: boolean
  number?: string | number
  placeType?: SharedRoom['placeType']
  roomId?: string | number
  roomName?: string
  serviceTypeId?: string | number
  serviceTypeIds?: Array<string | number>
  serviceTypes?: Array<string | number | TicketSettingsRoomServiceOption>
  services?: Array<string | number | TicketSettingsRoomServiceOption>
  ticketIssueEnabled?: boolean
  title?: string
  workEndTime?: string
  workStartTime?: string
  workingEndTime?: string
  workingStartTime?: string
}

export type TicketSettingsOptions = {
  rooms: TicketSettingsRoomOption[]
  serviceTypes: TicketSettingsServiceTypeOption[]
  specialists: TicketSettingsUserOption[]
}

export type TicketSettingsPayload = {
  serviceTypeId?: string | number
  serviceType?: SharedServiceType
  roomId?: string | number
  doctorId?: string | number
  priority?: SharedTicketPriority
  status?: SharedTicketStatus
  comment?: string
  note?: string
  etaMinutes?: number
  language?: SmartQLanguage
}

export type TicketCreateSettingsPayload = TicketSettingsPayload & {
  priority: SharedTicketPriority
  serviceTypeId: string | number
  serviceType?: SharedServiceType
  status: SharedTicketStatus
}

export type TicketApi = {
  getTickets: () => Promise<ArchitectureTicket[]>
  getTicketById: (id: string) => Promise<ArchitectureTicket | undefined>
  getTicketHistory: (id: string) => Promise<SharedTicket | undefined>
  createTicket: (input: ArchitectureCreateTicketInput) => Promise<ArchitectureTicket>
  createKioskTicket: (input: ArchitectureCreateTicketInput) => Promise<ArchitectureTicket>
  arriveTicket: (id: string) => Promise<ArchitectureTicket>
  callTicket: (id: string) => Promise<ArchitectureTicket>
  startTicket: (id: string) => Promise<ArchitectureTicket>
  completeTicket: (id: string) => Promise<ArchitectureTicket>
  cancelTicket: (id: string) => Promise<ArchitectureTicket>
  noShowTicket: (id: string) => Promise<ArchitectureTicket>
  skipTicket: (id: string) => Promise<ArchitectureTicket>
  returnTicket: (id: string, roomId?: string | number) => Promise<ArchitectureTicket>
  redirectTicket: (id: string, newRoomId: string | number) => Promise<ArchitectureTicket>
  updateTicketStatus: (input: UpdateTicketStatusInput) => Promise<ArchitectureTicket | undefined>
  createTicketWithSettings: (payload: TicketCreateSettingsPayload) => Promise<SharedTicket>
  getTicketSettingsOptions: () => Promise<TicketSettingsOptions>
  updateTicketSettings: (id: string, payload: TicketSettingsPayload) => Promise<void>
}

export type QueueListener = (tickets: ArchitectureTicket[]) => void

export type RoomQueueStat = {
  activeTickets: number
  avgServiceMinutes: number
  etaMinutes: number
  roomId: string | number
  roomName: string
}

export type QueueApi = {
  getQueueSnapshot: () => Promise<QueueSnapshot>
  getBoardSnapshot: (roomId?: string | number) => Promise<QueueSnapshot>
  getPeriodAnalytics: (period: SharedAnalyticsPeriod) => Promise<QueueSnapshot['analytics']>
  getRoomQueueSnapshot: (roomId: string | number) => Promise<QueueSnapshot>
  getRoomNoShowTickets: (roomId: string | number) => Promise<SharedTicket[]>
  getRoomPostponedTickets: (roomId: string | number) => Promise<SharedTicket[]>
  createTicket: (input: SharedTicketCreateInput) => Promise<QueueSnapshot>
  createKioskTicket: (input: SharedTicketCreateInput) => Promise<QueueSnapshot>
  callNextTicket: (roomId: string) => Promise<QueueSnapshot>
  startService: (ticketId: string) => Promise<QueueSnapshot>
  completeService: (ticketId: string) => Promise<QueueSnapshot>
  postponeTicket: (ticketId: string) => Promise<QueueSnapshot>
  skipTicket: (ticketId: string) => Promise<QueueSnapshot>
  returnTicket: (ticketId: string, roomId?: string | number) => Promise<QueueSnapshot>
  redirectTicket: (input: RedirectTicketInput) => Promise<QueueSnapshot>
  recalculateRoom: (roomId: string | number) => Promise<QueueSnapshot>
  resolveRecommendation: (id: string) => Promise<QueueSnapshot>
  getStats: () => Promise<ArchitectureQueueStats>
  getRoomStats: () => Promise<RoomQueueStat[]>
  getQueueByRoom: (roomId: string | number) => Promise<ArchitectureTicket[]>
  getNextTicket: (roomId: string | number) => Promise<ArchitectureTicket | undefined>
  getHighPriority: () => Promise<ArchitectureTicket[]>
  checkOverload: () => Promise<QueueOverloadRoom[]>
  getQueue: () => Promise<ArchitectureTicket[]>
  getRooms: () => Promise<ArchitectureRoom[]>
  subscribeQueue: (listener: QueueListener) => () => void
  replaceQueue: (nextTickets: ArchitectureTicket[]) => void
}

export type AuthApi = {
  getDefaultUser: () => SharedUser | null
  getCurrentUser: () => Promise<SharedUser | null>
  login: (email: string, password: string) => Promise<SharedUser>
  register: (
    name: string,
    email: string,
    password: string,
    role: SharedUser['role'],
  ) => Promise<SharedUser>
  resetPassword: (email: string) => Promise<void>
  loginAsRole: (role: SharedUser['role']) => Promise<SharedUser>
  logout: () => Promise<void>
}

export type AdminRecord = {
  id: string | number
} & Record<string, unknown>

export type AdminRecordInput = Record<string, unknown>

export type AdminTerminalRecord = {
  active: boolean
  id: string | number
  location: string
  name: string
  roomIds: Array<string | number>
  serviceTypeIds: Array<string | number>
}

export type AdminTerminalInput = {
  active?: boolean
  location: string
  name: string
  roomIds?: Array<string | number>
  serviceTypeIds?: Array<string | number>
}

export type BoardTemplate = 'classic' | 'grid' | 'list' | 'minimal' | 'cards' | 'video_queue' | 'big_board'

export type BoardScreen = {
  id: string
  name: string
  roomIds?: string[]
  roomNames: string[]
}

export type BoardPromoImageItem = {
  id?: number
  name?: string
  url: string
}

export type BoardPromoVideoItem = {
  id?: number
  name?: string
  playEvery?: number
  url: string
}

export type BoardPromoMedia = {
  imageId?: number
  imageItems?: BoardPromoImageItem[]
  imageName?: string
  imageUrl?: string
  updatedAt?: string
  videoId?: number
  videoItems?: BoardPromoVideoItem[]
  videoName?: string
  videoUrl?: string
}

export type BoardSettingsProfile = {
  boardType: 'general' | 'individual'
  id: string
  liteMode?: boolean
  marqueeOffsetPx?: number
  marqueeSizePercent?: number
  marqueeText?: string
  showMarquee?: boolean
  name: string
  recentCallsLimit: number
  roomBoardId?: string
  roomIds?: string[]
  showRecentCalls: boolean
  showTime: boolean
  template: BoardTemplate
  voiceEnabled: boolean
}

export type BoardSettings = {
  boardType: 'general' | 'individual'
  liteMode?: boolean
  marqueeOffsetPx?: number
  marqueeSizePercent?: number
  marqueeText?: string
  promoMediaByProfileId?: Record<string, BoardPromoMedia>
  showMarquee?: boolean
  profiles?: BoardSettingsProfile[]
  recentCallsLimit: number
  roomBoardId?: string
  roomIds?: string[]
  screens: BoardScreen[]
  showRecentCalls: boolean
  showTime: boolean
  styleSettings?: Record<string, Partial<BoardStyleSettings>>
  template: BoardTemplate
  voiceEnabled: boolean
}

export type AdminServiceTypeInput = {
  active?: boolean
  averageDurationMinutes?: number
  code?: SharedServiceType
  name: string
  priorityWeight?: number
  ticketPrefix: string
  translations?: Partial<Record<SmartQLanguage, string>>
}

export type AdminUserInput = Partial<SharedUser> & {
  assignedRoomIds?: Array<string | number>
  email?: string
  name: string
  password?: string
  role: SharedUser['role']
  roomIds?: Array<string | number>
}

export type AdminApi = {
  getServiceTypes: () => Promise<TicketSettingsServiceTypeOption[]>
  createServiceType: (input: AdminServiceTypeInput) => Promise<TicketSettingsServiceTypeOption>
  updateServiceType: (id: string | number, input: Partial<AdminServiceTypeInput>) => Promise<TicketSettingsServiceTypeOption>
  deleteServiceType: (id: string | number) => Promise<void>
  getRooms: () => Promise<AdminRecord[]>
  createRoom: (input: AdminRecordInput) => Promise<AdminRecord>
  updateRoom: (id: string | number, input: AdminRecordInput) => Promise<AdminRecord>
  updateRoomTicketIssue: (id: string | number, enabled: boolean) => Promise<AdminRecord>
  deleteRoom: (id: string | number) => Promise<void>
  getStaff: () => Promise<AdminRecord[]>
  createStaff: (input: AdminRecordInput) => Promise<AdminRecord>
  updateStaff: (id: string | number, input: AdminRecordInput) => Promise<AdminRecord>
  deleteStaff: (id: string | number) => Promise<void>
  getUsers: () => Promise<SharedUser[]>
  createUser: (input: AdminUserInput) => Promise<SharedUser>
  updateUser: (id: string | number, input: Partial<AdminUserInput>) => Promise<SharedUser>
  deleteUser: (id: string | number) => Promise<void>
  assignDoctorToRoom: (userId: string | number, roomId: string | number) => Promise<SharedUser>
  getTerminals: () => Promise<AdminTerminalRecord[]>
  createTerminal: (input: AdminTerminalInput) => Promise<AdminTerminalRecord>
  updateTerminal: (id: string | number, input: Partial<AdminTerminalInput>) => Promise<AdminTerminalRecord>
  deleteTerminal: (id: string | number) => Promise<void>
  getBoardSettings: () => Promise<BoardSettings>
  updateBoardSettings: (input: Partial<BoardSettings>) => Promise<BoardSettings>
}

export type KioskApi = {
  createTicket: (input: SharedTicketCreateInput) => Promise<SharedTicket>
  createTicketForKiosk: (input: TicketCreateSettingsPayload) => Promise<SharedTicket>
}
