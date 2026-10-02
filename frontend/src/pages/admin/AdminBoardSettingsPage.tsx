import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Monitor,
  Copy,
  Check,
  CheckSquare,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Image as ImageIcon,
  Video,
} from 'lucide-react'
import { adminService } from '@services/adminService'
import {
  boardPromoMediaService,
  getBoardPromoUrlInputValue,
  normalizeBoardPromoMedia,
  validateBoardMediaUrl,
  validateBoardVideoUrl,
  type BoardPromoMedia,
} from '@services/boardPromoMediaService'
import { mediaService, type MediaFile } from '@services/mediaService'
import {
  boardFontOptions,
  boardScreenFormatOptions,
  boardStyleSettingsService,
  defaultBoardStyleSettings,
  normalizeBoardStyleSettings,
  type BoardFontFamily,
  type BoardScreenFormat,
  type BoardStyleSettings,
} from '@services/boardStyleSettingsService'
import {
  boardTemplateOptions,
  defaultBoardTemplate,
} from '@services/boardTemplateService'
import {
  getVoiceActionLabel,
  getVoiceAudienceLabel,
  voiceSettingsService,
  type VoiceAction,
  type VoiceAudience,
  type VoiceSettings,
} from '@services/voiceSettingsService'
import type { BoardScreen, BoardSettings, BoardSettingsProfile, BoardTemplate } from '@services/api'
import { useLocale } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'
import { copyTextToClipboard } from '@shared/utils/clipboard'
import { getRoomBoardId, normalizeRoomLookupValue, roomMatchesIdentifier } from '@shared/utils'
import {
  getAdminErrorMessage,
  getRoomName,
  getRoomActive,
  moveItemToTop,
  type AdminRoomRecord,
} from './adminPageHelpers'
import { AdminFileInput } from './AdminFileInput'

const defaultBoardSettings: BoardSettings = {
  boardType: 'general',
  liteMode: false,
  marqueeOffsetPx: 0,
  marqueeSizePercent: 100,
  marqueeText: '',
  promoMediaByProfileId: {},
  showMarquee: true,
  recentCallsLimit: 10,
  roomBoardId: '',
  screens: [],
  showRecentCalls: true,
  showTime: true,
  styleSettings: {},
  template: 'classic',
  voiceEnabled: true,
}

type BoardColorSettingKey = Exclude<
  keyof BoardStyleSettings,
  'fontFamily' | 'fontScalePercent' | 'screenFormat'
>

const boardColorFields: Array<{ key: BoardColorSettingKey; label: string }> = [
  { key: 'boardBackground', label: 'Цвет фона табло' },
  { key: 'currentCallBackground', label: 'Цвет фона текущего вызова' },
  { key: 'currentCallText', label: 'Цвет текста текущего вызова' },
  { key: 'historyBackground', label: 'Цвет фона истории' },
  { key: 'historyText', label: 'Цвет текста истории' },
  { key: 'borderColor', label: 'Цвет рамок/разделителей' },
  { key: 'accentColor', label: 'Цвет акцента' },
]

const boardHexColorPattern = /^#[0-9a-f]{6}$/i

function BoardSettingsAccordion({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode
  defaultOpen?: boolean
  title: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className="board-settings-accordion"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary>
        <span>{title}</span>
      </summary>
      <div className="board-settings-accordion-content">
        {children}
      </div>
    </details>
  )
}

function BoardFontScaleField({
  onChange,
  value,
}: {
  onChange: (value: number) => void
  value: number
}) {
  const initialValue = Number.isFinite(value) ? value : defaultBoardStyleSettings.fontScalePercent
  const [inputValue, setInputValue] = useState(String(initialValue))
  const numericValue = inputValue.trim() ? Number(inputValue) : Number.NaN
  const inputInvalid = !Number.isFinite(numericValue) || numericValue < 50 || numericValue > 300

  return (
    <label className="field board-font-scale-field">
      <span>Размер шрифта</span>
      <div className="board-font-scale-control">
        <input
          aria-invalid={inputInvalid}
          className="board-font-scale-input"
          max={300}
          min={50}
          onBlur={() => {
            const normalizedValue = Number.isFinite(numericValue)
              ? Math.min(300, Math.max(50, Math.round(numericValue)))
              : initialValue

            setInputValue(String(normalizedValue))
            onChange(normalizedValue)
          }}
          onChange={(event) => {
            const nextInputValue = event.currentTarget.value
            const nextNumericValue = Number(nextInputValue)

            setInputValue(nextInputValue)
            if (
              nextInputValue
              && Number.isFinite(nextNumericValue)
              && nextNumericValue >= 50
              && nextNumericValue <= 300
            ) {
              onChange(Math.round(nextNumericValue))
            }
          }}
          step={5}
          type="number"
          value={inputValue}
        />
        <span aria-hidden="true">%</span>
      </div>
      {inputInvalid ? (
        <small className="field-error">Введите значение от 50 до 300</small>
      ) : null}
      <small className="field-help">100% — стандартный размер, допустимо от 50% до 300%.</small>
    </label>
  )
}

function BoardColorField({
  colorKey,
  fallbackValue,
  label,
  onChange,
  value,
}: {
  colorKey: BoardColorSettingKey
  fallbackValue: string
  label: string
  onChange: (value: string) => void
  value: string
}) {
  const colorValue = boardHexColorPattern.test(value) ? value : fallbackValue
  const [hexValue, setHexValue] = useState(colorValue.toUpperCase())
  const [hexError, setHexError] = useState('')
  const inputId = `board-color-${colorKey}`

  return (
    <div className="board-color-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="board-color-controls">
        <input
          aria-label={label}
          id={inputId}
          onChange={(event) => {
            const nextValue = event.currentTarget.value

            setHexValue(nextValue.toUpperCase())
            setHexError('')
            onChange(nextValue)
          }}
          type="color"
          value={colorValue}
        />
        <input
          aria-label={`${label}, HEX`}
          autoComplete="off"
          className="board-color-hex-input"
          inputMode="text"
          maxLength={7}
          onBlur={() => {
            if (!boardHexColorPattern.test(hexValue.trim())) {
              setHexError('Введите цвет в формате #RRGGBB')
            }
          }}
          onChange={(event) => {
            const nextValue = event.currentTarget.value

            setHexValue(nextValue)
            if (boardHexColorPattern.test(nextValue.trim())) {
              setHexError('')
              onChange(nextValue.trim())
            } else {
              setHexError('Введите цвет в формате #RRGGBB')
            }
          }}
          aria-invalid={Boolean(hexError)}
          pattern="#[0-9a-fA-F]{6}"
          placeholder={fallbackValue.toUpperCase()}
          spellCheck={false}
          type="text"
          value={hexValue}
        />
      </div>
      {hexError ? <small className="field-error">{hexError}</small> : null}
    </div>
  )
}

