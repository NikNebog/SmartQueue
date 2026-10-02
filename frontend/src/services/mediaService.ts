import { apiClient, publicApiClient } from './api/client'
import { API_BASE_URL, API_SERVER_ORIGIN } from './api/apiProvider'

export type MediaFile = {
  id: number
  type: 'video' | 'image'
  filename: string
  url: string
  createdAt: string
}

type LatestMedia = {
  image: MediaFile | null
  video: MediaFile | null
}

const allowedMediaExtensions = /\.(jpe?g|png|gif|mp4|webm|mov)$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function getMediaType(record: Record<string, unknown>): MediaFile['type'] {
  const rawType = getString(record.type).toLowerCase()

  if (rawType === 'video' || rawType === 'image') {
    return rawType
  }

  const filename = getString(record.filename ?? record.name ?? record.originalname)
  const url = getString(record.url ?? record.path)

  return /\.(mp4|webm|mov)$/i.test(filename || url) ? 'video' : 'image'
}

function normalizeMediaFile(value: unknown): MediaFile | null {
  if (!isRecord(value)) {
    return null
  }

  const rawId = value.id ?? value._id
  const id = Number(rawId)
  const filename = getString(value.filename ?? value.name ?? value.originalname)
  const url = getString(value.url ?? value.path)

  if (!Number.isFinite(id) || !url) {
    return null
  }

  return {
    createdAt: getString(value.createdAt ?? value.created_at) || new Date().toISOString(),
    filename: filename || url.split('/').pop() || `media-${id}`,
    id,
    type: getMediaType(value),
    url,
  }
}

function toMediaFiles(value: unknown): MediaFile[] {
  const source = isRecord(value) && Array.isArray(value.data)
    ? value.data
    : isRecord(value) && Array.isArray(value.files)
      ? value.files
      : isRecord(value) && Array.isArray(value.media)
        ? value.media
        : value

  if (!Array.isArray(source)) {
    const mediaFile = normalizeMediaFile(source)

    return mediaFile ? [mediaFile] : []
  }

  return source
    .map(normalizeMediaFile)
    .filter((mediaFile): mediaFile is MediaFile => Boolean(mediaFile))
}

function toLatestMedia(value: unknown): LatestMedia {
  const record = isRecord(value) && isRecord(value.data) ? value.data : value

  if (isRecord(record)) {
    return {
      image: normalizeMediaFile(record.image),
      video: normalizeMediaFile(record.video),
    }
  }

  const files = toMediaFiles(value)

  return {
    image: files.find((file) => file.type === 'image') ?? null,
    video: files.find((file) => file.type === 'video') ?? null,
  }
}

function assertAllowedMedia(file: File): void {
  if (!allowedMediaExtensions.test(file.name)) {
    throw new Error('Поддерживаются jpeg, jpg, png, gif, mp4, webm, mov')
  }
}

export const mediaService = {
  async uploadMedia(file: File): Promise<MediaFile> {
    assertAllowedMedia(file)

    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<unknown>('/media/upload', formData, {
      timeout: 300_000,
    })
    const responseData = isRecord(response.data)
      ? response.data.file ?? response.data.media ?? response.data.data ?? response.data
      : response.data
    const mediaFile = normalizeMediaFile(responseData)

    if (!mediaFile) {
      throw new Error('Backend не вернул данные медиафайла')
    }

    return mediaFile
  },

  async getLatestMedia(): Promise<LatestMedia> {
    const response = await publicApiClient.get<unknown>('/media/latest')

    return toLatestMedia(response.data)
  },

  async getMediaFiles(): Promise<MediaFile[]> {
    const response = await apiClient.get<unknown>('/media')

    return toMediaFiles(response.data)
  },

  async deleteMedia(id: number): Promise<void> {
    await apiClient.delete(`/media/${id}`)
  },

  getMediaFullUrl(url: string): string {
    const normalizedUrl = url.trim()

    if (!normalizedUrl) {
      return ''
    }

    if (/^https?:\/\//i.test(normalizedUrl) || normalizedUrl.startsWith('data:')) {
      return normalizedUrl
    }

    if (normalizedUrl.startsWith('/api/uploads/')) {
      return `${API_SERVER_ORIGIN}${normalizedUrl.slice(4)}`
    }

    if (normalizedUrl.startsWith('/uploads/')) {
      return `${API_SERVER_ORIGIN}${normalizedUrl}`
    }

    const baseUrl = API_BASE_URL.replace(/\/$/, '')
    const path = normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`

    return `${baseUrl}${path}`
  },
}
