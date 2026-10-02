import axios from 'axios'
import { API_BASE_URL } from './apiProvider'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const publicApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
})
