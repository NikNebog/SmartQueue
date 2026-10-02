import { mockUsers } from '@mock/auth.mock'
import { deepClone } from '@shared/utils'
import type { User } from '@shared/types'
import type {
  AdminApi,
  AdminRecord,
  AdminRecordInput,
  AdminTerminalRecord,
  AdminUserInput,
  BoardSettings,
} from '../types'
import {
  deactivateMockQueueRoom,
  createMockServiceType,
  deleteMockServiceType,
  getMockServiceTypeOptions,
  getQueueSnapshot,
  updateMockServiceType,
  upsertMockQueueRoom,
} from './mockState'

let rooms = getQueueSnapshot().rooms.map<AdminRecord>((room) => ({ ...room }))
let terminals: AdminTerminalRecord[] = []
let boardSettings: BoardSettings = {
  boardType: 'general',
  liteMode: false,
  marqueeOffsetPx: 0,
  marqueeSizePercent: 100,
  marqueeText: '',
  promoMediaByProfileId: {},
  showMarquee: true,
  recentCallsLimit: 10,
  roomBoardId: '',
  roomIds: [],
  screens: [],
  showRecentCalls: true,
  showTime: true,
  styleSettings: {},
  template: 'classic',
  voiceEnabled: true,
}
let staff: AdminRecord[] = [
  {
    department: mockUsers.specialist.department,
    id: mockUsers.specialist.id,
    name: mockUsers.specialist.name,
    role: mockUsers.specialist.role,
    roomId: mockUsers.specialist.roomId,
    roomIds: mockUsers.specialist.roomIds ?? (mockUsers.specialist.roomId ? [mockUsers.specialist.roomId] : []),
  },
]
let users = Object.values(mockUsers)

