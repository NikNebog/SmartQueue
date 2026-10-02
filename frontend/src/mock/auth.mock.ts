import type { Role, User } from '@shared/types'

export const mockUsers: Record<Role, User> = {
  admin: {
    id: 'user-admin',
    name: 'Дмитрий Орлов',
    role: 'admin',
    department: 'Операционный центр',
    avatarInitials: 'ДО',
  },
  manager: {
    id: 'user-manager',
    name: 'Амина Каримова',
    role: 'manager',
    department: 'Управление очередью',
    avatarInitials: 'АК',
  },
  specialist: {
    id: 'user-specialist',
    name: 'Сергей Волков',
    role: 'specialist',
    department: 'Консультация',
    roomId: 'room-203',
    roomIds: ['room-203', 'room-214'],
    canManageTicketIssue: true,
    avatarInitials: 'СВ',
  },
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const makeAvatarInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const makeDepartment = (role: Role) => {
  if (role === 'admin') return 'Операционный центр'
  if (role === 'specialist') return 'Консультация'
  return 'Управление очередью'
}

export const mockStoredUsers: Record<string, User> = {
  'admin@smartq.test': mockUsers.admin,
  'manager@smartq.test': mockUsers.manager,
  'specialist@smartq.test': mockUsers.specialist,
}

export const mockCredentials: Record<string, string> = {
  'admin@smartq.test': 'admin123',
  'manager@smartq.test': 'manager123',
  'specialist@smartq.test': 'specialist123',
}

export function findUserByEmail(email: string): User | undefined {
  return mockStoredUsers[normalizeEmail(email)]
}

export function isRegisteredEmail(email: string): boolean {
  return Boolean(findUserByEmail(email))
}

export function registerUser(name: string, email: string, password: string, role: Role): User {
  const normalizedEmail = normalizeEmail(email)

  if (mockStoredUsers[normalizedEmail]) {
    throw new Error('Этот email уже зарегистрирован.')
  }

  const user: User = {
    id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: name.trim(),
    role,
    department: makeDepartment(role),
    avatarInitials: makeAvatarInitials(name),
    ...(role === 'specialist'
      ? {
          canManageTicketIssue: true,
          roomId: `room-${210 + Object.keys(mockStoredUsers).length}`,
          roomIds: [`room-${210 + Object.keys(mockStoredUsers).length}`],
        }
      : {}),
  }

  mockStoredUsers[normalizedEmail] = user
  mockCredentials[normalizedEmail] = password

  return user
}

export function normalizeUserEmail(email: string) {
  return normalizeEmail(email)
}
