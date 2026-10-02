import { API_BASE_URL, API_MODE, isBackendMode, isMockMode } from './api/apiProvider'

export const appModeService = {
  getApiBaseUrl() {
    return API_BASE_URL
  },

  getApiMode() {
    return API_MODE
  },

  isBackendMode() {
    return isBackendMode
  },

  isMockMode() {
    return isMockMode
  },
}
