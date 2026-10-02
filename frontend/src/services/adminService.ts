import {
  adminApi,
  toServiceError,
  type AdminRecord,
  type AdminRecordInput,
  type AdminServiceTypeInput,
  type AdminTerminalInput,
  type AdminTerminalRecord,
  type AdminUserInput,
  type BoardSettings,
  type TicketSettingsServiceTypeOption,
} from './api'
import { refreshOperationalData, withOperationalRefresh } from './syncService'
import { notifyServiceTypesChanged } from './serviceTypeSync'
import { normalizeBoardPromoMediaStorage } from './boardPromoMediaService'
import { normalizeBoardStyleSettings } from './boardStyleSettingsService'
import type { User } from '@shared/types'
import type { BoardTemplate } from './api'

export type AdminRoomPayload = {
  active?: boolean
  estimatedWaitMinutes?: number | null
  isActive?: boolean
  isTicketIssueEnabled?: boolean
  kioskEnabled?: boolean
  name?: string
  number?: string | number
  placeType?: string
  serviceTypeIds?: Array<string | number>
  ticketIssueEnabled?: boolean
  workEndTime?: string
  workStartTime?: string
  workingEndTime?: string
  workingStartTime?: string
}

export type AdminUserPayload = AdminUserInput & {
  assignedRoomId?: string | number
  assignedRoomIds?: Array<string | number>
  email?: string
  roomId?: string | number
  roomIds?: Array<string | number>
}

export type AdminServiceTypePayload = AdminServiceTypeInput
export type AdminTerminalPayload = AdminTerminalInput
export type AdminBoardSettings = BoardSettings

const terminalStorageKey = 'smartq_terminals'
const boardSettingsStorageKey = 'smartq_board_settings'
const legacyBoardScreensStorageKey = 'smartq_board_screens'

const defaultBoardSettings: AdminBoardSettings = {
  boardType: 'general',
  liteMode: false,
  marqueeOffsetPx: 0,
  marqueeSizePercent: 100,
  marqueeText: '',
  promoMediaByProfileId: {},
  showMarquee: true,
  profiles: [],
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

function onlySpecialists(users: User[]): User[] {
  return users.filter((user) => user.role === 'specialist')
}

function onlyManagers(users: User[]): User[] {
  return users.filter((user) => user.role === 'manager')
}

function normalizeId(value: string | number): string | number {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && String(value).trim() !== '' ? numberValue : value
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key)

    return saved ? JSON.parse(saved) as T : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage<T>(key: string, value: T): T {
  window.localStorage.setItem(key, JSON.stringify(value))

  return value
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined
  }

  const response = (error as { response?: { status?: unknown } }).response

  return typeof response?.status === 'number' ? response.status : undefined
}

function isRecoverableStorageFallbackError(error: unknown): boolean {
  const status = getHttpStatus(error)

  if (status === undefined) {
    return true
  }

  return status === 404
    || status === 405
    || status === 501
    || status === 502
    || status === 503
    || status === 504
}

function normalizeIdList(values?: Array<string | number>): Array<string | number> {
  return (values ?? []).map(normalizeId)
}

function normalizeBoardTemplate(template?: BoardTemplate): BoardTemplate {
  return template === 'grid'
    || template === 'list'
    || template === 'minimal'
    || template === 'cards'
    || template === 'video_queue'
    || template === 'big_board'
    ? template
    : defaultBoardSettings.template
}

function normalizeMarqueeSizePercent(value: unknown): number {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? Math.min(300, Math.max(60, Math.round(numericValue)))
    : (defaultBoardSettings.marqueeSizePercent ?? 100)
}

function normalizeMarqueeOffsetPx(value: unknown): number {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? Math.min(200, Math.max(-200, Math.round(numericValue)))
    : (defaultBoardSettings.marqueeOffsetPx ?? 0)
}

