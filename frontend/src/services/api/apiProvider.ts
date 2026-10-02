export type ApiMode = 'mock' | 'backend'

const rawApiMode = import.meta.env.VITE_API_MODE

export const API_MODE: ApiMode = rawApiMode === 'backend' ? 'backend' : 'mock'
export const API_BASE_URL = import.meta.env.VITE_SMARTQ_API_URL || '/api'
export const isBackendMode = API_MODE === 'backend'
export const isMockMode = API_MODE === 'mock'

function getServerOrigin(url: string): string {
  try {
    return new URL(url, window.location.origin).origin
  } catch {
    return url
  }
}

export const API_SERVER_ORIGIN = getServerOrigin(API_BASE_URL)
export const REALTIME_BASE_URL = getServerOrigin(API_BASE_URL)