function clone<T>(value: T): T {
  return deepClone(value)
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function resolveInputId(input: AdminRecordInput, prefix: string): string | number {
  return typeof input.id === 'string' || typeof input.id === 'number' ? input.id : nextId(prefix)
}

function normalizeRoomIds(record: Partial<User> | AdminRecordInput): string[] {
  const roomIds = [
    record.roomId,
    record.assignedRoomId,
    ...(Array.isArray(record.roomIds) ? record.roomIds : []),
    ...(Array.isArray(record.assignedRoomIds) ? record.assignedRoomIds : []),
  ]

  return Array.from(new Set(
    roomIds
      .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
      .map(String)
      .filter(Boolean),
  ))
}

function upsertRecord(
  collection: AdminRecord[],
  id: string | number,
  input: AdminRecordInput,
): AdminRecord {
  const index = collection.findIndex((item) => String(item.id) === String(id))

  if (index === -1) {
    throw new Error(`Record ${id} was not found.`)
  }

  collection[index] = {
    ...collection[index],
    ...input,
    id,
  }

  return clone(collection[index])
}

function deleteRecord(collection: AdminRecord[], id: string | number): AdminRecord[] {
  return collection.filter((item) => String(item.id) !== String(id))
}

function createUserRecord(input: AdminUserInput): User {
  const roomIds = normalizeRoomIds(input)
  const primaryRoomId = roomIds[0]
  const user: User = {
    avatarInitials: input.avatarInitials ?? input.name.slice(0, 2).toUpperCase(),
    department: input.department ?? 'SmartQ',
    email: input.email,
    id: input.id ?? nextId('user'),
    name: input.name,
    role: input.role,
    assignedRoomId: primaryRoomId,
    assignedRoomIds: roomIds,
    roomId: primaryRoomId,
    roomIds,
    canManageTicketIssue: input.canManageTicketIssue ?? true,
  }

  users = [...users, user]

  if (user.role === 'specialist') {
    staff = [
      ...staff,
      {
        department: user.department,
        email: user.email,
        id: user.id,
        name: user.name,
        role: user.role,
        roomId: user.roomId,
        roomIds: user.roomIds,
        canManageTicketIssue: user.canManageTicketIssue ?? true,
      },
    ]
  }

  return clone(user)
}

function updateUserRecord(id: string | number, input: Partial<AdminUserInput>): User {
  const index = users.findIndex((user) => String(user.id) === String(id))

  if (index === -1) {
    throw new Error(`User ${id} was not found.`)
  }

  const roomIds = normalizeRoomIds({
    ...users[index],
    ...input,
  })
  const primaryRoomId = roomIds[0]

  users[index] = {
    ...users[index],
    ...input,
    assignedRoomId: primaryRoomId,
    assignedRoomIds: roomIds,
    roomId: primaryRoomId,
    roomIds,
  }

  const staffIndex = staff.findIndex((member) => String(member.id) === String(id))

  if (staffIndex !== -1) {
    staff[staffIndex] = {
      ...staff[staffIndex],
      ...input,
      assignedRoomId: primaryRoomId,
      assignedRoomIds: roomIds,
      roomId: primaryRoomId,
      roomIds,
    }
  }

  return clone(users[index])
}

export const mockAdminApi: AdminApi = {
  getServiceTypes() {
    return Promise.resolve(getMockServiceTypeOptions())
  },

  createServiceType(input) {
    return Promise.resolve(createMockServiceType(input))
  },

  updateServiceType(id, input) {
    return Promise.resolve(updateMockServiceType(id, input))
  },

  deleteServiceType(id) {
    deleteMockServiceType(id)

    return Promise.resolve()
  },

  getRooms() {
    return Promise.resolve(clone(rooms))
  },

  createRoom(input) {
    const room: AdminRecord = {
      ...input,
      id: resolveInputId(input, 'room'),
    }

    rooms = [...rooms, room]
    upsertMockQueueRoom(room)

    return Promise.resolve(clone(room))
  },

  updateRoom(id, input) {
    const room = upsertRecord(rooms, id, input)

    upsertMockQueueRoom(room)

    return Promise.resolve(room)
  },

  updateRoomTicketIssue(id, enabled) {
    const room = upsertRecord(rooms, id, {
      isTicketIssueEnabled: enabled,
      kioskEnabled: enabled,
      ticketIssueEnabled: enabled,
    })

    upsertMockQueueRoom(room)

    return Promise.resolve(room)
  },

  deleteRoom(id) {
    rooms = deleteRecord(rooms, id)
    deactivateMockQueueRoom(id)

    return Promise.resolve()
  },

  getStaff() {
    return Promise.resolve(clone(staff))
  },

  createStaff(input) {
    const staffMember: AdminRecord = {
      ...input,
      id: resolveInputId(input, 'staff'),
    }

    staff = [...staff, staffMember]

    return Promise.resolve(clone(staffMember))
  },

  updateStaff(id, input) {
    return Promise.resolve(upsertRecord(staff, id, input))
  },

  deleteStaff(id) {
    staff = deleteRecord(staff, id)

    return Promise.resolve()
  },

  getUsers() {
    return Promise.resolve(clone(users))
  },

  createUser(input) {
    return Promise.resolve(createUserRecord(input))
  },

  updateUser(id, input) {
    return Promise.resolve(updateUserRecord(id, input))
  },

  deleteUser(id) {
    users = users.filter((user) => String(user.id) !== String(id))
    staff = staff.filter((member) => String(member.id) !== String(id))

    return Promise.resolve()
  },

  assignDoctorToRoom(userId, roomId) {
    return Promise.resolve(updateUserRecord(userId, {
      assignedRoomId: String(roomId),
      assignedRoomIds: [String(roomId)],
      roomId: String(roomId),
      roomIds: [String(roomId)],
    }))
  },

  getTerminals() {
    return Promise.resolve(clone(terminals))
  },

  createTerminal(input) {
    const terminal: AdminTerminalRecord = {
      active: input.active ?? true,
      id: nextId('terminal'),
      location: input.location,
      name: input.name,
      roomIds: input.roomIds ?? [],
      serviceTypeIds: input.serviceTypeIds ?? [],
    }

    terminals = [...terminals, terminal]

    return Promise.resolve(clone(terminal))
  },

  updateTerminal(id, input) {
    const currentTerminal = terminals.find((terminal) => String(terminal.id) === String(id))

    if (!currentTerminal) {
      throw new Error(`Terminal ${id} was not found.`)
    }

    const updatedTerminal: AdminTerminalRecord = {
      ...currentTerminal,
      ...input,
      active: input.active ?? currentTerminal.active,
      id,
      location: input.location ?? currentTerminal.location,
      name: input.name ?? currentTerminal.name,
      roomIds: input.roomIds ?? currentTerminal.roomIds,
      serviceTypeIds: input.serviceTypeIds ?? currentTerminal.serviceTypeIds,
    }

    terminals = terminals.map((terminal) => (
      String(terminal.id) === String(id) ? updatedTerminal : terminal
    ))

    return Promise.resolve(clone(updatedTerminal))
  },

  deleteTerminal(id) {
    terminals = terminals.filter((terminal) => String(terminal.id) !== String(id))

    return Promise.resolve()
  },

  getBoardSettings() {
    return Promise.resolve(clone(boardSettings))
  },

  updateBoardSettings(input) {
    boardSettings = {
      ...boardSettings,
      ...input,
      promoMediaByProfileId: input.promoMediaByProfileId ?? boardSettings.promoMediaByProfileId,
      screens: input.screens ?? boardSettings.screens,
      styleSettings: input.styleSettings ?? boardSettings.styleSettings,
    }

    return Promise.resolve(clone(boardSettings))
  },
}