function BoardTemplateSelector({
  onSelect,
  selectedTemplate,
}: {
  onSelect: (template: BoardTemplate) => void
  selectedTemplate: BoardTemplate
}) {
  return (
    <div className="board-template-grid">
      {boardTemplateOptions.map((template) => (
        <button
          className={selectedTemplate === template.value
            ? 'board-template-card active'
            : 'board-template-card'}
          key={template.value}
          onClick={() => onSelect(template.value)}
          type="button"
        >
          <span className={`board-template-preview ${template.value}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>{template.label}</strong>
          <small>{template.description}</small>
        </button>
      ))}
    </div>
  )
}

function BoardScreenFormatSelector({
  onSelect,
  selectedFormat,
}: {
  onSelect: (format: BoardScreenFormat) => void
  selectedFormat: BoardScreenFormat
}) {
  return (
    <div className="board-format-selector">
      {boardScreenFormatOptions.map((option) => (
        <button
          className={selectedFormat === option.value
            ? 'board-format-card active'
            : 'board-format-card'}
          key={option.value}
          onClick={() => onSelect(option.value)}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`board-format-preview board-format-preview-${option.value.replace(':', '-')}`}
          >
            <i />
            <i />
          </span>
          <strong>{option.label}</strong>
          <small>{option.label} — {option.description.toLowerCase()}</small>
        </button>
      ))}
    </div>
  )
}

export function BoardSettingsSection() {
  const t = useLocale()
  const [rooms, setRooms] = useState<AdminRoomRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(defaultBoardSettings)
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => voiceSettingsService.getSettings())
  const [copied, setCopied] = useState<string | null>(null)
  const [draftProfile, setDraftProfile] = useState<BoardSettingsProfile | null>(null)
  const lastSavedBoardProfileIdRef = useRef<string | null>(null)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenRooms, setNewScreenRooms] = useState<string[]>([])
  const [newScreenTemplate, setNewScreenTemplate] = useState<BoardTemplate>(defaultBoardTemplate)
  const [newScreenFormat, setNewScreenFormat] = useState<BoardScreenFormat>('16:9')
  const [newScreenVideoUrl, setNewScreenVideoUrl] = useState('')
  const [newScreenVideoPreviewFailed, setNewScreenVideoPreviewFailed] = useState(false)
  const [promoMedia, setPromoMedia] = useState<BoardPromoMedia>({})
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [mediaFilesLoading, setMediaFilesLoading] = useState(false)
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([])
  const [boardStyleSettings, setBoardStyleSettings] = useState<BoardStyleSettings>(defaultBoardStyleSettings)
  const [promoMediaUrl, setPromoMediaUrl] = useState('')
  const [promoMediaError, setPromoMediaError] = useState<string | null>(null)
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false)
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      adminService.getRooms(),
      adminService.getBoardSettings(),
    ])
      .then(([nextRooms, nextBoardSettings]) => {
        setRooms(nextRooms as AdminRoomRecord[])
        boardPromoMediaService.replaceStorage(nextBoardSettings.promoMediaByProfileId ?? {})
        setBoardSettings(ensureBoardProfiles(nextBoardSettings, nextRooms as AdminRoomRecord[]))
      })
      .catch((loadError) => setError(getAdminErrorMessage(loadError, 'Не удалось загрузить настройки табло')))
      .finally(() => setLoading(false))
  }, [])

  async function loadMediaFiles() {
    setMediaFilesLoading(true)

    try {
      const nextMediaFiles = await mediaService.getMediaFiles()

      setMediaFiles(nextMediaFiles)
      setSelectedMediaIds((current) => current.filter((id) => nextMediaFiles.some((mediaFile) => mediaFile.id === id)))
    } catch (mediaLoadError) {
      console.warn('Board media files load failed', mediaLoadError)
    } finally {
      setMediaFilesLoading(false)
    }
  }

  useEffect(() => {
    void loadMediaFiles()
  }, [])

  function getCurrentPromoMedia(profileId?: string | null): BoardPromoMedia {
    const localMedia = boardPromoMediaService.getMedia(profileId)

    if ((localMedia.videoItems?.length ?? 0) > 0 || (localMedia.imageItems?.length ?? 0) > 0 || localMedia.videoUrl || localMedia.imageUrl) {
      return localMedia
    }

    return normalizeBoardPromoMedia(boardSettings.promoMediaByProfileId?.[String(profileId ?? '')] ?? {})
  }

  function getCurrentLinkedPromoUrl(media: BoardPromoMedia): string {
    if (media.videoName === 'URL') {
      return getBoardPromoUrlInputValue(media.videoUrl)
    }

    if (media.imageName === 'URL') {
      return getBoardPromoUrlInputValue(media.imageUrl)
    }

    return ''
  }

  useEffect(() => {
    if (!draftProfile) {
      setPromoMedia({})
      setBoardStyleSettings(defaultBoardStyleSettings)
      setPromoMediaUrl('')
      setPromoMediaError(null)
      setVideoPreviewFailed(false)
      setImagePreviewFailed(false)
      return
    }

    const nextPromoMedia = getCurrentPromoMedia(draftProfile.id)

    setPromoMedia(nextPromoMedia)
    setBoardStyleSettings(getBoardProfileStyleSettings(draftProfile.id))
    setPromoMediaUrl(getCurrentLinkedPromoUrl(nextPromoMedia))
    setPromoMediaError(null)
    setVideoPreviewFailed(false)
    setImagePreviewFailed(false)
  }, [draftProfile?.id, boardSettings.promoMediaByProfileId])

  function toggleRoom(name: string) {
    setNewScreenRooms((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }

  function getProfileRoomIds(profile: BoardSettingsProfile): string[] {
    if (profile.boardType === 'individual') {
      return profile.roomBoardId ? [profile.roomBoardId] : []
    }

    return (profile.roomIds ?? []).filter(Boolean)
  }

  function findRoomByBoardId(roomBoardId: string): AdminRoomRecord | undefined {
    return rooms.find((room) => roomMatchesIdentifier(room, roomBoardId))
  }

  function getProfileRoomNames(profile: BoardSettingsProfile): string {
    const roomIds = getProfileRoomIds(profile)

    if (profile.boardType === 'general' && roomIds.length === 0) {
      return t.queue.allRooms
    }

    if (roomIds.length === 0) {
      return 'Кабинет не назначен'
    }

    return roomIds
      .map((roomId) => {
        const room = findRoomByBoardId(roomId)

        return room ? getRoomName(room) : roomId
      })
      .join(', ')
  }

  function getProfileSelectedRoomNames(profile: BoardSettingsProfile): string[] {
    return getProfileRoomIds(profile)
      .map((roomId) => {
        const room = findRoomByBoardId(roomId)

        return room ? getRoomName(room) : roomId
      })
  }

  function changeDraftBoardType(boardType: BoardSettingsProfile['boardType']) {
    setDraftProfile((current) => {
      if (!current) {
        return current
      }

      if (boardType === 'individual') {
        const roomBoardId = current.roomBoardId || current.roomIds?.[0] || ''

        return {
          ...current,
          boardType,
          roomBoardId,
          roomIds: roomBoardId ? [roomBoardId] : [],
        }
      }

      const roomIds = current.roomIds?.length
        ? current.roomIds
        : current.roomBoardId
          ? [current.roomBoardId]
          : []

      return {
        ...current,
        boardType,
        roomBoardId: '',
        roomIds,
      }
    })
  }

  function setDraftIndividualRoom(roomBoardId: string) {
    updateDraftProfile({
      roomBoardId,
      roomIds: roomBoardId ? [roomBoardId] : [],
    })
  }

  function toggleDraftGeneralRoom(roomBoardId: string) {
    setDraftProfile((current) => {
      if (!current) {
        return current
      }

      const selectedRoomIds = new Set(current.roomIds ?? [])

      if (selectedRoomIds.has(roomBoardId)) {
        selectedRoomIds.delete(roomBoardId)
      } else {
        selectedRoomIds.add(roomBoardId)
      }

      return {
        ...current,
        roomIds: Array.from(selectedRoomIds),
      }
    })
  }

  function getScreenUrl(screen: BoardScreen): string {
    const profile = getBoardProfile(
      `screen-${screen.id}`,
      screen.name,
      screen.roomIds?.length === 1 ? 'individual' : 'general',
      screen.roomIds?.[0] ?? '',
      screen.roomIds ?? [],
    )
    const profileParam = `profileId=${encodeURIComponent(profile.id)}`

    if (profile.boardType === 'individual' && profile.roomBoardId) {
      return `${window.location.origin}/board?roomId=${encodeURIComponent(profile.roomBoardId)}&${profileParam}`
    }

    return `${window.location.origin}/board?${profileParam}`
  }

  function getRoomBoardPath(room: AdminRoomRecord, profile?: BoardSettingsProfile): string {
    const roomBoardId = getRoomBoardId(room)
    const profileParam = profile ? `&profileId=${encodeURIComponent(profile.id)}` : ''

    return `/board?roomId=${encodeURIComponent(roomBoardId)}${profileParam}`
  }

  function getRoomBoardUrl(room: AdminRoomRecord, profile?: BoardSettingsProfile): string {
    return `${window.location.origin}${getRoomBoardPath(room, profile)}`
  }

  function getProfileUrl(profile: BoardSettingsProfile): string {
    const profileParam = `profileId=${encodeURIComponent(profile.id)}`

    if (profile.boardType === 'individual' && profile.roomBoardId) {
      return `${window.location.origin}/board?roomId=${encodeURIComponent(profile.roomBoardId)}&${profileParam}`
    }

    return `${window.location.origin}/board?${profileParam}`
  }

  function getDefaultProfileFromSettings(
    settings: BoardSettings,
    id: string,
    name: string,
    boardType: BoardSettingsProfile['boardType'],
    roomBoardId = '',
    roomIds: string[] = [],
  ): BoardSettingsProfile {
    return {
      boardType,
      name,
      id,
      liteMode: settings.liteMode ?? false,
      marqueeOffsetPx: settings.marqueeOffsetPx ?? 0,
      marqueeSizePercent: settings.marqueeSizePercent ?? 100,
      marqueeText: settings.marqueeText ?? '',
      showMarquee: settings.showMarquee ?? true,
      recentCallsLimit: settings.recentCallsLimit,
      roomBoardId,
      roomIds,
      showRecentCalls: settings.showRecentCalls,
      showTime: settings.showTime,
      template: settings.template,
      voiceEnabled: settings.voiceEnabled,
    }
  }

  function getBoardProfileFromSettings(
    settings: BoardSettings,
    id: string,
    name: string,
    boardType: BoardSettingsProfile['boardType'],
    roomBoardId = '',
    roomIds: string[] = [],
  ): BoardSettingsProfile {
    const savedProfile = settings.profiles?.find((profile) => profile.id === id)
    const fallbackProfile = getDefaultProfileFromSettings(settings, id, name, boardType, roomBoardId, roomIds)

    return savedProfile
      ? {
          ...fallbackProfile,
          ...savedProfile,
          liteMode: savedProfile.liteMode ?? fallbackProfile.liteMode ?? false,
          marqueeOffsetPx: savedProfile.marqueeOffsetPx ?? fallbackProfile.marqueeOffsetPx ?? 0,
          marqueeSizePercent: savedProfile.marqueeSizePercent ?? fallbackProfile.marqueeSizePercent ?? 100,
          marqueeText: savedProfile.marqueeText ?? fallbackProfile.marqueeText ?? '',
          showMarquee: savedProfile.showMarquee ?? fallbackProfile.showMarquee ?? true,
          roomBoardId: savedProfile.roomBoardId ?? fallbackProfile.roomBoardId,
          roomIds: savedProfile.roomIds ?? fallbackProfile.roomIds,
        }
      : fallbackProfile
  }

  function getBoardProfile(
    id: string,
    name: string,
    boardType: BoardSettingsProfile['boardType'],
    roomBoardId = '',
    roomIds: string[] = [],
  ): BoardSettingsProfile {
    return getBoardProfileFromSettings(boardSettings, id, name, boardType, roomBoardId, roomIds)
  }

  function ensureBoardProfiles(settings: BoardSettings, nextRooms: AdminRoomRecord[]): BoardSettings {
    const requiredProfiles = [
      getBoardProfileFromSettings(settings, 'general', 'Общее табло', 'general'),
      ...nextRooms
        .filter(getRoomActive)
        .map((room) => {
          const boardId = getRoomBoardId(room)

          return getBoardProfileFromSettings(settings, `room-${boardId}`, getRoomName(room), 'individual', boardId, [boardId])
        }),
      ...settings.screens.map((screen) => getBoardProfileFromSettings(
        settings,
        `screen-${screen.id}`,
        screen.name,
        screen.roomIds?.length === 1 ? 'individual' : 'general',
        screen.roomIds?.[0] ?? '',
        screen.roomIds ?? [],
      )),
    ]
    const requiredProfileIds = new Set(requiredProfiles.map((profile) => profile.id))
    const extraProfiles = (settings.profiles ?? []).filter((profile) => !requiredProfileIds.has(profile.id))

    return {
      ...settings,
      profiles: [...requiredProfiles, ...extraProfiles],
    }
  }

  function getBoardProfileStyleSettings(profileId: string): BoardStyleSettings {
    return boardSettings.styleSettings?.[profileId]
      ? normalizeBoardStyleSettings(boardSettings.styleSettings[profileId])
      : boardStyleSettingsService.getSettings(profileId)
  }

  function startEditProfile(profile: BoardSettingsProfile) {
    setBoardStyleSettings(getBoardProfileStyleSettings(profile.id))
    setDraftProfile(profile)
  }

  function updateDraftProfile(nextProfile: Partial<BoardSettingsProfile>) {
    setDraftProfile((current: BoardSettingsProfile | null) => current ? { ...current, ...nextProfile } : current)
  }

  function updateBoardStyleSettings(nextSettings: Partial<BoardStyleSettings>) {
    setBoardStyleSettings((current) => ({ ...current, ...nextSettings }))
  }

  function syncPromoMediaState() {
    setBoardSettings((current) => ({
      ...current,
      promoMediaByProfileId: boardPromoMediaService.getStorage(),
    }))
  }

  function getGlobalVideoProfileIds(primaryProfileId?: string): string[] {
    const profileIds = new Set(
      (boardSettings.profiles ?? [])
        .filter((profile) => profile.template === 'video_queue')
        .map((profile) => profile.id),
    )

    if (primaryProfileId && draftProfile?.template === 'video_queue') {
      profileIds.add(primaryProfileId)
    }

    return Array.from(profileIds)
  }

  function saveVideoMediaForAllBoards(mediaFile: MediaFile): BoardPromoMedia {
    const targetProfileIds = getGlobalVideoProfileIds(draftProfile?.id)
    let currentProfileMedia = promoMedia

    for (const profileId of targetProfileIds) {
      const nextMedia = boardPromoMediaService.saveMediaFile(profileId, {
        ...mediaFile,
        type: 'video',
      })

      if (profileId === draftProfile?.id) {
        currentProfileMedia = nextMedia
      }
    }

    return currentProfileMedia
  }

  function saveVideoUrlForAllBoards(videoUrl: string): BoardPromoMedia {
    const targetProfileIds = getGlobalVideoProfileIds(draftProfile?.id)
    let currentProfileMedia = promoMedia

    for (const profileId of targetProfileIds) {
      const nextMedia = boardPromoMediaService.saveVideoUrl(profileId, videoUrl)

      if (profileId === draftProfile?.id) {
        currentProfileMedia = nextMedia
      }
    }

    return currentProfileMedia
  }

  function removeVideoItemFromAllBoards(videoUrl: string): BoardPromoMedia {
    const targetProfileIds = getGlobalVideoProfileIds(draftProfile?.id)
    let currentProfileMedia = promoMedia

    for (const profileId of targetProfileIds) {
      const nextMedia = boardPromoMediaService.removeVideoItem(profileId, videoUrl)

      if (profileId === draftProfile?.id) {
        currentProfileMedia = nextMedia
      }
    }

    return currentProfileMedia
  }

  function updateVideoFrequencyForAllBoards(videoUrl: string, playEvery?: number): BoardPromoMedia {
    const targetProfileIds = getGlobalVideoProfileIds(draftProfile?.id)
    let currentProfileMedia = promoMedia

    for (const profileId of targetProfileIds) {
      const nextMedia = boardPromoMediaService.updateVideoItemFrequency(profileId, videoUrl, playEvery)

      if (profileId === draftProfile?.id) {
        currentProfileMedia = nextMedia
      }
    }

    return currentProfileMedia
  }

  async function persistPromoMediaStorage(profileId?: string) {
    await updateBoardSettings({
      promoMediaByProfileId: boardPromoMediaService.getStorage(),
    }, profileId)
  }

  function cancelEditProfile() {
    setDraftProfile(null)
  }

  async function saveDraftProfile() {
    if (!draftProfile) return

    const mediaUrlValidation = validateBoardMediaUrl(promoMediaUrl)

    if (draftProfile.template === 'video_queue' && !mediaUrlValidation.valid) {
      return
    }

    const profiles = boardSettings.profiles ?? []
    const draftScreenId = draftProfile.id.startsWith('screen-')
      ? draftProfile.id.slice('screen-'.length)
      : null
    const nextScreens = draftScreenId
      ? boardSettings.screens.map((screen) => {
        if (`screen-${screen.id}` !== draftProfile.id) {
          return screen
        }

        const profileRoomIds = getProfileRoomIds(draftProfile)
        const selectedRooms = profileRoomIds
          .map((roomId) => findRoomByBoardId(roomId))
          .filter((room): room is AdminRoomRecord => Boolean(room))

        return {
          ...screen,
          name: draftProfile.name,
          roomIds: profileRoomIds,
          roomNames: selectedRooms.length > 0 ? selectedRooms.map(getRoomName) : [],
        }
      })
      : boardSettings.screens
    const nextProfiles = profiles.some((profile) => profile.id === draftProfile.id)
      ? moveItemToTop(
        profiles.map((profile) => profile.id === draftProfile.id ? draftProfile : profile),
        draftProfile.id,
      )
      : [draftProfile, ...profiles]
    const normalizedBoardStyleSettings = normalizeBoardStyleSettings(boardStyleSettings)
    const nextStyleSettings = {
      ...(boardSettings.styleSettings ?? {}),
      [draftProfile.id]: normalizedBoardStyleSettings,
    }
    let nextPromoMedia = getCurrentPromoMedia(draftProfile.id)
    const savedMediaUrl = getCurrentLinkedPromoUrl(nextPromoMedia)
    const mediaUrlType = promoMediaUrl.trim()
      ? validateBoardMediaUrl(promoMediaUrl).mediaType
      : undefined

    if (promoMediaUrl.trim() !== savedMediaUrl && promoMediaUrl.trim()) {
      nextPromoMedia = mediaUrlType === 'video'
        ? saveVideoUrlForAllBoards(promoMediaUrl)
        : boardPromoMediaService.saveMediaUrl(draftProfile.id, promoMediaUrl)
    }

    const nextPromoMediaStorage = boardPromoMediaService.getStorage()
    const savedSettings = await adminService.updateBoardSettings({
      ...boardSettings,
      promoMediaByProfileId: nextPromoMediaStorage,
      profiles: nextProfiles,
      screens: nextScreens,
      styleSettings: nextStyleSettings,
    })
    const orderedSavedSettings = {
      ...savedSettings,
      profiles: moveItemToTop(savedSettings.profiles ?? [], draftProfile.id),
      screens: draftScreenId ? moveItemToTop(savedSettings.screens, draftScreenId) : savedSettings.screens,
    }

    lastSavedBoardProfileIdRef.current = draftProfile.id
    setBoardSettings(orderedSavedSettings)
    setPromoMedia(nextPromoMedia)
    setBoardStyleSettings(boardStyleSettingsService.saveSettings(draftProfile.id, normalizedBoardStyleSettings))
    cancelEditProfile()
  }

  async function copyUrl(url: string) {
    await copyTextToClipboard(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  function openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function updateBoardSettings(
    nextSettings: Partial<BoardSettings>,
    prioritizedProfileId?: string,
    prioritizedScreenId?: string,
  ) {
    const savedSettings = await adminService.updateBoardSettings({
      ...boardSettings,
      ...nextSettings,
      promoMediaByProfileId: nextSettings.promoMediaByProfileId ?? boardPromoMediaService.getStorage(),
    })

    if (prioritizedProfileId) {
      lastSavedBoardProfileIdRef.current = prioritizedProfileId
    }

    setBoardSettings({
      ...savedSettings,
      profiles: prioritizedProfileId
        ? moveItemToTop(savedSettings.profiles ?? [], prioritizedProfileId)
        : savedSettings.profiles,
      screens: prioritizedScreenId
        ? moveItemToTop(savedSettings.screens, prioritizedScreenId)
        : savedSettings.screens,
    })
  }

  async function addScreen() {
    if (!newScreenName.trim() || newScreenRooms.length === 0) return

    const videoUrlValidation = validateBoardVideoUrl(newScreenVideoUrl)

    if (newScreenTemplate === 'video_queue' && !videoUrlValidation.valid) {
      return
    }

    const roomIds = activeRooms
      .filter((room) => newScreenRooms.includes(getRoomName(room)))
      .map(getRoomBoardId)
      .filter(Boolean)
    const screenId = String(Date.now())
    const screenProfileId = `screen-${screenId}`
    const screenBoardType = roomIds.length === 1 ? 'individual' : 'general'
    const newScreen = { id: screenId, name: newScreenName.trim(), roomIds, roomNames: newScreenRooms }
    const newScreens = [newScreen, ...boardSettings.screens]
    const newProfile: BoardSettingsProfile = {
      boardType: screenBoardType,
      id: screenProfileId,
      liteMode: false,
      marqueeOffsetPx: 0,
      marqueeSizePercent: 100,
      marqueeText: '',
      showMarquee: true,
      name: newScreenName.trim(),
      recentCallsLimit: boardSettings.recentCallsLimit,
      roomBoardId: screenBoardType === 'individual' ? roomIds[0] : '',
      roomIds,
      showRecentCalls: boardSettings.showRecentCalls,
      showTime: boardSettings.showTime,
      template: newScreenTemplate,
      voiceEnabled: boardSettings.voiceEnabled,
    }
    const newScreenStyleSettings = normalizeBoardStyleSettings({
      ...defaultBoardStyleSettings,
      screenFormat: newScreenFormat,
    })

    await updateBoardSettings({
      profiles: [newProfile, ...(boardSettings.profiles ?? [])],
      screens: newScreens,
      styleSettings: {
        ...(boardSettings.styleSettings ?? {}),
        [screenProfileId]: newScreenStyleSettings,
      },
      promoMediaByProfileId: boardPromoMediaService.getStorage(),
    }, screenProfileId, screenId)
    if (newScreenTemplate === 'video_queue' && videoUrlValidation.normalizedUrl) {
      boardPromoMediaService.saveVideoUrl(screenProfileId, videoUrlValidation.normalizedUrl)
      await updateBoardSettings({
        promoMediaByProfileId: boardPromoMediaService.getStorage(),
      }, screenProfileId, screenId)
    }
    boardStyleSettingsService.saveSettings(screenProfileId, newScreenStyleSettings)
    setNewScreenName('')
    setNewScreenRooms([])
    setNewScreenTemplate(defaultBoardTemplate)
    setNewScreenFormat('16:9')
    setNewScreenVideoUrl('')
    setNewScreenVideoPreviewFailed(false)
  }

  async function deleteScreen(id: string) {
    const nextStyleSettings = { ...(boardSettings.styleSettings ?? {}) }

    delete nextStyleSettings[`screen-${id}`]

    await updateBoardSettings({
      profiles: (boardSettings.profiles ?? []).filter((profile) => profile.id !== `screen-${id}`),
      screens: boardSettings.screens.filter((screen) => screen.id !== id),
      styleSettings: nextStyleSettings,
    })
  }

  function updateVoiceSettings(nextSettings: Partial<VoiceSettings>) {
    setVoiceSettings((current) => voiceSettingsService.saveSettings({ ...current, ...nextSettings }))
  }

  function getPromoMediaErrorMessage(promoError: unknown): string {
    return promoError instanceof Error
      ? promoError.message
      : 'Не удалось сохранить промо-медиа'
  }

  async function savePromoMediaUrl() {
    if (!draftProfile) return

    try {
      const validation = validateBoardMediaUrl(promoMediaUrl)
      const nextPromoMedia = validation.mediaType === 'video'
        ? saveVideoUrlForAllBoards(promoMediaUrl)
        : boardPromoMediaService.saveMediaUrl(draftProfile.id, promoMediaUrl)

      setPromoMedia(nextPromoMedia)
      syncPromoMediaState()
      await persistPromoMediaStorage(draftProfile.id)
      setPromoMediaUrl(getCurrentLinkedPromoUrl(nextPromoMedia))
      setPromoMediaError(null)
      setVideoPreviewFailed(false)
      setImagePreviewFailed(false)
    } catch (promoError) {
      setPromoMediaError(getPromoMediaErrorMessage(promoError))
    }
  }

  async function clearPromoMediaUrl() {
    if (!draftProfile) return

    const urlValidation = validateBoardMediaUrl(promoMediaUrl)
    let nextPromoMedia = promoMedia

    if (urlValidation.valid && urlValidation.mediaType === 'video' && promoMedia.videoName === 'URL' && promoMedia.videoUrl === urlValidation.normalizedUrl) {
      nextPromoMedia = removeVideoItemFromAllBoards(urlValidation.normalizedUrl)
    } else if (urlValidation.valid && urlValidation.mediaType === 'image' && promoMedia.imageName === 'URL' && promoMedia.imageUrl === urlValidation.normalizedUrl) {
      nextPromoMedia = boardPromoMediaService.removeImageItem(draftProfile.id, urlValidation.normalizedUrl)
    } else {
      if (promoMedia.videoName === 'URL' && promoMedia.videoUrl) {
        nextPromoMedia = removeVideoItemFromAllBoards(promoMedia.videoUrl)
      }

      if (nextPromoMedia.imageName === 'URL' && nextPromoMedia.imageUrl) {
        nextPromoMedia = boardPromoMediaService.removeImageItem(draftProfile.id, nextPromoMedia.imageUrl)
      }
    }

    setPromoMedia(nextPromoMedia)
    syncPromoMediaState()
    await persistPromoMediaStorage(draftProfile.id)
    setPromoMediaUrl('')
    setPromoMediaError(null)
    setVideoPreviewFailed(false)
    setImagePreviewFailed(false)
  }

  async function updatePromoVideoFrequencyForMediaFile(mediaFile: MediaFile, playEveryValue: string) {
    if (!draftProfile) return

    const numericValue = Number(playEveryValue)
    const normalizedValue = Number.isFinite(numericValue) && numericValue > 0
      ? Math.max(1, Math.round(numericValue))
      : undefined
    const mediaUrl = mediaService.getMediaFullUrl(mediaFile.url)
    let nextPromoMedia = promoMedia

    if (!(promoMedia.videoItems ?? []).some((item) => item.url === mediaUrl)) {
      nextPromoMedia = saveVideoMediaForAllBoards(mediaFile)
    }

    nextPromoMedia = updateVideoFrequencyForAllBoards(mediaUrl, normalizedValue)

    setPromoMedia(nextPromoMedia)
    syncPromoMediaState()
    await persistPromoMediaStorage(draftProfile.id)
    setPromoMediaError(null)
  }

  async function uploadPromoMedia(event: ChangeEvent<HTMLInputElement>) {
    if (!draftProfile) return

    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) return

    try {
      let nextPromoMedia = promoMedia

      for (const file of files) {
        const uploadedMediaFile = await mediaService.uploadMedia(file)

        nextPromoMedia = uploadedMediaFile.type === 'video'
          ? saveVideoMediaForAllBoards(uploadedMediaFile)
          : boardPromoMediaService.saveMediaFile(draftProfile.id, uploadedMediaFile)
      }

      setPromoMedia(nextPromoMedia)
      syncPromoMediaState()
      await persistPromoMediaStorage(draftProfile.id)
      setPromoMediaUrl(getCurrentLinkedPromoUrl(nextPromoMedia))
      setPromoMediaError(null)
      setVideoPreviewFailed(false)
      setImagePreviewFailed(false)
      await loadMediaFiles()
    } catch (promoError) {
      setPromoMediaError(getPromoMediaErrorMessage(promoError))
    }
  }

  function toggleMediaSelection(mediaId: number) {
    setSelectedMediaIds((current) => (
      current.includes(mediaId)
        ? current.filter((id) => id !== mediaId)
        : [...current, mediaId]
    ))
  }

  function selectAllVideoMediaFiles() {
    setSelectedMediaIds((current) => Array.from(new Set([
      ...current,
      ...promoLibraryVideos.map((mediaFile) => mediaFile.id),
    ])))
  }

  async function deletePromoMediaFile(mediaFile: MediaFile) {
    if (!window.confirm(`Удалить файл "${mediaFile.filename}"?`)) {
      return
    }

    try {
      await mediaService.deleteMedia(mediaFile.id)
      boardPromoMediaService.removeMediaById(mediaFile.id)
      if (draftProfile) {
        const nextPromoMedia = getCurrentPromoMedia(draftProfile.id)

        setPromoMedia(nextPromoMedia)
        syncPromoMediaState()
        await persistPromoMediaStorage(draftProfile.id)
        setPromoMediaUrl(getCurrentLinkedPromoUrl(nextPromoMedia))
      }
      await loadMediaFiles()
      setPromoMediaError(null)
    } catch (promoError) {
      setPromoMediaError(getPromoMediaErrorMessage(promoError))
    }
  }

  async function deleteSelectedMediaFiles() {
    if (selectedMediaIds.length === 0) {
      return
    }

    if (!window.confirm(`Удалить выбранные файлы (${selectedMediaIds.length})? Они будут удалены из табло, базы и папки uploads.`)) {
      return
    }

    try {
      for (const mediaId of selectedMediaIds) {
        await mediaService.deleteMedia(mediaId)
        boardPromoMediaService.removeMediaById(mediaId)
      }

      if (draftProfile) {
        const nextPromoMedia = getCurrentPromoMedia(draftProfile.id)

        setPromoMedia(nextPromoMedia)
        syncPromoMediaState()
        await persistPromoMediaStorage(draftProfile.id)
        setPromoMediaUrl(getCurrentLinkedPromoUrl(nextPromoMedia))
      }

      setSelectedMediaIds([])
      await loadMediaFiles()
      setPromoMediaError(null)
    } catch (promoError) {
      setPromoMediaError(getPromoMediaErrorMessage(promoError))
    }
  }

  const activeRooms = rooms.filter(getRoomActive)
  const promoMediaUrlValidation = validateBoardMediaUrl(promoMediaUrl)
  const newScreenVideoUrlValidation = validateBoardVideoUrl(newScreenVideoUrl)
  const promoMediaPreviewUrl = promoMediaUrlValidation.normalizedUrl || getCurrentLinkedPromoUrl(promoMedia)
  const newScreenVideoPreviewUrl = newScreenVideoUrlValidation.valid
    ? newScreenVideoUrlValidation.normalizedUrl
    : ''
  const promoLibraryVideos = mediaFiles.filter((mediaFile) => mediaFile.type === 'video')
  const promoLibraryImages = mediaFiles.filter((mediaFile) => mediaFile.type === 'image')
  const allVideoMediaSelected = promoLibraryVideos.length > 0
    && promoLibraryVideos.every((mediaFile) => selectedMediaIds.includes(mediaFile.id))
  const generalUrl = `${window.location.origin}/board`
  const generalProfile = getBoardProfile('general', 'Общее табло', 'general')
  const roomProfiles = rooms.map((room) => {
    const boardId = getRoomBoardId(room)

    return {
      profile: getBoardProfile(`room-${boardId}`, getRoomName(room), 'individual', boardId, [boardId]),
      room,
    }
  })
  const orderedRoomProfiles = lastSavedBoardProfileIdRef.current
    ? [
        ...roomProfiles.filter(({ profile }) => profile.id === lastSavedBoardProfileIdRef.current),
        ...roomProfiles.filter(({ profile }) => profile.id !== lastSavedBoardProfileIdRef.current),
      ]
    : roomProfiles
  const draftSelectedRoomIds = draftProfile ? getProfileRoomIds(draftProfile) : []
  const draftSelectedRoomNames = draftProfile ? getProfileSelectedRoomNames(draftProfile) : []
  return (
    <div className="page-stack">
      <section className="admin-page-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                <Monitor size={14} />
                Настройка
              </span>
              <h2>Табло</h2>
              <p className="admin-section-description">
                Ссылки на табло мест обслуживания и общее табло для всех вызовов.
              </p>
            </div>
          </div>

          {error ? <div className="modal-error">{error}</div> : null}

          {loading ? (
            <div className="empty-state compact-empty"><h2>Загружаем кабинеты</h2></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Табло</th>
                    <th>Места обслуживания</th>
                    <th>Ссылка</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Общее табло */}
                  <tr>
                    <td><strong>Общее табло</strong></td>
                    <td>{getProfileRoomNames(generalProfile)}</td>
                    <td>
                      <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {generalUrl}
                      </code>
                    </td>
                    <td>
                      <div className="button-row">
                        <Button
                          icon={<ExternalLink size={14} />}
                          onClick={() => openUrl(generalUrl)}
                          size="sm"
                          variant="secondary"
                        >
                          Открыть табло
                        </Button>
                        <Button
                          icon={copied === generalUrl ? <Check size={14} /> : <Copy size={14} />}
                          onClick={() => void copyUrl(generalUrl)}
                          size="sm"
                          variant="secondary"
                        >
                          {copied === generalUrl ? 'Скопировано' : 'Копировать'}
                        </Button>
                        <Button
                          icon={<Edit3 size={14} />}
                          onClick={() => startEditProfile(generalProfile)}
                          size="sm"
                          variant="secondary"
                        >
                          Редактировать
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Отдельные места обслуживания */}
                  {orderedRoomProfiles.map(({ profile, room }) => {
                    const name = getRoomName(room)
                    const url = getRoomBoardUrl(room, profile)
                    return (
                      <tr key={String(room.id)}>
                        <td>{name}</td>
                        <td>{name}</td>
                        <td>
                          <div className="admin-link-cell">
                            <span>Ссылка на табло:</span>
                            <code>{url}</code>
                          </div>
                        </td>
                        <td>
                          <div className="button-row">
                            <Button
                              icon={<ExternalLink size={14} />}
                              onClick={() => openUrl(url)}
                              size="sm"
                              variant="secondary"
                            >
                              Открыть табло
                            </Button>
                            <Button
                              icon={copied === url ? <Check size={14} /> : <Copy size={14} />}
                              onClick={() => void copyUrl(url)}
                              size="sm"
                              variant="secondary"
                            >
                              {copied === url ? 'Скопировано' : 'Копировать'}
                            </Button>
                            <Button
                              icon={<Edit3 size={14} />}
                              onClick={() => startEditProfile(profile)}
                              size="sm"
                              variant="secondary"
                            >
                              Редактировать
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {/* Созданные экраны */}
                  {boardSettings.screens.map((screen) => {
                    const profile = getBoardProfile(
                      `screen-${screen.id}`,
                      screen.name,
                      screen.roomIds?.length === 1 ? 'individual' : 'general',
                      screen.roomIds?.[0] ?? '',
                      screen.roomIds ?? [],
                    )
                    const url = getScreenUrl(screen)
                    return (
                      <tr key={screen.id}>
                        <td><strong>{profile.name}</strong></td>
                        <td>{getProfileRoomNames(profile)}</td>
                        <td>
                          <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>{url}</code>
                        </td>
                        <td>
                          <div className="button-row">
                            <Button
                              icon={<ExternalLink size={14} />}
                              onClick={() => openUrl(url)}
                              size="sm"
                              variant="secondary"
                            >
                              Открыть табло
                            </Button>
                            <Button
                              icon={copied === url ? <Check size={14} /> : <Copy size={14} />}
                              onClick={() => void copyUrl(url)}
                              size="sm"
                              variant="secondary"
                            >
                              {copied === url ? 'Скопировано' : 'Копировать'}
                            </Button>
                            <Button
                              icon={<Edit3 size={14} />}
                              onClick={() => startEditProfile(profile)}
                              size="sm"
                              variant="secondary"
                            >
                              Редактировать
                            </Button>
                            <Button
                              icon={<Trash2 size={14} />}
                              onClick={() => void deleteScreen(screen.id)}
                              size="sm"
                              variant="danger"
                            >
                              Удалить
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Форма создания объединённого экрана */}
        <aside className="widget-panel admin-form-panel">
          <div className="admin-form">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Редактирование</span>
                <h2>{draftProfile ? draftProfile.name : 'Настройки табло'}</h2>
              </div>
            </div>

            {!draftProfile ? (
              <p className="admin-muted-text">
                Выберите табло в списке и нажмите «Редактировать».
              </p>
            ) : (
              <>
            <BoardSettingsAccordion defaultOpen title="Основные настройки">
            <label className="field">
              <span>Название</span>
              <input
                onChange={(event) => updateDraftProfile({ name: event.target.value })}
                value={draftProfile.name}
              />
            </label>

            <label className="field">
              <span>Тип табло</span>
              <select
                onChange={(event) => changeDraftBoardType(event.target.value as BoardSettings['boardType'])}
                value={draftProfile.boardType}
              >
                <option value="general">Общее</option>
                <option value="individual">Индивидуальное</option>
              </select>
            </label>

            <div className="board-room-selection">
              <span className="board-settings-field-label">Места обслуживания табло</span>

              {draftSelectedRoomNames.length > 0 ? (
                <div className="board-selected-room-chips" aria-label="Выбранные места обслуживания">
                  {draftSelectedRoomNames.map((name, index) => (
                    <span key={`${name}-${index}`}>{name}</span>
                  ))}
                </div>
              ) : (
                <p className="admin-muted-text">
                  {draftProfile.boardType === 'general'
                    ? 'Если ничего не выбрано, табло покажет все активные места обслуживания.'
                    : 'Выберите одно место обслуживания для индивидуального табло.'}
                </p>
              )}

              <div className="board-room-selection-list">
                {activeRooms.map((room) => {
                  const boardId = getRoomBoardId(room)
                  const checked = draftProfile.boardType === 'individual'
                    ? normalizeRoomLookupValue(draftProfile.roomBoardId) === normalizeRoomLookupValue(boardId)
                    : draftSelectedRoomIds.some((roomId) => (
                        normalizeRoomLookupValue(roomId) === normalizeRoomLookupValue(boardId)
                      ))

                  return (
                    <label key={String(room.id)}>
                      <input
                        checked={checked}
                        name={`board-rooms-${draftProfile.id}`}
                        onChange={() => {
                          if (draftProfile.boardType === 'individual') {
                            setDraftIndividualRoom(boardId)
                          } else {
                            toggleDraftGeneralRoom(boardId)
                          }
                        }}
                        type={draftProfile.boardType === 'individual' ? 'radio' : 'checkbox'}
                      />
                      <span>{getRoomName(room)}</span>
                    </label>
                  )
                })}
                {activeRooms.length === 0 ? (
                  <div className="promo-media-empty">Места обслуживания не найдены</div>
                ) : null}
              </div>
            </div>

            <div className="admin-link-cell">
              <span>Ссылка выбранного табло:</span>
              <code>{getProfileUrl(draftProfile)}</code>
            </div>
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title="Шаблон табло">
              <BoardTemplateSelector
                onSelect={(template) => updateDraftProfile({ template })}
                selectedTemplate={draftProfile.template}
              />
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title="Формат экрана">
              <BoardScreenFormatSelector
                onSelect={(screenFormat) => updateBoardStyleSettings({ screenFormat })}
                selectedFormat={boardStyleSettings.screenFormat}
              />
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title="Шрифты">
              <div className="board-typography-settings">
                <label className="field">
                  <span>Шрифт табло</span>
                  <select
                    onChange={(event) => updateBoardStyleSettings({
                      fontFamily: event.target.value as BoardFontFamily,
                    })}
                    value={boardStyleSettings.fontFamily}
                  >
                    {boardFontOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <BoardFontScaleField
                  key={draftProfile.id}
                  onChange={(fontScalePercent) => updateBoardStyleSettings({ fontScalePercent })}
                  value={boardStyleSettings.fontScalePercent}
                />
              </div>
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title="Цвета">
              <div className="board-color-settings-grid">
                {boardColorFields.map((field) => (
                  <BoardColorField
                    colorKey={field.key}
                    fallbackValue={defaultBoardStyleSettings[field.key]}
                    key={`${draftProfile.id}-${field.key}`}
                    label={field.label}
                    onChange={(value) => updateBoardStyleSettings({ [field.key]: value })}
                    value={boardStyleSettings[field.key]}
                  />
                ))}
              </div>
            </BoardSettingsAccordion>

            {draftProfile.template === 'video_queue' ? (
              <BoardSettingsAccordion title="Фото и видео">
                {promoMediaError ? <div className="modal-error">{promoMediaError}</div> : null}

                <label className="field">
                  <span>Фото или видео по ссылке</span>
                  <input
                    aria-invalid={!promoMediaUrlValidation.valid}
                    onChange={(event) => {
                      setPromoMediaUrl(event.target.value)
                      setPromoMediaError(null)
                      setVideoPreviewFailed(false)
                      setImagePreviewFailed(false)
                    }}
                    placeholder="https://example.com/file.mp4 или https://example.com/image.jpg"
                    type="url"
                    value={promoMediaUrl}
                  />
                  <small className="field-help">Поддерживаются прямые ссылки на PNG, JPG, WebP, GIF, MP4, WebM, OGG</small>
                  {!promoMediaUrlValidation.valid ? (
                    <small className="field-error">{promoMediaUrlValidation.error}</small>
                  ) : null}
                </label>

                <div className="button-row">
                  <Button
                    disabled={!promoMediaUrlValidation.valid || !promoMediaUrl.trim()}
                    icon={promoMediaUrlValidation.mediaType === 'image' ? <ImageIcon size={14} /> : <Video size={14} />}
                    onClick={savePromoMediaUrl}
                    size="sm"
                    variant="secondary"
                  >
                    Сохранить URL
                  </Button>
                  <AdminFileInput
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov"
                    buttonLabel="Загрузить фото/видео"
                    hint="Поддерживаются PNG, JPG, WebP, GIF, MP4, WebM, MOV"
                    id={`promo-media-file-${draftProfile.id}`}
                    multiple
                    onChange={(event) => void uploadPromoMedia(event)}
                  />
                  <Button
                    disabled={!promoMediaUrl.trim() && !getCurrentLinkedPromoUrl(promoMedia)}
                    icon={<X size={14} />}
                    onClick={clearPromoMediaUrl}
                    size="sm"
                    variant="secondary"
                  >
                    Очистить ссылку
                  </Button>
                </div>

                {promoMediaPreviewUrl && promoMediaUrlValidation.mediaType !== 'image' && !videoPreviewFailed ? (
                  <div className="promo-media-preview">
                    <video
                      controls
                      muted
                      onError={() => setVideoPreviewFailed(true)}
                      onLoadedData={() => setVideoPreviewFailed(false)}
                      playsInline
                      src={promoMediaPreviewUrl}
                    />
                  </div>
                ) : promoMediaPreviewUrl && promoMediaUrlValidation.mediaType !== 'image' ? (
                  <div className="promo-media-empty">Видео не удалось загрузить</div>
                ) : promoMediaPreviewUrl && !imagePreviewFailed ? (
                  <div className="promo-media-preview">
                    <img
                      alt="Превью медиафайла"
                      onError={() => setImagePreviewFailed(true)}
                      src={promoMediaPreviewUrl}
                    />
                  </div>
                ) : promoMediaPreviewUrl ? (
                  <div className="promo-media-empty">Не удалось загрузить превью медиафайла</div>
                ) : (
                  <div className="promo-media-empty">Медиа не задано</div>
                )}

                <div className="board-media-library">
                  <div className="board-media-library-header">
                    <span className="board-settings-field-label">Загруженные медиафайлы</span>
                    <div className="button-row">
                      <Button
                        disabled={mediaFilesLoading || promoLibraryVideos.length === 0 || allVideoMediaSelected}
                        icon={<CheckSquare size={14} />}
                        onClick={selectAllVideoMediaFiles}
                        size="sm"
                        variant="secondary"
                      >
                        Выбрать все видео
                      </Button>
                      <Button
                        disabled={selectedMediaIds.length === 0}
                        icon={<Trash2 size={14} />}
                        onClick={() => void deleteSelectedMediaFiles()}
                        size="sm"
                        variant="danger"
                      >
                        Удалить выбранные
                      </Button>
                      <Button
                        disabled={mediaFilesLoading}
                        onClick={() => void loadMediaFiles()}
                        size="sm"
                        variant="secondary"
                      >
                        Обновить
                      </Button>
                    </div>
                  </div>
                  {mediaFiles.length > 0 ? (
                    <div className="board-media-list">
                      {promoLibraryVideos.map((mediaFile) => {
                        const fullUrl = mediaService.getMediaFullUrl(mediaFile.url)
                        const currentVideoItem = (promoMedia.videoItems ?? []).find((item) => item.url === fullUrl)

                        return (
                          <article className="board-media-item board-media-item-library" key={mediaFile.id}>
                            <label className="board-media-select">
                              <input
                                checked={selectedMediaIds.includes(mediaFile.id)}
                                onChange={() => toggleMediaSelection(mediaFile.id)}
                                type="checkbox"
                              />
                            </label>
                            <div className="board-media-thumb board-media-thumb-large">
                              <video muted playsInline preload="metadata" src={fullUrl} />
                            </div>
                            <div className="board-media-item-spacer" />
                            <div className="button-row board-media-item-actions board-media-item-actions-stacked">
                              <label className="board-media-frequency">
                                <span>{'\u041a\u0430\u0436\u0434\u044b\u0435 N \u0432\u0438\u0434\u0435\u043e'}</span>
                                <input
                                  min={1}
                                  onChange={(event) => void updatePromoVideoFrequencyForMediaFile(mediaFile, event.target.value)}
                                  placeholder="5"
                                  type="number"
                                  value={currentVideoItem?.playEvery ?? ""}
                                />
                              </label>
                              <Button
                                className="board-media-delete-button"
                                icon={<Trash2 size={14} />}
                                onClick={() => void deletePromoMediaFile(mediaFile)}
                                size="sm"
                                variant="danger"
                              >
                                Удалить
                              </Button>
                            </div>
                          </article>
                        )
                      })}
                      {promoLibraryVideos.length > 0 && promoLibraryImages.length > 0 ? (
                        <div className="board-media-divider" />
                      ) : null}
                      {promoLibraryImages.map((mediaFile) => {
                        const fullUrl = mediaService.getMediaFullUrl(mediaFile.url)

                        return (
                          <article className="board-media-item board-media-item-library" key={mediaFile.id}>
                            <label className="board-media-select">
                              <input
                                checked={selectedMediaIds.includes(mediaFile.id)}
                                onChange={() => toggleMediaSelection(mediaFile.id)}
                                type="checkbox"
                              />
                            </label>
                            <div className="board-media-thumb">
                              <img alt="" src={fullUrl} />
                            </div>
                            <div className="board-media-item-spacer" />
                            <div className="button-row board-media-item-actions">
                              <Button
                                className="board-media-delete-button"
                                icon={<Trash2 size={14} />}
                                onClick={() => void deletePromoMediaFile(mediaFile)}
                                size="sm"
                                variant="danger"
                              >
                                Удалить
                              </Button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="promo-media-empty">
                      {mediaFilesLoading ? 'Загружаем медиафайлы...' : 'Загруженных медиафайлов пока нет'}
                    </div>
                  )}
                </div>
              </BoardSettingsAccordion>
            ) : null}

            <BoardSettingsAccordion title="Бегущая строка">
              <label className="admin-toggle-row">
                <input
                  checked={draftProfile.showMarquee ?? true}
                  onChange={(event) => updateDraftProfile({ showMarquee: event.target.checked })}
                  type="checkbox"
                />
                <span>Показывать бегущую строку</span>
              </label>

              <label className="admin-toggle-row">
                <input
                  checked={draftProfile.liteMode ?? false}
                  onChange={(event) => updateDraftProfile({ liteMode: event.target.checked })}
                  type="checkbox"
                />
                <span>Упрощённый внешний вид для слабых устройств</span>
              </label>

              <label className="field">
                <span>Размер бегущей строки</span>
                <input
                  disabled={!(draftProfile.showMarquee ?? true)}
                  onChange={(event) => updateDraftProfile({
                    marqueeSizePercent: Math.min(300, Math.max(60, Number(event.target.value) || 100)),
                  })}
                  max={300}
                  min={60}
                  step={5}
                  type="number"
                  value={draftProfile.marqueeSizePercent ?? 100}
                />
                <small className="field-help">100% - стандартный размер. Для слабых устройств можно сделать строку меньше и проще.</small>
              </label>

              <label className="field">
                <span>Смещение бегущей строки</span>
                <input
                  disabled={!(draftProfile.showMarquee ?? true)}
                  onChange={(event) => updateDraftProfile({
                    marqueeOffsetPx: Math.min(200, Math.max(-200, Number(event.target.value) || 0)),
                  })}
                  max={200}
                  min={-200}
                  step={2}
                  type="number"
                  value={draftProfile.marqueeOffsetPx ?? 0}
                />
                <small className="field-help">Положительное значение поднимает строку вверх, отрицательное опускает вниз. Это удобно, если телевизор подрезает нижний край экрана.</small>
              </label>

              <label className="field">
                <span>Текст бегущей строки</span>
                <textarea
                  className="board-marquee-textarea"
                  disabled={!(draftProfile.showMarquee ?? true)}
                  onChange={(event) => updateDraftProfile({ marqueeText: event.target.value })}
                  placeholder="Например: Добро пожаловать, соблюдайте дистанцию и ожидайте приглашения."
                  rows={4}
                  value={draftProfile.marqueeText ?? ""}
                />
                <small className="field-help">Текст показывается в нижней части табло и движется справа налево.</small>
              </label>
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title={'\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438 \u043e\u0437\u0432\u0443\u0447\u043a\u0430'}>
            <label className="admin-toggle-row">
              <input
                checked={draftProfile.voiceEnabled}
                onChange={(event) => updateDraftProfile({ voiceEnabled: event.target.checked })}
                type="checkbox"
              />
              <span>{'\u041e\u0437\u0432\u0443\u0447\u043a\u0430 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0430'}</span>
            </label>

            <label className="admin-toggle-row">
              <input
                checked={draftProfile.showRecentCalls}
                onChange={(event) => updateDraftProfile({ showRecentCalls: event.target.checked })}
                type="checkbox"
              />
              <span>{'\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0432\u044b\u0437\u043e\u0432\u044b'}</span>
            </label>

            <label className="field">
              <span>{'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u0442\u0440\u043e\u043a \u0438\u0441\u0442\u043e\u0440\u0438\u0438'}</span>
              <input
                disabled={!draftProfile.showRecentCalls}
                onChange={(event) => updateDraftProfile({
                  recentCallsLimit: Math.min(30, Math.max(0, Number(event.target.value))),
                })}
                max={30}
                min={0}
                step={1}
                type="number"
                value={draftProfile.recentCallsLimit}
              />
              <small className="field-help">{'\u041e\u0442 0 \u0434\u043e 30. \u041f\u0440\u0438 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0438 0 \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043a\u0440\u044b\u0442\u0430.'}</small>
            </label>
            </BoardSettingsAccordion>

            <div className="modal-actions">
              <Button
                icon={<X size={16} />}
                onClick={cancelEditProfile}
                variant="secondary"
              >
                Отмена
              </Button>
              <Button
                disabled={
                  !draftProfile.name.trim()
                  || (draftProfile.boardType === 'individual' && !draftProfile.roomBoardId)
                  || (draftProfile.template === 'video_queue' && !promoMediaUrlValidation.valid)
                }
                icon={<Save size={16} />}
                onClick={() => void saveDraftProfile()}
                variant="primary"
              >
                Сохранить
              </Button>
            </div>
              </>
            )}
          </div>

          {!draftProfile ? (
          <div className="admin-form board-create-form">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Объединённый экран</span>
                <h2>Добавить экран</h2>
              </div>
            </div>

            <BoardSettingsAccordion defaultOpen title="Основные настройки">
            <label className="field">
              <span>Название экрана</span>
              <input
                onChange={(event) => setNewScreenName(event.target.value)}
                placeholder="Например: Приёмный покой"
                value={newScreenName}
              />
            </label>

            <div className="board-room-selection">
              <span className="board-settings-field-label">Выберите места обслуживания</span>
              {activeRooms.map((room) => {
                const name = getRoomName(room)
                return (
                  <label key={String(room.id)}>
                    <input
                      checked={newScreenRooms.includes(name)}
                      onChange={() => toggleRoom(name)}
                      type="checkbox"
                    />
                    <span>{name}</span>
                  </label>
                )
              })}
            </div>
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title="Шаблон табло">
              <BoardTemplateSelector
                onSelect={(template) => {
                  setNewScreenTemplate(template)
                  setNewScreenVideoPreviewFailed(false)
                }}
                selectedTemplate={newScreenTemplate}
              />
            </BoardSettingsAccordion>

            <BoardSettingsAccordion title="Формат экрана">
              <BoardScreenFormatSelector
                onSelect={setNewScreenFormat}
                selectedFormat={newScreenFormat}
              />
            </BoardSettingsAccordion>

            {newScreenTemplate === 'video_queue' ? (
              <BoardSettingsAccordion title="Фото и видео">
                <label className="field">
                  <span>Ссылка на видео</span>
                  <input
                    aria-invalid={!newScreenVideoUrlValidation.valid}
                    onChange={(event) => {
                      setNewScreenVideoUrl(event.target.value)
                      setNewScreenVideoPreviewFailed(false)
                    }}
                    placeholder="https://example.com/video.mp4"
                    type="url"
                    value={newScreenVideoUrl}
                  />
                  <small className="field-help">Поддерживаются прямые ссылки на mp4/webm/ogg</small>
                  {!newScreenVideoUrlValidation.valid ? (
                    <small className="field-error">{newScreenVideoUrlValidation.error}</small>
                  ) : null}
                </label>

                <div className="button-row">
                  <Button
                    disabled={!newScreenVideoUrl}
                    icon={<X size={14} />}
                    onClick={() => {
                      setNewScreenVideoUrl('')
                      setNewScreenVideoPreviewFailed(false)
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    Очистить ссылку
                  </Button>
                </div>

                {newScreenVideoPreviewUrl && !newScreenVideoPreviewFailed ? (
                  <div className="promo-media-preview">
                    <video
                      controls
                      muted
                      onError={() => setNewScreenVideoPreviewFailed(true)}
                      onLoadedData={() => setNewScreenVideoPreviewFailed(false)}
                      playsInline
                      src={newScreenVideoPreviewUrl}
                    />
                    <small>Предпросмотр видео</small>
                  </div>
                ) : newScreenVideoPreviewUrl ? (
                  <div className="promo-media-empty">Видео не удалось загрузить</div>
                ) : (
                  <div className="promo-media-empty">Видео не задано</div>
                )}
              </BoardSettingsAccordion>
            ) : null}

            <div className="modal-actions">
              <Button
                disabled={
                  !newScreenName.trim()
                  || newScreenRooms.length === 0
                  || (newScreenTemplate === 'video_queue' && !newScreenVideoUrlValidation.valid)
                }
                icon={<Plus size={16} />}
                onClick={() => void addScreen()}
                variant="primary"
              >
                Добавить экран
              </Button>
            </div>
          </div>
          ) : null}

          <div className="admin-form">
            <div className="panel-header">
              <div>
                <span className="eyebrow">{t.nav.tvBoard}</span>
                <h2>{t.admin.voiceSettings}</h2>
              </div>
            </div>

            <BoardSettingsAccordion defaultOpen title="Параметры озвучки">
            <label className="field">
              <span>{t.admin.voiceAddress}</span>
              <select
                onChange={(event) => updateVoiceSettings({ audience: event.target.value as VoiceAudience })}
                value={voiceSettings.audience}
              >
                <option value="patient">{getVoiceAudienceLabel('patient')}</option>
                <option value="client">{getVoiceAudienceLabel('client')}</option>
              </select>
            </label>

            <label className="field">
              <span>{t.admin.voiceAction}</span>
              <select
                onChange={(event) => updateVoiceSettings({ action: event.target.value as VoiceAction })}
                value={voiceSettings.action}
              >
                <option value="approach">{getVoiceActionLabel('approach')}</option>
                <option value="enter">{getVoiceActionLabel('enter')}</option>
              </select>
            </label>
            </BoardSettingsAccordion>
          </div>
        </aside>
      </section>
    </div>
  )
}
