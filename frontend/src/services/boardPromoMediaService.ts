import { mediaService, type MediaFile } from './mediaService'
import type { BoardPromoImageItem, BoardPromoMedia, BoardPromoVideoItem } from './api'
export type { BoardPromoImageItem, BoardPromoMedia, BoardPromoVideoItem } from './api'

export type BoardVideoUrlValidation = {
  error?: string
  normalizedUrl: string
  valid: boolean
}

export type BoardMediaUrlValidation = BoardVideoUrlValidation & {
  mediaType?: MediaFile['type']
}

const boardPromoMediaStorageKey = 'smartq_board_promo_media'
const defaultProfileId = 'general'
export const invalidBoardVideoUrlMessage = 'Введите корректную ссылку на видео'
export const directBoardVideoUrlMessage = 'Для табло нужна прямая ссылка на видеофайл mp4/webm/ogg'

type PromoMediaStorage = Record<string, BoardPromoMedia>
const invalidBoardMediaUrlMessage = 'Введите корректную ссылку на медиафайл'
const directBoardMediaUrlMessage = 'Нужна прямая ссылка на файл PNG, JPG, WebP, GIF, MP4, WebM или OGG'

export function getBoardPromoUrlInputValue(url?: string): string {
  const normalizedUrl = String(url ?? '').trim()

  return normalizedUrl && !normalizedUrl.toLowerCase().startsWith('data:')
    ? normalizedUrl
    : ''
}

function isYouTubeUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase()

  return hostname === 'youtu.be'
    || hostname.endsWith('.youtu.be')
    || hostname === 'youtube.com'
    || hostname.endsWith('.youtube.com')
}

export function validateBoardVideoUrl(videoUrl: string): BoardVideoUrlValidation {
  const normalizedUrl = videoUrl.trim()

  if (!normalizedUrl) {
    return { normalizedUrl: '', valid: true }
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(normalizedUrl)
  } catch {
    return {
      error: invalidBoardVideoUrlMessage,
      normalizedUrl,
      valid: false,
    }
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      error: invalidBoardVideoUrlMessage,
      normalizedUrl,
      valid: false,
    }
  }

  if (isYouTubeUrl(parsedUrl) || !/\.(mp4|webm|ogg)$/i.test(parsedUrl.pathname)) {
    return {
      error: directBoardVideoUrlMessage,
      normalizedUrl,
      valid: false,
    }
  }

  return { normalizedUrl, valid: true }
}

export function validateBoardMediaUrl(mediaUrl: string): BoardMediaUrlValidation {
  const normalizedUrl = mediaUrl.trim()

  if (!normalizedUrl) {
    return { normalizedUrl: '', valid: true }
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(normalizedUrl)
  } catch {
    return {
      error: invalidBoardMediaUrlMessage,
      normalizedUrl,
      valid: false,
    }
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      error: invalidBoardMediaUrlMessage,
      normalizedUrl,
      valid: false,
    }
  }

  if (isYouTubeUrl(parsedUrl)) {
    return {
      error: directBoardMediaUrlMessage,
      normalizedUrl,
      valid: false,
    }
  }

  if (/\.(mp4|webm|ogg)$/i.test(parsedUrl.pathname)) {
    return { mediaType: 'video', normalizedUrl, valid: true }
  }

  if (/\.(png|jpe?g|webp|gif)$/i.test(parsedUrl.pathname)) {
    return { mediaType: 'image', normalizedUrl, valid: true }
  }

  return {
    error: directBoardMediaUrlMessage,
    normalizedUrl,
    valid: false,
  }
}

function normalizeProfileId(profileId?: string | null): string {
  const normalizedProfileId = String(profileId ?? '').trim()

  return normalizedProfileId || defaultProfileId
}

