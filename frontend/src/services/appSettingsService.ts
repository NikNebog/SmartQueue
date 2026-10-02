import { useSyncExternalStore } from 'react'
import { getApiErrorMessage } from './api'
import { apiClient } from './api/client'
import { isBackendMode } from './api/apiProvider'

export type AppSettings = {
  appName: string
  logoDataUrl?: string
}

export const appSettingsStorageKey = 'smartq_app_settings'

export const defaultAppSettings: AppSettings = {
  appName: 'SmartQ',
  logoDataUrl: '',
}

let currentSettings = readStoredSettings()
const listeners = new Set<() => void>()

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return defaultAppSettings
  }

  const record = value as Partial<AppSettings>
  const appName = typeof record.appName === 'string' && record.appName.trim()
    ? record.appName.trim()
    : defaultAppSettings.appName
  const logoDataUrl = typeof record.logoDataUrl === 'string' ? record.logoDataUrl : ''

  return { appName, logoDataUrl }
}

function readStoredSettings(): AppSettings {
  try {
    const saved = window.localStorage.getItem(appSettingsStorageKey)

    return saved ? normalizeSettings(JSON.parse(saved)) : defaultAppSettings
  } catch {
    return defaultAppSettings
  }
}

function saveStoredSettings(settings: AppSettings): AppSettings {
  const normalizedSettings = normalizeSettings(settings)

  try {
    window.localStorage.setItem(appSettingsStorageKey, JSON.stringify(normalizedSettings))
  } catch (error) {
    console.warn('appSettingsService: localStorage quota exceeded, storing settings without logo', error)

    try {
      window.localStorage.setItem(appSettingsStorageKey, JSON.stringify({
        ...normalizedSettings,
        logoDataUrl: '',
      }))
    } catch {
      window.localStorage.removeItem(appSettingsStorageKey)
    }
  }

  return normalizedSettings
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

function notifySettingsChanged(settings: AppSettings): AppSettings {
  currentSettings = settings
  listeners.forEach((listener) => listener())

  return currentSettings
}

function getSnapshot(): AppSettings {
  return currentSettings
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

export function getAppInitials(appName = currentSettings.appName): string {
  return appName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SQ'
}

export function useAppSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const appSettingsService = {
  getSettings(): AppSettings {
    return currentSettings
  },

  async loadSettings(): Promise<AppSettings> {
    if (!isBackendMode) {
      return currentSettings
    }

    try {
      const response = await apiClient.get<unknown>('/app-settings')
      const settings = normalizeSettings(response.data)

      saveStoredSettings(settings)

      return notifySettingsChanged(settings)
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw new Error(getApiErrorMessage(error, 'Не удалось загрузить настройки приложения'))
      }

      console.warn('appSettingsService.loadSettings: backend endpoint недоступен', error)

      return currentSettings
    }
  },

  async updateSettings(input: AppSettings): Promise<AppSettings> {
    const localSettings = normalizeSettings(input)

    if (!isBackendMode) {
      return notifySettingsChanged(saveStoredSettings(localSettings))
    }

    try {
      const response = await apiClient.patch<unknown>('/app-settings', localSettings)
      const settings = saveStoredSettings(normalizeSettings(response.data))

      return notifySettingsChanged(settings)
    } catch (error) {
      if (!isRecoverableStorageFallbackError(error)) {
        throw new Error(getApiErrorMessage(error, 'Не удалось сохранить настройки приложения'))
      }

      console.warn('appSettingsService.updateSettings: backend endpoint недоступен, сохраняем локально', error)

      return notifySettingsChanged(saveStoredSettings(localSettings))
    }
  },
}
