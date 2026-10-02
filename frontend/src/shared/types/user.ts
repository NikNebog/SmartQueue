export type Role = 'admin' | 'manager' | 'specialist'

export type ThemeMode = 'light' | 'dark'

export type User = {
  id: string
  name: string
  email?: string
  role: Role
  department: string
  roomId?: string
  roomIds?: string[]
  assignedRoomId?: string
  assignedRoomIds?: string[]
  roomAssignmentPending?: boolean
  canManageTicketIssue?: boolean
  avatarInitials: string
}