export function normalizeBoardPromoMedia(value: unknown): BoardPromoMedia {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const record = value as Partial<BoardPromoMedia>

  const legacyVideoUrl = typeof record.videoUrl === 'string'
    ? mediaService.getMediaFullUrl(record.videoUrl)
    : undefined
  const legacyImageUrl = typeof record.imageUrl === 'string'
    ? mediaService.getMediaFullUrl(record.imageUrl)
    : undefined
  const imageItems = Array.isArray(record.imageItems)
    ? record.imageItems
      .map((item): BoardPromoImageItem | null => {
        if (!item || typeof item !== 'object') return null

        const imageItem = item as Partial<BoardPromoImageItem>
        const url = typeof imageItem.url === 'string'
          ? mediaService.getMediaFullUrl(imageItem.url)
          : ''

        if (!url) return null

        return {
          id: typeof imageItem.id === 'number' ? imageItem.id : undefined,
          name: typeof imageItem.name === 'string' ? imageItem.name : undefined,
          url,
        }
      })
      .filter((item): item is BoardPromoImageItem => Boolean(item))
    : []
  const normalizedImageItems = imageItems.length > 0
    ? imageItems
    : legacyImageUrl
      ? [{
          id: typeof record.imageId === 'number' ? record.imageId : undefined,
          name: typeof record.imageName === 'string' ? record.imageName : undefined,
          url: legacyImageUrl,
        }]
      : []
  const videoItems = Array.isArray(record.videoItems)
    ? record.videoItems
      .map((item): BoardPromoVideoItem | null => {
        if (!item || typeof item !== 'object') return null

        const videoItem = item as Partial<BoardPromoVideoItem>
        const url = typeof videoItem.url === 'string'
          ? mediaService.getMediaFullUrl(videoItem.url)
          : ''

        if (!url) return null

        return {
          id: typeof videoItem.id === 'number' ? videoItem.id : undefined,
          name: typeof videoItem.name === 'string' ? videoItem.name : undefined,
          playEvery: typeof videoItem.playEvery === 'number' && videoItem.playEvery > 0
            ? Math.trunc(videoItem.playEvery)
            : undefined,
          url,
        }
      })
      .filter((item): item is BoardPromoVideoItem => Boolean(item))
    : []
  const normalizedVideoItems = videoItems.length > 0
    ? videoItems
    : legacyVideoUrl
      ? [{
          id: typeof record.videoId === 'number' ? record.videoId : undefined,
          name: typeof record.videoName === 'string' ? record.videoName : undefined,
          url: legacyVideoUrl,
        }]
      : []
  const firstVideo = normalizedVideoItems[0]
  const firstImage = normalizedImageItems[0]

  return {
    imageName: firstImage?.name,
    imageId: firstImage?.id,
    imageItems: normalizedImageItems,
    imageUrl: firstImage?.url,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    videoId: firstVideo?.id,
    videoItems: normalizedVideoItems,
    videoName: firstVideo?.name,
    videoUrl: firstVideo?.url,
  }
}

function readStorage(): PromoMediaStorage {
  try {
    const saved = window.localStorage.getItem(boardPromoMediaStorageKey)
    const parsed = saved ? JSON.parse(saved) : {}

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed as PromoMediaStorage).map(([profileId, media]) => [
        profileId,
        normalizeBoardPromoMedia(media),
      ]),
    )
  } catch {
    return {}
  }
}

export function normalizeBoardPromoMediaStorage(value: unknown): PromoMediaStorage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as PromoMediaStorage)
      .map(([profileId, media]) => [String(profileId), normalizeBoardPromoMedia(media)] as const)
      .filter(([profileId]) => profileId.trim() !== ''),
  )
}

function writeStorage(storage: PromoMediaStorage): PromoMediaStorage {
  window.localStorage.setItem(boardPromoMediaStorageKey, JSON.stringify(storage))

  return storage
}

function saveMedia(profileId: string | undefined | null, media: BoardPromoMedia): BoardPromoMedia {
  const normalizedProfileId = normalizeProfileId(profileId)
  const storage = readStorage()
  const normalizedMedia = normalizeBoardPromoMedia({
    ...media,
    updatedAt: new Date().toISOString(),
  })

  writeStorage({
    ...storage,
    [normalizedProfileId]: normalizedMedia,
  })

  return normalizedMedia
}

function toBoardMediaUrl(mediaFile: MediaFile): string {
  return mediaService.getMediaFullUrl(mediaFile.url)
}

function appendVideoItem(media: BoardPromoMedia, item: BoardPromoVideoItem): BoardPromoMedia {
  const currentItems = normalizeBoardPromoMedia(media).videoItems ?? []
  const otherItems = currentItems.filter((currentItem) => (
    !((item.id !== undefined && currentItem.id === item.id) || currentItem.url === item.url)
  ))
  const videoItems = [item, ...otherItems]
  const firstVideo = videoItems[0]

  return {
    ...media,
    videoId: firstVideo?.id,
    videoItems,
    videoName: firstVideo?.name,
    videoUrl: firstVideo?.url,
  }
}

