import type { Role, User } from '@shared/types'
import {
  findUserByEmail,
  isRegisteredEmail,
  mockCredentials,
  mockUsers,
  normalizeUserEmail,
  registerUser,
} from '@mock/auth.mock'
import { deepClone } from '@shared/utils'
import type { AuthApi } from '../types'

function clone<T>(value: T): T {
  return deepClone(value)
}

function createToken(user: User): string {
  return `mock-${user.role}-${Date.now()}`
}

function persistUser(user: User): void {
  localStorage.setItem('mock_access_token', createToken(user))
  localStorage.setItem('currentUser', JSON.stringify(user))
}

function readStoredUser(): User | null {
  const savedUser = localStorage.getItem('currentUser')

  if (!savedUser) {
    return null
  }

  try {
    return JSON.parse(savedUser) as User
  } catch {
    return null
  }
}

export const mockAuthApi: AuthApi = {
  getDefaultUser(): User | null {
    return null
  },

  getCurrentUser(): Promise<User | null> {
    return Promise.resolve(readStoredUser())
  },

  login(email: string, password: string): Promise<User> {
    const normalizedEmail = normalizeUserEmail(email)
    const user = findUserByEmail(normalizedEmail)

    if (!user || mockCredentials[normalizedEmail] !== password) {
      return Promise.reject(new Error('Invalid email or password.'))
    }

    const result = clone(user)

    persistUser(result)

    return Promise.resolve(result)
  },

  register(name: string, email: string, password: string, role: Role): Promise<User> {
    try {
      const user = registerUser(name, email, password, role)
      const result = clone(user)

      persistUser(result)

      return Promise.resolve(result)
    } catch (error) {
      return Promise.reject(error)
    }
  },

  resetPassword(email: string): Promise<void> {
    if (!isRegisteredEmail(email)) {
      return Promise.reject(new Error('Email is not registered.'))
    }

    return Promise.resolve()
  },

  loginAsRole(role: Role): Promise<User> {
    const user = clone(mockUsers[role])

    persistUser(user)

    return Promise.resolve(user)
  },

  logout(): Promise<void> {
    localStorage.removeItem('mock_access_token')
    localStorage.removeItem('currentUser')

    return Promise.resolve()
  },
}
