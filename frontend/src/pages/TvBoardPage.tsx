import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CallBoard } from '@features/tv-board/CallBoard'
import { adminService } from '@services/adminService'
import type { BoardPromoMedia } from '@services/boardPromoMediaService'
import {
  boardStyleSettingsService,
  defaultBoardStyleSettings,
  getBoardFontStack,
  normalizeBoardStyleSettings,
  type BoardStyleSettings,
} from '@services/boardStyleSettingsService'
import { queueService } from '@services/queueService'
import type { BoardSettings } from '@services/api'
import { getLocale } from '@shared/locales/useLocale'
import type { Room, Ticket } from '@shared/types'
import {
  getRoomBoardId,
  getRoomPlaceNumber,
  normalizeRoomLookupValue,
  roomMatchesIdentifier,
} from '@shared/utils'

const boardSettingsPollingMs = 30_000
const boardRoomsPollingMs = 30_000
const boardQueuePollingMs = 5_000

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
  roomIds: [],
  screens: [],
  showRecentCalls: true,
  showTime: true,
  styleSettings: {},
  template: 'classic',
  voiceEnabled: true,
}

type RouteBoardSettings = BoardSettings & {
  resolvedProfileId: string
}

function boardIdentifierEquals(left?: string | number | null, right?: string | number | null): boolean {
  const normalizedLeft = normalizeRoomLookupValue(left)
  const normalizedRight = normalizeRoomLookupValue(right)

  return Boolean(normalizedLeft && normalizedLeft === normalizedRight)
}

function getFallbackProfileId(settings: BoardSettings, roomId?: string): string {
  if (roomId) {
    return settings.profiles?.find((item) => (
      item.boardType === 'individual' && boardIdentifierEquals(item.roomBoardId, roomId)
    ))?.id ?? `room-${roomId}`
  }

  return settings.profiles?.find((item) => item.boardType === 'general')?.id ?? 'general'
}

function getBoardSettingsForRoute(settings: BoardSettings, roomId?: string, profileId?: string): RouteBoardSettings {
  const profileById = profileId
    ? settings.profiles?.find((item) => String(item.id) === String(profileId))
    : undefined
  const profile = profileById ?? (roomId
    ? settings.profiles?.find((item) => (
      item.boardType === 'individual' && boardIdentifierEquals(item.roomBoardId, roomId)
    ))
    : settings.profiles?.find((item) => item.boardType === 'general'))

  if (!profile) {
    const resolvedProfileId = getFallbackProfileId(settings, roomId)

    if (
      roomId &&
      settings.boardType === 'individual' &&
      boardIdentifierEquals(settings.roomBoardId, roomId)
    ) {
      return { ...settings, resolvedProfileId }
    }

    if (!roomId && settings.boardType === 'general') {
      return { ...settings, resolvedProfileId }
    }

    return { ...defaultBoardSettings, resolvedProfileId }
  }

  return {
    ...settings,
    boardType: profile.boardType,
    liteMode: profile.liteMode ?? settings.liteMode ?? false,
    marqueeOffsetPx: profile.marqueeOffsetPx ?? settings.marqueeOffsetPx ?? 0,
    marqueeSizePercent: profile.marqueeSizePercent ?? settings.marqueeSizePercent ?? 100,
    marqueeText: profile.marqueeText ?? settings.marqueeText ?? '',
    showMarquee: profile.showMarquee ?? settings.showMarquee ?? true,
    recentCallsLimit: profile.recentCallsLimit,
    roomBoardId: profile.roomBoardId,
    roomIds: profile.roomIds ?? [],
    showRecentCalls: profile.showRecentCalls,
    showTime: profile.showTime,
    template: profile.template,
    voiceEnabled: profile.voiceEnabled,
    resolvedProfileId: profile.id,
  }
}

function isRoomClosed(room?: Room): boolean {
  return Boolean(room && (room.active === false || room.isActive === false))
}

function getBoardRoomPlaceTypeLabel(): string {
  const placeTypes = getLocale('ru').placeTypes

  return placeTypes.room
}

function formatBoardRoomName(room?: Pick<Room, 'id' | 'name' | 'number' | 'placeType'> | { id?: string; name?: string; number?: string | number; placeType?: string }): string {
  const placeLabel = getBoardRoomPlaceTypeLabel()
  const placeNumber = getRoomPlaceNumber(room as Room | undefined) || (room?.id ? String(room.id) : '')
  const rawName = typeof room?.name === 'string' && room.name.trim()
    ? room.name.trim()
    : typeof room?.number === 'string' && room.number.trim()
      ? room.number.trim()
      : ''

  if (placeNumber) {
    return `${placeLabel} ${placeNumber}`
  }

  if (rawName) {
    return rawName
  }

  return getLocale('ru').placeTypes.unassigned
}