function updateVideoItem(media: BoardPromoMedia, videoUrl: string, update: Partial<BoardPromoVideoItem>): BoardPromoMedia {
  const videoItems = (normalizeBoardPromoMedia(media).videoItems ?? []).map((item) => (
    item.url === videoUrl
      ? {
          ...item,
          ...update,
          playEvery: update.playEvery && update.playEvery > 0 ? Math.trunc(update.playEvery) : undefined,
        }
      : item
  ))
  const firstVideo = videoItems[0]

  return {
    ...media,
    videoId: firstVideo?.id,
    videoItems,
    videoName: firstVideo?.name,
    videoUrl: firstVideo?.url,
  }
}

function appendImageItem(media: BoardPromoMedia, item: BoardPromoImageItem): BoardPromoMedia {
  const currentItems = normalizeBoardPromoMedia(media).imageItems ?? []
  const otherItems = currentItems.filter((currentItem) => (
    !((item.id !== undefined && currentItem.id === item.id) || currentItem.url === item.url)
  ))
  const imageItems = [item, ...otherItems]
  const firstImage = imageItems[0]

  return {
    ...media,
    imageId: firstImage?.id,
    imageItems,
    imageName: firstImage?.name,
    imageUrl: firstImage?.url,
  }
}

export const boardPromoMediaService = {
  getStorage(): Record<string, BoardPromoMedia> {
    return readStorage()
  },

  replaceStorage(storage: Record<string, BoardPromoMedia>): Record<string, BoardPromoMedia> {
    return writeStorage(normalizeBoardPromoMediaStorage(storage))
  },

  getImageItems(profileId?: string | null): BoardPromoImageItem[] {
    return this.getMedia(profileId).imageItems ?? []
  },

  getVideoItems(profileId?: string | null): BoardPromoVideoItem[] {
    return this.getMedia(profileId).videoItems ?? []
  },

  getMedia(profileId?: string | null): BoardPromoMedia {
    return readStorage()[normalizeProfileId(profileId)] ?? {}
  },

  removeImage(profileId?: string | null): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)

    return saveMedia(profileId, {
      ...currentMedia,
      imageId: undefined,
      imageItems: [],
      imageName: undefined,
      imageUrl: undefined,
    })
  },

  removeImageItem(profileId: string | undefined | null, imageUrl: string): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)
    const imageItems = (currentMedia.imageItems ?? []).filter((item) => item.url !== imageUrl)
    const firstImage = imageItems[0]

    return saveMedia(profileId, {
      ...currentMedia,
      imageId: firstImage?.id,
      imageItems,
      imageName: firstImage?.name,
      imageUrl: firstImage?.url,
    })
  },

  removeVideo(profileId?: string | null): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)

    return saveMedia(profileId, {
      ...currentMedia,
      videoId: undefined,
      videoItems: [],
      videoName: undefined,
      videoUrl: undefined,
    })
  },

  removeVideoItem(profileId: string | undefined | null, videoUrl: string): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)
    const videoItems = (currentMedia.videoItems ?? []).filter((item) => item.url !== videoUrl)
    const firstVideo = videoItems[0]

    return saveMedia(profileId, {
      ...currentMedia,
      videoId: firstVideo?.id,
      videoItems,
      videoName: firstVideo?.name,
      videoUrl: firstVideo?.url,
    })
  },

  updateVideoItemFrequency(profileId: string | undefined | null, videoUrl: string, playEvery?: number): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)

    return saveMedia(profileId, updateVideoItem(currentMedia, videoUrl, { playEvery }))
  },

  removeMediaById(mediaId: number): PromoMediaStorage {
    const storage = readStorage()
    const nextStorage = Object.fromEntries(
      Object.entries(storage).map(([profileId, media]) => {
        const nextMedia = { ...media }

        if ((nextMedia.imageItems ?? []).some((item) => item.id === mediaId) || nextMedia.imageId === mediaId) {
          const imageItems = (nextMedia.imageItems ?? []).filter((item) => item.id !== mediaId)
          const firstImage = imageItems[0]

          nextMedia.imageId = firstImage?.id
          nextMedia.imageItems = imageItems
          nextMedia.imageName = firstImage?.name
          nextMedia.imageUrl = firstImage?.url
        }

        if ((nextMedia.videoItems ?? []).some((item) => item.id === mediaId) || nextMedia.videoId === mediaId) {
          const videoItems = (nextMedia.videoItems ?? []).filter((item) => item.id !== mediaId)
          const firstVideo = videoItems[0]

          nextMedia.videoId = firstVideo?.id
          nextMedia.videoItems = videoItems
          nextMedia.videoName = firstVideo?.name
          nextMedia.videoUrl = firstVideo?.url
        }

        return [profileId, normalizeBoardPromoMedia(nextMedia)]
      }),
    )

    return writeStorage(nextStorage)
  },

  saveImageUrl(profileId: string | undefined | null, imageUrl: string): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)
    const normalizedImageUrl = imageUrl.trim()

    if (normalizedImageUrl) {
      return saveMedia(profileId, appendImageItem(currentMedia, {
        name: 'URL',
        url: normalizedImageUrl,
      }))
    }

    return saveMedia(profileId, {
      ...currentMedia,
      imageId: undefined,
      imageItems: [],
      imageName: undefined,
      imageUrl: undefined,
    })
  },

  saveVideoUrl(profileId: string | undefined | null, videoUrl: string): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)
    const validation = validateBoardVideoUrl(videoUrl)

    if (!validation.valid) {
      throw new Error(validation.error)
    }

    if (validation.normalizedUrl) {
      return saveMedia(profileId, appendVideoItem(currentMedia, {
        name: 'URL',
        url: validation.normalizedUrl,
      }))
    }

    return saveMedia(profileId, {
      ...currentMedia,
      videoId: undefined,
      videoItems: [],
      videoName: undefined,
      videoUrl: undefined,
    })
  },

  saveMediaUrl(profileId: string | undefined | null, mediaUrl: string): BoardPromoMedia {
    const validation = validateBoardMediaUrl(mediaUrl)

    if (!validation.valid) {
      throw new Error(validation.error)
    }

    if (!validation.normalizedUrl || !validation.mediaType) {
      return this.getMedia(profileId)
    }

    return validation.mediaType === 'video'
      ? this.saveVideoUrl(profileId, validation.normalizedUrl)
      : this.saveImageUrl(profileId, validation.normalizedUrl)
  },

  saveMediaFile(profileId: string | undefined | null, mediaFile: MediaFile): BoardPromoMedia {
    const currentMedia = this.getMedia(profileId)
    const mediaUrl = toBoardMediaUrl(mediaFile)

    if (mediaFile.type === 'video') {
      return saveMedia(profileId, appendVideoItem(currentMedia, {
        id: mediaFile.id,
        name: mediaFile.filename,
        url: mediaUrl,
      }))
    }

    return saveMedia(profileId, appendImageItem(currentMedia, {
      id: mediaFile.id,
      name: mediaFile.filename,
      url: mediaUrl,
    }))
  },

  async uploadImageFile(profileId: string | undefined | null, file: File): Promise<BoardPromoMedia> {
    if (file.type && !file.type.startsWith('image/')) {
      throw new Error('Выберите изображение')
    }

    if (!file.type && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      throw new Error('Выберите изображение')
    }

    const mediaFile = await mediaService.uploadMedia(file)

    return this.saveMediaFile(profileId, { ...mediaFile, type: 'image' })
  },

  async uploadVideoFile(profileId: string | undefined | null, file: File): Promise<BoardPromoMedia> {
    const supportedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

    if (file.type && !supportedVideoTypes.has(file.type)) {
      throw new Error('Выберите видеофайл mp4/webm/mov')
    }

    if (!file.type && !/\.(mp4|webm|mov)$/i.test(file.name)) {
      throw new Error('Выберите видеофайл mp4/webm/mov')
    }

    const mediaFile = await mediaService.uploadMedia(file)

    return this.saveMediaFile(profileId, { ...mediaFile, type: 'video' })
  },

  async uploadMediaFiles(profileId: string | undefined | null, files: File[]): Promise<BoardPromoMedia> {
    let nextPromoMedia = this.getMedia(profileId)

    for (const file of files) {
      const mediaFile = await mediaService.uploadMedia(file)

      nextPromoMedia = this.saveMediaFile(profileId, mediaFile)
    }

    return nextPromoMedia
  },
}
