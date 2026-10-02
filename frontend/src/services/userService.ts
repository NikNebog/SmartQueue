import { adminApi, authApi, toServiceError } from './api'
import type { User as SharedUser } from '@shared/types'
import type { User, UserRole } from '../types'

type AuthResponse = {
  access_token: string
  role: UserRole
}

function toArchitectureUser(user: SharedUser): User {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  }
}

export const userService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const user = await authApi.login(email, password)

      return {
        access_token: '',
        role: user.role,
      }
    } catch (error) {
      console.error('userService.login failed', error)
      throw toServiceError(error, 'Не удалось войти в систему')
    }
  },

  async register(
    name: string,
    email: string,
    password: string,
    role: UserRole,
  ): Promise<AuthResponse> {
    try {
      const user = await authApi.register(name, email, password, role)

      return {
        access_token: '',
        role: user.role,
      }
    } catch (error) {
      console.error('userService.register failed', error)
      throw toServiceError(error, 'Не удалось зарегистрироваться')
    }
  },

  async resetPassword(email: string): Promise<void> {
    try {
      await authApi.resetPassword(email)
    } catch (error) {
      console.error('userService.resetPassword failed', error)
      throw toServiceError(error, 'Не удалось отправить письмо для восстановления пароля')
    }
  },

  async getCurrentUser(): Promise<User | undefined> {
    try {
      const user = await authApi.getCurrentUser()

      return user ? toArchitectureUser(user) : undefined
    } catch (error) {
      console.error('userService.getCurrentUser failed', error)
      throw toServiceError(error, 'Не удалось получить текущего пользователя')
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      const users = await adminApi.getUsers()

      return users.map(toArchitectureUser)
    } catch (error) {
      console.error('userService.getUsers failed', error)
      throw toServiceError(error, 'Не удалось получить пользователей')
    }
  },

  logout() {
    try {
      authApi.logout()
    } catch (error) {
      console.error('userService.logout failed', error)
      throw toServiceError(error, 'Не удалось выйти из системы')
    }
  },
}