function getBoardRoomClosedLabel(): string {
  const placeTypes = getLocale('ru').placeTypes

  return placeTypes.roomClosed
}

function getRouteRoomIds(settings: RouteBoardSettings): string[] {
  if (settings.boardType === 'individual') {
    return settings.roomBoardId ? [settings.roomBoardId] : []
  }

  return settings.roomIds ?? []
}

function filterRoomsByBoardIds(rooms: Room[], roomIds: string[]): Room[] {
  if (roomIds.length === 0) {
    return rooms
  }

  return rooms.filter((room) => roomIds.some((roomId) => roomMatchesIdentifier(room, roomId)))
}

function filterTicketsByBoardIds(tickets: Ticket[], rooms: Room[], roomIds: string[]): Ticket[] {
  if (roomIds.length === 0) {
    return tickets
  }

  const selectedRoomIds = new Set(filterRoomsByBoardIds(rooms, roomIds).map((room) => String(room.id)))

  return tickets.filter((ticket) => (
    (ticket.roomId !== undefined && selectedRoomIds.has(String(ticket.roomId))) ||
    roomIds.some((roomId) => roomMatchesIdentifier({ id: ticket.roomId, name: ticket.roomName }, roomId))
  ))
}

export function TvBoardPage() {
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('roomId') ?? undefined
  const profileId = searchParams.get('profileId') ?? undefined
  const [error, setError] = useState<string | null>(null)
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(defaultBoardSettings)
  const [rooms, setRooms] = useState<Room[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [roomName, setRoomName] = useState<string>('')
  const [boardDataReady, setBoardDataReady] = useState(false)
  const [promoMedia, setPromoMedia] = useState<BoardPromoMedia>({})
  const [boardStyleSettings, setBoardStyleSettings] = useState<BoardStyleSettings>(defaultBoardStyleSettings)
  const boardSettingsHashRef = useRef('')
  const boardSnapshotVersionRef = useRef('')

  const setBoardSettingsIfChanged = (nextSettings: BoardSettings) => {
    const nextHash = JSON.stringify(nextSettings)

    if (boardSettingsHashRef.current === nextHash) {
      return
    }

    boardSettingsHashRef.current = nextHash
    setBoardSettings(nextSettings)
  }

  useEffect(() => {
    let active = true

    const loadSettings = () => {
      adminService.getBoardSettings()
        .then((nextSettings) => {
          if (active) {
            setBoardSettingsIfChanged(nextSettings)
          }
        })
        .catch((settingsError) => {
          console.error('Board settings load failed', settingsError)
        })
    }

    loadSettings()
    const interval = window.setInterval(loadSettings, boardSettingsPollingMs)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadRooms = () => {
      queueService.getBoardSnapshot(roomId)
        .then((snapshot) => {
          if (!active) {
            return
          }

          const nextRooms = snapshot.rooms

          setRooms(nextRooms)
          setRoomName(roomId
            ? formatBoardRoomName(
                nextRooms.find((room) => roomMatchesIdentifier(room, roomId)) ?? { id: roomId },
              )
            : '')
        })
        .catch((roomsError) => {
          console.error('Board rooms load failed', roomsError)
        })
    }

    void loadRooms()
    const interval = window.setInterval(loadRooms, boardRoomsPollingMs)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [roomId])

  useEffect(() => {
    let active = true
    let requestId = 0

    setBoardDataReady(false)
    boardSnapshotVersionRef.current = ''

    const load = async () => {
      const currentRequestId = requestId + 1
      requestId = currentRequestId

      try {
        const snapshot = await queueService.getBoardSnapshot(roomId)

        if (!active || currentRequestId !== requestId) return

        const nextTickets: Ticket[] = snapshot.tickets
        const nextSnapshotVersion = snapshot.updatedAt
          ?? nextTickets[0]?.updatedAt
          ?? nextTickets[0]?.calledAt
          ?? nextTickets[0]?.createdAt
          ?? ''

        if (nextSnapshotVersion && boardSnapshotVersionRef.current === nextSnapshotVersion) {
          if (error !== null) {
            setError(null)
          }
          setBoardDataReady(true)
          return
        }

        boardSnapshotVersionRef.current = nextSnapshotVersion

        setTickets(nextTickets)
        setError(null)
        setBoardDataReady(true)
      } catch (error) {
        console.error('Board load failed', error)
        if (!active || currentRequestId !== requestId) return
        setError(getLocale('ru').board.waiting)
        setTickets([])
        setBoardDataReady(false)
      }
    }

    void load()
    const interval = window.setInterval(load, boardQueuePollingMs)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [roomId])

  const routeBoardSettings = useMemo(
    () => getBoardSettingsForRoute(boardSettings, roomId, profileId),
    [boardSettings, roomId, profileId],
  )
  const selectedRouteRoomIds = roomId ? [] : getRouteRoomIds(routeBoardSettings)
  const visibleRooms = filterRoomsByBoardIds(rooms, selectedRouteRoomIds)
  const visibleTickets = filterTicketsByBoardIds(tickets, rooms, selectedRouteRoomIds)
  const boardRoom = roomId
    ? rooms.find((room) => roomMatchesIdentifier(room, roomId) || getRoomBoardId(room) === roomId || String(room.id) === roomId) ?? rooms[0]
    : undefined
  const roomClosed = Boolean(roomId) && isRoomClosed(boardRoom)
  const roomHeaderName = roomClosed && roomName && visibleTickets.length > 0 ? `${roomName} — закрыт` : roomName

  useEffect(() => {
    const serverPromoMedia = routeBoardSettings.promoMediaByProfileId?.[routeBoardSettings.resolvedProfileId] ?? {}
    const savedStyleSettings = routeBoardSettings.styleSettings?.[routeBoardSettings.resolvedProfileId]
    const nextStyleSettings = savedStyleSettings
      ? normalizeBoardStyleSettings(savedStyleSettings)
      : boardStyleSettingsService.getSettings(routeBoardSettings.resolvedProfileId)

    setPromoMedia((current) => (
      JSON.stringify(current) === JSON.stringify(serverPromoMedia) ? current : serverPromoMedia
    ))
    setBoardStyleSettings((current) => (
      JSON.stringify(current) === JSON.stringify(nextStyleSettings) ? current : nextStyleSettings
    ))
  }, [routeBoardSettings.promoMediaByProfileId, routeBoardSettings.resolvedProfileId, routeBoardSettings.styleSettings])

  const boardStyle = {
    '--board-accent-color': boardStyleSettings.accentColor,
    '--board-background': boardStyleSettings.boardBackground,
    '--board-border-color': boardStyleSettings.borderColor,
    '--board-current-background': boardStyleSettings.currentCallBackground,
    '--board-current-text': boardStyleSettings.currentCallText,
    '--board-font-scale': boardStyleSettings.fontScalePercent / 100,
    '--board-history-background': boardStyleSettings.historyBackground,
    '--board-history-text': boardStyleSettings.historyText,
    '--board-marquee-offset': `${routeBoardSettings.marqueeOffsetPx ?? 0}px`,
    '--board-marquee-scale': (routeBoardSettings.marqueeSizePercent ?? 100) / 100,
    background: boardStyleSettings.boardBackground,
    fontFamily: getBoardFontStack(boardStyleSettings.fontFamily),
  } as CSSProperties
  const screenFormatClass = boardStyleSettings.screenFormat === '4:3'
    ? 'board-format-4-3'
    : 'board-format-16-9'
  const boardClassName = `tv-board tv-board-${routeBoardSettings.template} ${screenFormatClass}`

  return (
    <main
      className={boardClassName}
      data-smartq-no-i18n="true"
      lang="ru"
      data-screen-format={boardStyleSettings.screenFormat}
      style={boardStyle}
    >
      {roomHeaderName ? (
        <header className="tv-header">
          <strong>{roomHeaderName}</strong>
        </header>
      ) : null}
      {error ? (
        <section className="empty-state">
          <h2>{error}</h2>
        </section>
      ) : null}
      {roomClosed && visibleTickets.length === 0 ? (
        <section className="tv-closed-state">
          <h1>{getBoardRoomClosedLabel()}</h1>
        </section>
      ) : (
        <CallBoard
          dataReady={boardDataReady}
          liteMode={routeBoardSettings.liteMode}
          marqueeText={routeBoardSettings.marqueeText}
          showMarquee={routeBoardSettings.showMarquee}
          promoMedia={promoMedia}
          recentCallsLimit={routeBoardSettings.recentCallsLimit}
          rooms={visibleRooms}
          showRecentCalls={routeBoardSettings.showRecentCalls}
          template={routeBoardSettings.template}
          tickets={visibleTickets}
          voiceEnabled={routeBoardSettings.voiceEnabled}
          labels={getLocale('ru').board}
        />
      )}
    </main>
  )
}