function normalizeTerminal(record: AdminTerminalRecord | AdminTerminalInput & { id?: string | number }): AdminTerminalRecord {
  return {
    active: record.active ?? true,
    id: record.id ?? `terminal-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    location: record.location.trim(),
    name: record.name.trim(),
    roomIds: normalizeIdList(record.roomIds),
    serviceTypeIds: normalizeIdList(record.serviceTypeIds),
  }
}

function readStoredTerminals(): AdminTerminalRecord[] {
  return readJsonStorage<AdminTerminalRecord[]>(terminalStorageKey, []).map(normalizeTerminal)
}

function writeStoredTerminals(terminals: AdminTerminalRecord[]): AdminTerminalRecord[] {
  return writeJsonStorage(terminalStorageKey, terminals.map(normalizeTerminal))
}

function normalizeBoardSettings(settings: Partial<AdminBoardSettings> = {}): AdminBoardSettings {
  const recentCallsLimitValue = Number(settings.recentCallsLimit)
  const recentCallsLimit = Number.isFinite(recentCallsLimitValue)
    ? Math.min(30, Math.max(0, Math.trunc(recentCallsLimitValue)))
    : defaultBoardSettings.recentCallsLimit
  const template = normalizeBoardTemplate(settings.template)

  const profiles = (settings.profiles ?? [])
    .map((profile) => normalizeBoardSettings({
      boardType: profile.boardType,
      liteMode: profile.liteMode,
      marqueeOffsetPx: profile.marqueeOffsetPx,
      marqueeSizePercent: profile.marqueeSizePercent,
      marqueeText: profile.marqueeText,
      showMarquee: profile.showMarquee,
      recentCallsLimit: profile.recentCallsLimit,
      roomBoardId: profile.roomBoardId,
      roomIds: profile.roomIds,
      screens: [],
      showRecentCalls: profile.showRecentCalls,
      showTime: profile.showTime,
      template: profile.template,
      voiceEnabled: profile.voiceEnabled,
    }))
    .map((profileSettings, index) => {
      const sourceProfile = settings.profiles?.[index]

      return {
        boardType: profileSettings.boardType,
        id: sourceProfile?.id || `${profileSettings.boardType}-${sourceProfile?.roomBoardId || 'general'}`,
        liteMode: sourceProfile?.liteMode ?? profileSettings.liteMode ?? false,
        marqueeOffsetPx: normalizeMarqueeOffsetPx(sourceProfile?.marqueeOffsetPx ?? profileSettings.marqueeOffsetPx),
        marqueeSizePercent: normalizeMarqueeSizePercent(sourceProfile?.marqueeSizePercent ?? profileSettings.marqueeSizePercent),
        marqueeText: profileSettings.marqueeText,
        showMarquee: sourceProfile?.showMarquee ?? profileSettings.showMarquee,
        name: sourceProfile?.name || (profileSettings.boardType === 'general' ? 'Общее табло' : 'Индивидуальное табло'),
        recentCallsLimit: profileSettings.recentCallsLimit,
        roomBoardId: profileSettings.roomBoardId,
        roomIds: (sourceProfile?.roomIds ?? profileSettings.roomIds ?? []).map(String),
        showRecentCalls: profileSettings.showRecentCalls,
        showTime: profileSettings.showTime,
        template: profileSettings.template,
        voiceEnabled: profileSettings.voiceEnabled,
      }
    })
  const styleSettings = settings.styleSettings && typeof settings.styleSettings === 'object'
    ? Object.fromEntries(
      Object.entries(settings.styleSettings)
        .filter(([, profileSettings]) => profileSettings && typeof profileSettings === 'object')
        .map(([profileId, profileSettings]) => [
          profileId,
          normalizeBoardStyleSettings(profileSettings),
        ]),
    )
    : defaultBoardSettings.styleSettings
  const promoMediaByProfileId = normalizeBoardPromoMediaStorage(settings.promoMediaByProfileId)

  return {
    boardType: settings.boardType === 'individual' ? 'individual' : defaultBoardSettings.boardType,
    liteMode: settings.liteMode ?? defaultBoardSettings.liteMode,
    marqueeOffsetPx: normalizeMarqueeOffsetPx(settings.marqueeOffsetPx),
    marqueeSizePercent: normalizeMarqueeSizePercent(settings.marqueeSizePercent),
    marqueeText: typeof settings.marqueeText === 'string' ? settings.marqueeText : defaultBoardSettings.marqueeText,
    promoMediaByProfileId,
    showMarquee: settings.showMarquee ?? defaultBoardSettings.showMarquee,
    profiles,
    recentCallsLimit,
    roomBoardId: settings.roomBoardId ?? defaultBoardSettings.roomBoardId,
    roomIds: (settings.roomIds ?? defaultBoardSettings.roomIds ?? []).map(String),
    screens: settings.screens ?? defaultBoardSettings.screens,
    showRecentCalls: settings.showRecentCalls ?? defaultBoardSettings.showRecentCalls,
    showTime: settings.showTime ?? defaultBoardSettings.showTime,
    styleSettings,
    template,
    voiceEnabled: settings.voiceEnabled ?? defaultBoardSettings.voiceEnabled,
  }
}

function readStoredBoardSettings(): AdminBoardSettings {
  const settings = normalizeBoardSettings(readJsonStorage<Partial<AdminBoardSettings>>(boardSettingsStorageKey, {}))

  if (settings.screens.length > 0) {
    return settings
  }

  const legacyScreens = readJsonStorage<AdminBoardSettings['screens']>(legacyBoardScreensStorageKey, [])

  return legacyScreens.length > 0 ? { ...settings, screens: legacyScreens } : settings
}

function writeStoredBoardSettings(settings: AdminBoardSettings): AdminBoardSettings {
  return writeJsonStorage(boardSettingsStorageKey, normalizeBoardSettings(settings))
}

function mergeBoardSettingsWithFallback(
  remoteSettings: AdminBoardSettings,
  fallbackSettings: AdminBoardSettings,
): AdminBoardSettings {
  return normalizeBoardSettings({
    ...remoteSettings,
    profiles: (remoteSettings.profiles?.length ?? 0) > 0 ? remoteSettings.profiles : fallbackSettings.profiles,
    promoMediaByProfileId: Object.keys(remoteSettings.promoMediaByProfileId ?? {}).length > 0
      ? remoteSettings.promoMediaByProfileId
      : fallbackSettings.promoMediaByProfileId,
    screens: (remoteSettings.screens?.length ?? 0) > 0 ? remoteSettings.screens : fallbackSettings.screens,
    styleSettings: Object.keys(remoteSettings.styleSettings ?? {}).length > 0
      ? remoteSettings.styleSettings
      : fallbackSettings.styleSettings,
  })
}

function getRoomServiceTypeIds(room: AdminRecord): string[] {
  const record = room as AdminRecord & {
    serviceTypeId?: string | number
    serviceTypeIds?: Array<string | number>
    serviceTypes?: Array<string | number | { _id?: string | number; id?: string | number; serviceTypeId?: string | number }>
    services?: Array<string | number | { _id?: string | number; id?: string | number; serviceTypeId?: string | number }>
  }

  if (record.serviceTypeId !== undefined) {
    return [String(record.serviceTypeId)]
  }

  if (Array.isArray(record.serviceTypeIds)) {
    return record.serviceTypeIds.map(String)
  }

  return [...(record.serviceTypes ?? []), ...(record.services ?? [])]
    .map((serviceType) => {
      if (typeof serviceType === 'string' || typeof serviceType === 'number') {
        return String(serviceType)
      }

      return String(serviceType.serviceTypeId ?? serviceType.id ?? serviceType._id ?? '')
    })
    .filter(Boolean)
}

export const adminService = {
  async getServiceTypes(): Promise<TicketSettingsServiceTypeOption[]> {
    try {
      return await adminApi.getServiceTypes()
    } catch (error) {
      console.error('adminService.getServiceTypes failed', error)
      throw toServiceError(error, 'Не удалось получить типы услуг')
    }
  },

  async createServiceType(input: AdminServiceTypePayload): Promise<TicketSettingsServiceTypeOption> {
    try {
      const serviceType = await withOperationalRefresh(
        () => adminApi.createServiceType(input),
        'Типы услуг обновлены',
      )

      notifyServiceTypesChanged()

      return serviceType
    } catch (error) {
      console.error('adminService.createServiceType failed', error)
      throw toServiceError(error, 'Не удалось создать тип услуги')
    }
  },

  async updateServiceType(
    id: string | number,
    input: Partial<AdminServiceTypePayload>,
  ): Promise<TicketSettingsServiceTypeOption> {
    try {
      const serviceType = await withOperationalRefresh(
        () => adminApi.updateServiceType(id, input),
        'Типы услуг обновлены',
      )

      notifyServiceTypesChanged()

      return serviceType
    } catch (error) {
      console.error('adminService.updateServiceType failed', error)
      throw toServiceError(error, 'Не удалось сохранить тип услуги')
    }
  },

  async deleteServiceType(id: string | number): Promise<void> {
    try {
      await withOperationalRefresh(
        () => adminApi.deleteServiceType(id),
        'Типы услуг обновлены',
      )
      notifyServiceTypesChanged()
    } catch (error) {
      console.error('adminService.deleteServiceType failed', error)
      throw toServiceError(error, 'Не удалось удалить тип услуги')
    }
  },

  async getRooms(): Promise<AdminRecord[]> {
    try {
      return await adminApi.getRooms()
    } catch (error) {
      console.error('adminService.getRooms failed', error)
      throw toServiceError(error, 'Не удалось получить кабинеты')
    }
  },

  async createRoom(input: AdminRoomPayload): Promise<AdminRecord> {
    try {
      return await withOperationalRefresh(
        () => adminApi.createRoom(input as AdminRecordInput),
        'Кабинеты обновлены',
      )
    } catch (error) {
      console.error('adminService.createRoom failed', error)
      throw toServiceError(error, 'Не удалось создать кабинет')
    }
  },

  async updateRoom(id: string | number, input: AdminRoomPayload): Promise<AdminRecord> {
    try {
      return await withOperationalRefresh(
        () => adminApi.updateRoom(id, input as AdminRecordInput),
        'Кабинеты обновлены',
      )
    } catch (error) {
      console.error('adminService.updateRoom failed', error)
      throw toServiceError(error, 'Не удалось сохранить кабинет')
    }
  },

  async updateRoomTicketIssue(id: string | number, enabled: boolean): Promise<AdminRecord> {
    try {
      return await adminApi.updateRoomTicketIssue(id, enabled)
    } catch (error) {
      console.error('adminService.updateRoomTicketIssue failed', error)
      throw toServiceError(error, 'Не удалось изменить выдачу талонов')
    }
  },

  async deleteRoom(id: string | number): Promise<void> {
    try {
      await withOperationalRefresh(
        () => adminApi.deleteRoom(id),
        'Кабинеты обновлены',
      )
    } catch (error) {
      console.error('adminService.deleteRoom failed', error)
      throw toServiceError(error, 'Не удалось удалить кабинет')
    }
  },

  async getTerminals(): Promise<AdminTerminalRecord[]> {
    try {
      const terminals = await adminApi.getTerminals()

      return terminals.map(normalizeTerminal)
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw toServiceError(error, 'Не удалось получить терминалы')
      }

      console.warn('adminService.getTerminals: backend endpoint недоступен, используем временное хранилище', error)

      return readStoredTerminals()
    }
  },

  async createTerminal(input: AdminTerminalPayload): Promise<AdminTerminalRecord> {
    try {
      return normalizeTerminal(await adminApi.createTerminal(input))
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw toServiceError(error, 'Не удалось создать терминал')
      }

      console.warn('adminService.createTerminal: backend endpoint недоступен, сохраняем локально', error)
      const nextTerminal = normalizeTerminal(input)
      const terminals = writeStoredTerminals([...readStoredTerminals(), nextTerminal])

      return terminals.find((terminal) => String(terminal.id) === String(nextTerminal.id)) ?? nextTerminal
    }
  },

  async updateTerminal(
    id: string | number,
    input: Partial<AdminTerminalPayload>,
  ): Promise<AdminTerminalRecord> {
    try {
      return normalizeTerminal(await adminApi.updateTerminal(id, input))
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw toServiceError(error, 'Не удалось сохранить терминал')
      }

      console.warn('adminService.updateTerminal: backend endpoint недоступен, сохраняем локально', error)
      const terminals = readStoredTerminals()
      const currentTerminal = terminals.find((terminal) => String(terminal.id) === String(id))

      if (!currentTerminal) {
        throw new Error('Терминал не найден')
      }

      const updatedTerminal = normalizeTerminal({ ...currentTerminal, ...input, id })

      writeStoredTerminals(terminals.map((terminal) => (
        String(terminal.id) === String(id) ? updatedTerminal : terminal
      )))

      return updatedTerminal
    }
  },

  async deleteTerminal(id: string | number): Promise<void> {
    try {
      await adminApi.deleteTerminal(id)
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw toServiceError(error, 'Не удалось удалить терминал')
      }

      console.warn('adminService.deleteTerminal: backend endpoint недоступен, удаляем локально', error)
    }

    writeStoredTerminals(readStoredTerminals().filter((terminal) => String(terminal.id) !== String(id)))
  },

  async getBoardSettings(): Promise<AdminBoardSettings> {
    try {
      const remoteSettings = normalizeBoardSettings(await adminApi.getBoardSettings())
      writeStoredBoardSettings(remoteSettings)

      return remoteSettings
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw toServiceError(error, 'Не удалось получить настройки табло')
      }

      console.warn('adminService.getBoardSettings: backend endpoint недоступен, используем временное хранилище', error)

      return readStoredBoardSettings()
    }
  },

  async updateBoardSettings(input: Partial<AdminBoardSettings>): Promise<AdminBoardSettings> {
    const localSettings = normalizeBoardSettings({ ...readStoredBoardSettings(), ...input })

    try {
      const savedSettings = normalizeBoardSettings(await adminApi.updateBoardSettings(localSettings))
      const mergedSettings = mergeBoardSettingsWithFallback(savedSettings, localSettings)

      writeStoredBoardSettings(mergedSettings)

      return mergedSettings
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw toServiceError(error, 'Не удалось сохранить настройки табло')
      }

      console.warn('adminService.updateBoardSettings: backend endpoint недоступен, сохраняем локально', error)

      return writeStoredBoardSettings(localSettings)
    }
  },

  async updateQueueRouting(serviceTypeId: string | number, roomIds: Array<string | number>): Promise<void> {
    try {
      const rooms = await adminApi.getRooms()
      const selectedRoomIds = new Set(roomIds.map(String))
      const normalizedServiceTypeId = String(serviceTypeId)

      await Promise.all(rooms.map((room) => {
        const roomId = String(room.id)
        const currentServiceTypeIds = getRoomServiceTypeIds(room)
        const nextServiceTypeIds = selectedRoomIds.has(roomId)
          ? Array.from(new Set([...currentServiceTypeIds, normalizedServiceTypeId]))
          : currentServiceTypeIds.filter((id) => id !== normalizedServiceTypeId)
        const changed = nextServiceTypeIds.length !== currentServiceTypeIds.length ||
          nextServiceTypeIds.some((id) => !currentServiceTypeIds.includes(id))

        if (!changed) {
          return Promise.resolve()
        }

        return adminApi.updateRoom(room.id, {
          active: typeof room.active === 'boolean' ? room.active : undefined,
          isActive: typeof room.isActive === 'boolean' ? room.isActive : undefined,
          isTicketIssueEnabled: typeof room.isTicketIssueEnabled === 'boolean' ? room.isTicketIssueEnabled : undefined,
          kioskEnabled: typeof room.kioskEnabled === 'boolean' ? room.kioskEnabled : undefined,
          name: typeof room.name === 'string' ? room.name : String(room.id),
          serviceTypeIds: nextServiceTypeIds.map(normalizeId),
          ticketIssueEnabled: typeof room.ticketIssueEnabled === 'boolean' ? room.ticketIssueEnabled : undefined,
          workEndTime: typeof room.workEndTime === 'string' ? room.workEndTime : undefined,
          workStartTime: typeof room.workStartTime === 'string' ? room.workStartTime : undefined,
          workingEndTime: typeof room.workingEndTime === 'string' ? room.workingEndTime : undefined,
          workingStartTime: typeof room.workingStartTime === 'string' ? room.workingStartTime : undefined,
        } as AdminRecordInput)
      }))

      await refreshOperationalData('Настройки очередей обновлены')
    } catch (error) {
      console.error('adminService.updateQueueRouting failed', error)
      throw toServiceError(error, 'Не удалось сохранить настройки очереди')
    }
  },

  async getStaff(): Promise<User[]> {
    try {
      const users = await adminApi.getUsers()

      return onlySpecialists(users)
    } catch (error) {
      console.error('adminService.getStaff failed', error)
      throw toServiceError(error, 'Не удалось получить персонал')
    }
  },

  async createDoctor(input: Omit<AdminUserPayload, 'role'> & { role?: 'specialist' }): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.createUser({
          ...input,
          role: 'specialist',
        } as AdminUserInput),
        'Персонал обновлён',
      )
    } catch (error) {
      console.error('adminService.createDoctor failed', error)
      throw toServiceError(error, 'Не удалось создать врача')
    }
  },

  async updateStaff(id: string | number, input: Partial<AdminUserPayload>): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.updateUser(id, input as Partial<AdminUserInput>),
        'Персонал обновлён',
      )
    } catch (error) {
      console.error('adminService.updateStaff failed', error)
      throw toServiceError(error, 'Не удалось сохранить врача')
    }
  },

  async deleteStaff(id: string | number): Promise<void> {
    try {
      await withOperationalRefresh(
        () => adminApi.deleteUser(id),
        'Персонал обновлён',
      )
    } catch (error) {
      console.error('adminService.deleteStaff failed', error)
      throw toServiceError(error, 'Не удалось удалить врача')
    }
  },

  async assignDoctorToRoom(userId: string | number, roomId: string | number): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.assignDoctorToRoom(userId, roomId),
        'Назначение кабинета обновлено',
      )
    } catch (error) {
      console.error('adminService.assignDoctorToRoom failed', error)
      throw toServiceError(error, 'Не удалось назначить кабинет врачу')
    }
  },

  async getManagers(): Promise<User[]> {
    try {
      const users = await adminApi.getUsers()

      return onlyManagers(users)
    } catch (error) {
      console.error('adminService.getManagers failed', error)
      throw toServiceError(error, 'Не удалось получить менеджеров')
    }
  },

  async createManager(input: Omit<AdminUserPayload, 'role'>): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.createUser({
          ...input,
          role: 'manager',
        } as AdminUserInput),
        'Менеджеры обновлены',
      )
    } catch (error) {
      console.error('adminService.createManager failed', error)
      throw toServiceError(error, 'Не удалось создать менеджера')
    }
  },

  async updateManager(id: string | number, input: Partial<AdminUserPayload>): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.updateUser(id, {
          ...input,
          role: 'manager',
        } as Partial<AdminUserInput>),
        'Менеджеры обновлены',
      )
    } catch (error) {
      console.error('adminService.updateManager failed', error)
      throw toServiceError(error, 'Не удалось сохранить менеджера')
    }
  },

  async deleteManager(id: string | number): Promise<void> {
    try {
      await withOperationalRefresh(
        () => adminApi.deleteUser(id),
        'Менеджеры обновлены',
      )
    } catch (error) {
      console.error('adminService.deleteManager failed', error)
      throw toServiceError(error, 'Не удалось удалить менеджера')
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      return await adminApi.getUsers()
    } catch (error) {
      console.error('adminService.getUsers failed', error)
      throw toServiceError(error, 'Не удалось получить пользователей')
    }
  },

  async createUser(input: AdminUserInput): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.createUser(input),
        'Пользователи обновлены',
      )
    } catch (error) {
      console.error('adminService.createUser failed', error)
      throw toServiceError(error, 'Не удалось создать пользователя')
    }
  },

  async updateUser(id: string | number, input: Partial<AdminUserInput>): Promise<User> {
    try {
      return await withOperationalRefresh(
        () => adminApi.updateUser(id, input),
        'Пользователи обновлены',
      )
    } catch (error) {
      console.error('adminService.updateUser failed', error)
      throw toServiceError(error, 'Не удалось сохранить пользователя')
    }
  },

  async deleteUser(id: string | number): Promise<void> {
    try {
      await withOperationalRefresh(
        () => adminApi.deleteUser(id),
        'Пользователи обновлены',
      )
    } catch (error) {
      console.error('adminService.deleteUser failed', error)
      throw toServiceError(error, 'Не удалось удалить пользователя')
    }
  },
}
