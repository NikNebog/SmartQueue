import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { voiceSettingsService } from '@services/voiceSettingsService'
import type { BoardPromoImageItem, BoardPromoMedia, BoardPromoVideoItem } from '@services/boardPromoMediaService'
import type { BoardTemplate } from '@services/api'
import {
  buildEnglishCallAudioSequence,
  playAudioSequence as playEnglishAudioSequence,
} from './englishOfflineAudio'
import {
  buildKazakhCallAudioSequence,
  playAudioSequence as playKazakhAudioSequence,
} from './kazakhAudio'
import {
  buildRussianCallAudioSequence,
  playAudioSequence as playRussianAudioSequence,
} from './russianOfflineAudio'
import {
  getLocale,
} from '@shared/locales/useLocale'
import type { Room, Ticket } from '@shared/types'
import {
  getRoomPlaceNumber,
} from '@shared/utils'

type CallBoardProps = {
  labels?: {
    currentCall: string
    noShow: string
    recentCalls: string
    waiting: string
  }
  liteMode?: boolean
  marqueeText?: string
  showMarquee?: boolean
  promoMedia?: BoardPromoMedia
  recentCallsLimit?: number
  rooms: Room[]
  showRecentCalls?: boolean
  showTime?: boolean
  template?: BoardTemplate
  tickets: Ticket[]
  voiceEnabled?: boolean
  dataReady?: boolean
}

type BoardMultilingualLabelKey = 'currentCall' | 'recentCalls' | 'waiting'

type TicketRoom = Room | {
  id?: string
  name?: string
  number?: string | number
  placeType?: string
}

type PendingAnnouncement = {
  key: string
  mode: 'notification' | 'voice'
  room?: TicketRoom
  ticket: Ticket
}

const notificationAudioPath = '/audio/notification.mp3'
const announcementVolumeBoost = 3
const videoBaseVolume = 0.45
const promoVideoFrameProbeSize = 48

function BoardMultilingualLabel({ labelKey }: { labelKey: BoardMultilingualLabelKey }) {
  return <span className="tv-multilingual-label">{getLocale('ru').board[labelKey]}</span>
}

function getCallTime(ticket: Ticket): string {
  return ticket.calledAt ?? ticket.updatedAt ?? ticket.createdAt
}

function getCallTimestamp(ticket: Ticket): number {
  const timestamp = Date.parse(getCallTime(ticket))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getTicketRoom(ticket: Ticket, rooms: Room[]): TicketRoom {
  const room = rooms.find((item) => String(item.id) === String(ticket.roomId))

  if (ticket.roomName) {
    return {
      ...room,
      id: ticket.roomId ?? room?.id,
      name: ticket.roomName,
    }
  }

  return room ?? { id: ticket.roomId }
}

function getBoardRoomPlaceTypeLabel(): string {
  const placeTypes = getLocale('ru').placeTypes

  return placeTypes.room
}

function formatBoardRoomName(room?: TicketRoom): string {
  const placeLabel = getBoardRoomPlaceTypeLabel()
  const placeNumber = getRoomPlaceNumber(room) || (room?.id ? String(room.id) : '')
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

function getRoomName(ticket: Ticket, rooms: Room[]): string {
  const room = getTicketRoom(ticket, rooms)

  return formatBoardRoomName(room ?? { id: ticket.roomId })
}

function getRoomDisplayNumber(room?: TicketRoom): string {
  return getRoomPlaceNumber(room) || (room?.id ? String(room.id) : '')
}

function getRoomDisplayValue(room?: TicketRoom): string {
  return getRoomDisplayNumber(room) || formatBoardRoomName(room)
}

function getRoomPlaceLabel(): string {
  return getBoardRoomPlaceTypeLabel()
}

function getCallKey(ticket?: Ticket): string {
  if (!ticket) return ''

  return `${ticket.id}:${ticket.calledAt ?? ticket.status}`
}

function getCallAnnouncementKey(ticket?: Ticket): string {
  if (!ticket?.calledAt) return ''

  return `${ticket.id || ticket.number}_${ticket.calledAt}`
}

function isBoardCallTicket(ticket: Ticket): boolean {
  return Boolean(ticket.calledAt) || ticket.status === 'called' || ticket.status === 'in_service'
}

function getClassicHistoryDensityClass(rowCount: number): string {
  if (rowCount > 20) return 'tv-classic-history-ultra'
  if (rowCount > 12) return 'tv-classic-history-dense'
  if (rowCount > 7) return 'tv-classic-history-compact'

  return ''
}

function ClassicHistoryPanel({
  highlightedCallKey,
  historyLimit,
  recentCalls,
  rooms,
}: {
  highlightedCallKey?: string
  historyLimit: number
  recentCalls: Ticket[]
  rooms: Room[]
}) {
  return (
    <section className={`tv-recent tv-classic-history ${getClassicHistoryDensityClass(historyLimit)}`}>
      {recentCalls.length > 0 ? (
        <table>
          <tbody>
            {recentCalls.map((ticket) => (
              <tr
                className={highlightedCallKey === getCallKey(ticket) ? 'tv-call-animated' : ''}
                key={ticket.id}
              >
                <td>{ticket.number}</td>
                <td>{getRoomName(ticket, rooms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="tv-empty-recent">
          <BoardMultilingualLabel labelKey="waiting" />
        </div>
      )}
    </section>
  )
}

function HistoryCallsTable({
  highlightedCallKey,
  labels,
  recentCalls,
  rooms,
}: {
  highlightedCallKey?: string
  labels: NonNullable<CallBoardProps['labels']>
  recentCalls: Ticket[]
  rooms: Room[]
}) {
  return (
    <table className="tv-call-history-table">
      <thead>
        <tr>
          <th>Талон</th>
          <th>Кабинет</th>
        </tr>
      </thead>
      <tbody>
        {recentCalls.length > 0 ? recentCalls.map((ticket) => {
          const room = getTicketRoom(ticket, rooms)

          return (
            <tr
              className={highlightedCallKey === getCallKey(ticket) ? 'tv-call-animated' : ''}
              key={ticket.id}
            >
              <td>{ticket.number}</td>
              <td>{getRoomDisplayValue(room)}</td>
            </tr>
          )
        }) : (
          <tr>
            <td colSpan={2}>{labels.waiting}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function splitMarqueeMessages(text: string, maxChunkLength = 250): string[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim()

  if (!normalizedText) {
    return [' ']
  }

  const sentences = normalizedText
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean)
    ?? [normalizedText]

  const chunks: string[] = []
  let currentChunk = ''

  sentences.forEach((sentence) => {
    if (!currentChunk) {
      currentChunk = sentence
      return
    }

    const nextChunk = `${currentChunk} ${sentence}`.trim()

    if (nextChunk.length <= maxChunkLength) {
      currentChunk = nextChunk
      return
    }

    chunks.push(currentChunk)
    currentChunk = sentence
  })

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : [normalizedText]
}

function splitMarqueeMessagesByWords(text: string, maxWords = 100): string[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim()

  if (!normalizedText) {
    return [' ']
  }

  const sentenceChunks = splitMarqueeMessages(normalizedText, 500)
  const chunks: string[] = []
  let currentChunk = ''
  let currentWordCount = 0

  sentenceChunks.forEach((sentenceChunk) => {
    const sentenceWordCount = sentenceChunk.split(/\s+/).filter(Boolean).length

    if (!currentChunk) {
      currentChunk = sentenceChunk
      currentWordCount = sentenceWordCount
      return
    }

    if (currentWordCount + sentenceWordCount <= maxWords) {
      currentChunk = `${currentChunk} ${sentenceChunk}`.trim()
      currentWordCount += sentenceWordCount
      return
    }

    chunks.push(currentChunk)
    currentChunk = sentenceChunk
    currentWordCount = sentenceWordCount
  })

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : [normalizedText]
}

const BoardMarquee = memo(function BoardMarquee({ liteMode = false, text }: { liteMode?: boolean; text?: string }) {
  const normalizedText = text?.trim() ?? ''
  const marqueeMessages = useMemo(
    () => splitMarqueeMessagesByWords(normalizedText),
    [normalizedText],
  )
  const marqueeContent = useMemo(
    () => marqueeMessages.join('     •     '),
    [marqueeMessages],
  )
  const windowRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElementRef = useRef<Element | null>(null)
  const measureAnimationFrameRef = useRef<number | null>(null)
  const measurementRef = useRef({
    contentWidth: 0,
    liteMode,
    textSignature: '',
    windowWidth: 0,
  })
  const [animationDuration, setAnimationDuration] = useState(30)
  const [animationDistance, setAnimationDistance] = useState(0)

  function cancelScheduledMeasurement() {
    if (measureAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(measureAnimationFrameRef.current)
      measureAnimationFrameRef.current = null
    }
  }

  function updateAnimationDuration() {
    const windowWidth = windowRef.current?.clientWidth ?? 0
    const contentWidth = Math.ceil(contentRef.current?.getBoundingClientRect().width ?? 0)

    if (windowWidth <= 0 || contentWidth <= 0) {
      return
    }

    const previousMeasurement = measurementRef.current
    const contentWidthChanged = previousMeasurement.contentWidth !== contentWidth
    const dimensionsChanged = previousMeasurement.windowWidth !== windowWidth
      || previousMeasurement.liteMode !== liteMode
    const textChanged = previousMeasurement.textSignature !== marqueeContent

    if (!dimensionsChanged && !contentWidthChanged && !textChanged) {
      return
    }

    measurementRef.current = {
      contentWidth,
      liteMode,
      textSignature: marqueeContent,
      windowWidth,
    }

    const pixelsPerSecond = liteMode ? 70 : 88
    const nextDuration = Math.max(liteMode ? 14 : 12, contentWidth / pixelsPerSecond)

    setAnimationDuration((currentDuration) => (
      Math.abs(currentDuration - nextDuration) < 0.1 ? currentDuration : nextDuration
    ))
    setAnimationDistance((currentDistance) => (
      Math.abs(currentDistance - contentWidth) < 1 ? currentDistance : contentWidth
    ))
  }

  function scheduleAnimationMeasurement() {
    cancelScheduledMeasurement()

    measureAnimationFrameRef.current = window.requestAnimationFrame(() => {
      measureAnimationFrameRef.current = window.requestAnimationFrame(() => {
        measureAnimationFrameRef.current = null
        updateAnimationDuration()
      })
    })
  }

  useEffect(() => {
    if (!normalizedText) {
      cancelScheduledMeasurement()
      measurementRef.current = {
        contentWidth: 0,
        liteMode,
        textSignature: '',
        windowWidth: 0,
      }
      setAnimationDistance((currentDistance) => (currentDistance === 0 ? currentDistance : 0))
      setAnimationDuration((currentDuration) => (currentDuration === 30 ? currentDuration : 30))
      return
    }

    scheduleAnimationMeasurement()
  }, [liteMode, normalizedText, marqueeContent])

  useEffect(() => {
    if (!normalizedText) {
      return
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleAnimationMeasurement())
      : null

    resizeObserverRef.current = resizeObserver

    if (resizeObserver && windowRef.current) {
      resizeObserver.observe(windowRef.current)
    }

    if (resizeObserver && contentRef.current) {
      resizeObserver.observe(contentRef.current)
      observedElementRef.current = contentRef.current
    }

    window.addEventListener('resize', scheduleAnimationMeasurement)
    scheduleAnimationMeasurement()

    return () => {
      cancelScheduledMeasurement()

      if (observedElementRef.current && resizeObserver) {
        resizeObserver.unobserve(observedElementRef.current)
      }

      resizeObserver?.disconnect()
      resizeObserverRef.current = null
      observedElementRef.current = null
      window.removeEventListener('resize', scheduleAnimationMeasurement)
    }
  }, [liteMode, normalizedText, marqueeContent])

  const marqueeTrackStyle = {
    '--tv-marquee-duration': `${animationDuration}s`,
    '--tv-marquee-distance': `${animationDistance}px`,
  } as CSSProperties

  return (
    <section className={`tv-marquee-bar ${liteMode ? 'tv-marquee-bar-lite' : ''} ${normalizedText ? '' : 'tv-marquee-bar-empty'}`}>
      <div className={`tv-marquee-window ${liteMode ? 'tv-marquee-window-lite' : ''}`} ref={windowRef}>
        <div
          className={`tv-marquee-track ${liteMode ? 'tv-marquee-track-lite' : ''}`}
          style={marqueeTrackStyle}
        >
          <span className="tv-marquee-content" ref={contentRef}>{marqueeContent || ' '}</span>
          <span aria-hidden="true" className="tv-marquee-content tv-marquee-content-clone">{marqueeContent || ' '}</span>
        </div>
      </div>
    </section>
  )
})

void BoardMarquee

const BoardMarqueeSequential = memo(function BoardMarqueeSequential({ liteMode = false, text }: { liteMode?: boolean; text?: string }) {
  const normalizedText = text?.trim() ?? ''
  const marqueeMessages = useMemo(
    () => splitMarqueeMessages(normalizedText, 1),
    [normalizedText],
  )
  const windowRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElementRef = useRef<Element | null>(null)
  const measureAnimationFrameRef = useRef<number | null>(null)
  const measurementRef = useRef({
    liteMode,
    message: '',
    trackWidth: 0,
    windowWidth: 0,
  })
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [animationDuration, setAnimationDuration] = useState(30)
  const [animationOffsets, setAnimationOffsets] = useState({ start: 0, end: 0 })
  const currentMessage = marqueeMessages[currentMessageIndex % marqueeMessages.length] ?? ' '
  const shouldRotateMessages = marqueeMessages.length > 1

  useEffect(() => {
    setCurrentMessageIndex(0)
  }, [marqueeMessages.join('|')])

  function cancelScheduledMeasurement() {
    if (measureAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(measureAnimationFrameRef.current)
      measureAnimationFrameRef.current = null
    }
  }

  function updateAnimationDuration() {
    const windowWidth = windowRef.current?.clientWidth ?? 0
    const trackWidth = Math.ceil(trackRef.current?.getBoundingClientRect().width ?? 0)

    if (windowWidth <= 0 || trackWidth <= 0) {
      return
    }

    const previousMeasurement = measurementRef.current
    const dimensionsChanged = previousMeasurement.windowWidth !== windowWidth
      || previousMeasurement.trackWidth !== trackWidth
      || previousMeasurement.liteMode !== liteMode
    const messageChanged = previousMeasurement.message !== currentMessage

    if (!dimensionsChanged && !messageChanged) {
      return
    }

    measurementRef.current = {
      liteMode,
      message: currentMessage,
      trackWidth,
      windowWidth,
    }

    const totalDistance = windowWidth + trackWidth
    const pixelsPerSecond = liteMode ? 70 : 88
    const nextDuration = Math.max(liteMode ? 14 : 12, totalDistance / pixelsPerSecond)
    const nextOffsets = {
      start: windowWidth,
      end: -trackWidth,
    }

    setAnimationOffsets((currentOffsets) => (
      currentOffsets.start === nextOffsets.start && currentOffsets.end === nextOffsets.end
        ? currentOffsets
        : nextOffsets
    ))

    setAnimationDuration((currentDuration) => (
      Math.abs(currentDuration - nextDuration) < 0.1 ? currentDuration : nextDuration
    ))
  }

  function scheduleAnimationMeasurement() {
    cancelScheduledMeasurement()

    measureAnimationFrameRef.current = window.requestAnimationFrame(() => {
      measureAnimationFrameRef.current = window.requestAnimationFrame(() => {
        measureAnimationFrameRef.current = null
        updateAnimationDuration()
      })
    })
  }

  useEffect(() => {
    if (!normalizedText) {
      cancelScheduledMeasurement()
      measurementRef.current = {
        liteMode,
        message: '',
        trackWidth: 0,
        windowWidth: 0,
      }
      setAnimationOffsets((currentOffsets) => (
        currentOffsets.start === 0 && currentOffsets.end === 0
          ? currentOffsets
          : { start: 0, end: 0 }
      ))
      setAnimationDuration((currentDuration) => (currentDuration === 30 ? currentDuration : 30))
      return
    }

    scheduleAnimationMeasurement()
  }, [currentMessage, liteMode, normalizedText])

  useEffect(() => {
    if (!normalizedText) {
      return
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleAnimationMeasurement())
      : null

    resizeObserverRef.current = resizeObserver

    if (resizeObserver && windowRef.current) {
      resizeObserver.observe(windowRef.current)
    }

    if (resizeObserver && trackRef.current) {
      resizeObserver.observe(trackRef.current)
      observedElementRef.current = trackRef.current
    }

    window.addEventListener('resize', scheduleAnimationMeasurement)
    scheduleAnimationMeasurement()

    return () => {
      cancelScheduledMeasurement()

      if (observedElementRef.current && resizeObserver) {
        resizeObserver.unobserve(observedElementRef.current)
      }

      resizeObserver?.disconnect()
      resizeObserverRef.current = null
      observedElementRef.current = null
      window.removeEventListener('resize', scheduleAnimationMeasurement)
    }
  }, [currentMessage, liteMode, normalizedText])

  const marqueeTrackStyle = {
    '--tv-marquee-duration': `${animationDuration}s`,
    '--tv-marquee-iteration-count': shouldRotateMessages ? 1 : 'infinite',
    '--tv-marquee-start': `${animationOffsets.start}px`,
    '--tv-marquee-end': `${animationOffsets.end}px`,
  } as CSSProperties

  return (
    <section className={`tv-marquee-bar ${liteMode ? 'tv-marquee-bar-lite' : ''} ${normalizedText ? '' : 'tv-marquee-bar-empty'}`}>
      <div className={`tv-marquee-window ${liteMode ? 'tv-marquee-window-lite' : ''}`} ref={windowRef}>
        <div
          className={`tv-marquee-track ${liteMode ? 'tv-marquee-track-lite' : ''}`}
          key={`${currentMessageIndex}:${currentMessage}`}
          onAnimationEnd={() => {
            if (!shouldRotateMessages) {
              return
            }

            setCurrentMessageIndex((index) => (index + 1) % marqueeMessages.length)
          }}
          ref={trackRef}
          style={marqueeTrackStyle}
        >
          <span>{currentMessage}</span>
        </div>
      </div>
    </section>
  )
})

function getPromoVideoItems(media?: BoardPromoMedia): BoardPromoVideoItem[] {
  if (media?.videoItems?.length) {
    return media.videoItems
  }

  return media?.videoUrl ? [{ id: media.videoId, name: media.videoName, url: media.videoUrl }] : []
}

function getPromoImageItems(media?: BoardPromoMedia): BoardPromoImageItem[] {
  if (media?.imageItems?.length) {
    return media.imageItems
  }

  return media?.imageUrl ? [{ id: media.imageId, name: media.imageName, url: media.imageUrl }] : []
}

function getVideoPlayEvery(item: BoardPromoVideoItem): number | undefined {
  return typeof item.playEvery === 'number' && item.playEvery > 0
    ? Math.max(1, Math.trunc(item.playEvery))
    : undefined
}

function getVideoRepeatGap(item: BoardPromoVideoItem): number {
  return getVideoPlayEvery(item) ?? 0
}

function getGreatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)

  while (b !== 0) {
    const next = a % b
    a = b
    b = next
  }

  return a || 1
}

function getLeastCommonMultiple(left: number, right: number): number {
  if (left <= 0 || right <= 0) {
    return Math.max(left, right, 1)
  }

  return Math.abs(left * right) / getGreatestCommonDivisor(left, right)
}

function buildScheduledVideoItems(videoItems: BoardPromoVideoItem[]): BoardPromoVideoItem[] {
  const normalizedVideoItems = videoItems.filter((item) => Boolean(item?.url))

  if (normalizedVideoItems.length <= 1) {
    return normalizedVideoItems
  }

  const regularItems = normalizedVideoItems.filter((item) => !getVideoPlayEvery(item))
  const intervalItems = normalizedVideoItems.filter((item) => getVideoPlayEvery(item))

  if (intervalItems.length === 0) {
    return normalizedVideoItems
  }

  if (regularItems.length === 0) {
    return intervalItems
  }

  const regularItemsPerIntervalRound = intervalItems.reduce(
    (total, item) => total + Math.max(1, getVideoRepeatGap(item)),
    0,
  )
  const intervalRoundsPerCycle = Math.max(
    1,
    getLeastCommonMultiple(regularItems.length, regularItemsPerIntervalRound) / regularItemsPerIntervalRound,
  )
  const cycleLength = Math.max(
    regularItems.length + intervalItems.length * intervalRoundsPerCycle,
    intervalItems.length,
  )
  const scheduledItems: BoardPromoVideoItem[] = []
  let regularIndex = 0

  for (let roundIndex = 0; roundIndex < intervalRoundsPerCycle; roundIndex += 1) {
    for (let index = 0; index < intervalItems.length; index += 1) {
      const intervalItem = intervalItems[index]
      const repeatGap = Math.max(1, getVideoRepeatGap(intervalItem))

      for (let gapIndex = 0; gapIndex < repeatGap; gapIndex += 1) {
        scheduledItems.push(regularItems[regularIndex % regularItems.length])
        regularIndex += 1
      }

      scheduledItems.push(intervalItem)
    }
  }

  while (scheduledItems.length < cycleLength) {
    scheduledItems.push(regularItems[regularIndex % regularItems.length])
    regularIndex += 1
  }

  return scheduledItems
}

function getVideoPlaylistKey(videoItems?: BoardPromoVideoItem[]): string {
  return videoItems?.map((item) => `${item.url}:${item.playEvery ?? 0}`).join('|') ?? ''
}

type PromoPlaylistItem =
  | { item: BoardPromoImageItem; type: 'image' }
  | { item: BoardPromoVideoItem; type: 'video' }

function buildPromoPlaylist(videoItems: BoardPromoVideoItem[], imageItems: BoardPromoImageItem[]): PromoPlaylistItem[] {
  if (videoItems.length === 0) {
    return imageItems.map((item) => ({ item, type: 'image' }))
  }

  if (imageItems.length === 0) {
    return videoItems.map((item) => ({ item, type: 'video' }))
  }

  const playlist: PromoPlaylistItem[] = []
  const length = Math.max(videoItems.length, imageItems.length)

  for (let index = 0; index < length; index += 1) {
    playlist.push({ item: videoItems[index % videoItems.length], type: 'video' })
    playlist.push({ item: imageItems[index % imageItems.length], type: 'image' })
  }

  return playlist
}

function getPromoPlaylistKey(items: PromoPlaylistItem[]): string {
  return items.map((playlistItem) => `${playlistItem.type}:${playlistItem.item.url}:${playlistItem.type === 'video' ? playlistItem.item.playEvery ?? 0 : 0}`).join('|')
}

const PromoMediaPanel = memo(function PromoMediaPanel({
  announcementActive,
  media,
}: {
  announcementActive?: boolean
  media?: BoardPromoMedia
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoAdvanceTimeoutRef = useRef<number | null>(null)
  const videoStallTimeoutRef = useRef<number | null>(null)
  const maxObservedVideoTimeRef = useRef(0)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())
  const [failedVideoUrls, setFailedVideoUrls] = useState<Set<string>>(new Set())
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [videoSoundEnabled, setVideoSoundEnabled] = useState(true)
  const [isPortraitVideo, setIsPortraitVideo] = useState(false)
  const [isPillarboxPortraitVideo, setIsPillarboxPortraitVideo] = useState(false)
  const frameProbeAttemptsRef = useRef(0)
  const videoItems = buildScheduledVideoItems(getPromoVideoItems(media))
  const imageItems = getPromoImageItems(media)
  const availableVideoItems = videoItems.filter((item) => !failedVideoUrls.has(item.url))
  const availableImageItems = imageItems.filter((item) => !failedImageUrls.has(item.url))
  const playlistItems = buildPromoPlaylist(availableVideoItems, availableImageItems)
  const currentMedia = playlistItems.length > 0
    ? playlistItems[currentMediaIndex % playlistItems.length]
    : undefined
  const currentVideo = currentMedia?.type === 'video' ? currentMedia.item : undefined
  const currentImage = currentMedia?.type === 'image' ? currentMedia.item : undefined
  const videoUrl = currentVideo?.url
  const imageUrl = currentImage?.url

  useEffect(() => {
    if (videoStallTimeoutRef.current !== null) {
      window.clearTimeout(videoStallTimeoutRef.current)
      videoStallTimeoutRef.current = null
    }

    setCurrentMediaIndex(0)
    setFailedVideoUrls(new Set())
    setFailedImageUrls(new Set())
    setIsPortraitVideo(false)
    setIsPillarboxPortraitVideo(false)
    frameProbeAttemptsRef.current = 0
  }, [getVideoPlaylistKey(videoItems), imageItems.map((item) => item.url).join('|')])

  useEffect(() => {
    if (currentMedia?.type !== 'image' || playlistItems.length <= 1) {
      return
    }

    const timeout = window.setTimeout(() => {
      showNextMedia()
    }, 7_000)

    return () => window.clearTimeout(timeout)
  }, [currentMediaIndex, currentMedia?.item.url, currentMedia?.type, getPromoPlaylistKey(playlistItems)])

  useEffect(() => {
    if (currentMedia?.type !== 'video' || playlistItems.length <= 1 || !videoRef.current) {
      if (videoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(videoAdvanceTimeoutRef.current)
        videoAdvanceTimeoutRef.current = null
      }
      if (videoStallTimeoutRef.current !== null) {
        window.clearTimeout(videoStallTimeoutRef.current)
        videoStallTimeoutRef.current = null
      }
      maxObservedVideoTimeRef.current = 0
      return
    }

    const video = videoRef.current
    const currentVideoUrl = currentMedia.item.url

    const clearScheduledAdvance = () => {
      if (videoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(videoAdvanceTimeoutRef.current)
        videoAdvanceTimeoutRef.current = null
      }
    }

    const clearVideoStallTimeout = () => {
      if (videoStallTimeoutRef.current !== null) {
        window.clearTimeout(videoStallTimeoutRef.current)
        videoStallTimeoutRef.current = null
      }
    }

    const scheduleVideoStallFallback = (delayMs: number) => {
      clearVideoStallTimeout()
      videoStallTimeoutRef.current = window.setTimeout(() => {
        const readyState = video.readyState
        const hasStarted = maxObservedVideoTimeRef.current > 0.15

        if (!hasStarted || readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          markVideoFailed(currentVideoUrl)
        }
      }, delayMs)
    }

    const scheduleAdvance = () => {
      const durationSeconds = video.duration

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        scheduleVideoStallFallback(12_000)
        return
      }

      clearScheduledAdvance()
      videoAdvanceTimeoutRef.current = window.setTimeout(() => {
        showNextMedia()
      }, Math.max(3_000, Math.round(durationSeconds * 1000) + 500))
      scheduleVideoStallFallback(8_000)
    }

    scheduleAdvance()
    maxObservedVideoTimeRef.current = 0
    video.addEventListener('loadeddata', scheduleAdvance)
    video.addEventListener('loadedmetadata', scheduleAdvance)
    video.addEventListener('playing', scheduleAdvance)
    video.addEventListener('timeupdate', scheduleAdvance)
    video.addEventListener('durationchange', scheduleAdvance)
    video.addEventListener('stalled', scheduleAdvance)
    video.addEventListener('waiting', scheduleAdvance)
    video.addEventListener('ended', clearScheduledAdvance)

    return () => {
      clearScheduledAdvance()
      clearVideoStallTimeout()
      video.removeEventListener('loadeddata', scheduleAdvance)
      video.removeEventListener('loadedmetadata', scheduleAdvance)
      video.removeEventListener('playing', scheduleAdvance)
      video.removeEventListener('timeupdate', scheduleAdvance)
      video.removeEventListener('durationchange', scheduleAdvance)
      video.removeEventListener('stalled', scheduleAdvance)
      video.removeEventListener('waiting', scheduleAdvance)
      video.removeEventListener('ended', clearScheduledAdvance)
    }
  }, [currentMediaIndex, currentMedia?.type, currentMedia?.item.url, getPromoPlaylistKey(playlistItems)])

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    const video = videoRef.current
    video.muted = announcementActive || !videoSoundEnabled
    video.volume = announcementActive ? 0 : videoBaseVolume

    const playPromise = video.play()

    if (playPromise) {
      playPromise.catch((error: unknown) => {
        const errorName = error instanceof DOMException
          ? error.name
          : typeof error === 'object' && error && 'name' in error
            ? String(error.name)
            : ''

        // Ignore transient aborts while the same <video> element switches src.
        if (errorName === 'AbortError') {
          return
        }

        if (!announcementActive && videoSoundEnabled) {
          setSoundBlocked(true)
          setVideoSoundEnabled(false)
          video.muted = true
          void video.play().catch(() => undefined)
        }
      })
    }
  }, [announcementActive, currentMediaIndex, videoSoundEnabled, videoUrl])

  function enableVideoSound() {
    const video = videoRef.current

    setVideoSoundEnabled(true)
    setSoundBlocked(false)

    if (!video) {
      return
    }

    video.muted = false
    video.volume = videoBaseVolume
    video.play().catch(() => {
      setSoundBlocked(true)
      setVideoSoundEnabled(false)
      video.muted = true
      void video.play().catch(() => undefined)
    })
  }

  function showNextMedia() {
    if (playlistItems.length <= 1) {
      return
    }

    setCurrentMediaIndex((index) => (index + 1) % playlistItems.length)
  }

  function markVideoFailed(url: string) {
    if (videoAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(videoAdvanceTimeoutRef.current)
      videoAdvanceTimeoutRef.current = null
    }

    setFailedVideoUrls((current) => {
      const next = new Set(current)

      next.add(url)
      return next
    })
    showNextMedia()
  }

  function handleVideoTimeUpdate() {
    const video = videoRef.current

    if (!video || playlistItems.length <= 1) {
      return
    }

    const currentTime = video.currentTime
    if (currentTime > maxObservedVideoTimeRef.current) {
      maxObservedVideoTimeRef.current = currentTime
    }

    if (!isPortraitVideo && !isPillarboxPortraitVideo && frameProbeAttemptsRef.current < 4 && currentTime >= 0.12) {
      frameProbeAttemptsRef.current += 1
      syncVideoOrientation()
    }
  }

  function detectPillarboxPortraitVideo(video: HTMLVideoElement): boolean {
    const canvas = document.createElement('canvas')
    canvas.width = promoVideoFrameProbeSize
    canvas.height = promoVideoFrameProbeSize

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return false
    }

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
    } catch {
      return false
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const sideWidth = Math.max(6, Math.floor(canvas.width * 0.18))
    const centerStart = Math.floor(canvas.width * 0.34)
    const centerEnd = Math.ceil(canvas.width * 0.66)
    let leftTotal = 0
    let rightTotal = 0
    let centerTotal = 0
    let leftCount = 0
    let rightCount = 0
    let centerCount = 0

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const pixelIndex = (y * canvas.width + x) * 4
        const luminance = (
          imageData.data[pixelIndex] * 0.2126 +
          imageData.data[pixelIndex + 1] * 0.7152 +
          imageData.data[pixelIndex + 2] * 0.0722
        )

        if (x < sideWidth) {
          leftTotal += luminance
          leftCount += 1
        } else if (x >= canvas.width - sideWidth) {
          rightTotal += luminance
          rightCount += 1
        } else if (x >= centerStart && x < centerEnd) {
          centerTotal += luminance
          centerCount += 1
        }
      }
    }

    if (leftCount === 0 || rightCount === 0 || centerCount === 0) {
      return false
    }

    const leftAverage = leftTotal / leftCount
    const rightAverage = rightTotal / rightCount
    const centerAverage = centerTotal / centerCount

    return leftAverage < 28 && rightAverage < 28 && centerAverage > 60
  }

  function syncVideoOrientation() {
    const video = videoRef.current

    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return
    }

    const isPortrait = video.videoHeight > video.videoWidth
    setIsPortraitVideo(isPortrait)

    if (isPortrait) {
      setIsPillarboxPortraitVideo(false)
      return
    }

    setIsPillarboxPortraitVideo(detectPillarboxPortraitVideo(video))
  }

  function markImageFailed(url: string) {
    setFailedImageUrls((current) => {
      const next = new Set(current)

      next.add(url)
      return next
    })
    showNextMedia()
  }

  if (videoUrl) {
    return (
      <section className="tv-promo-panel">
        <div className="tv-promo-media-frame">
          <video
            autoPlay
            className={
              isPortraitVideo
                ? 'tv-promo-video-portrait'
                : isPillarboxPortraitVideo
                  ? 'tv-promo-video-pillarbox-portrait'
                  : 'tv-promo-video-landscape'
            }
            loop={playlistItems.length === 1}
            muted={announcementActive || !videoSoundEnabled}
            onEnded={showNextMedia}
            onError={() => markVideoFailed(videoUrl)}
            onLoadedData={() => {
              setFailedVideoUrls(new Set())
              syncVideoOrientation()
            }}
            onLoadedMetadata={syncVideoOrientation}
            onTimeUpdate={handleVideoTimeUpdate}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={videoUrl}
          />
        </div>
        {soundBlocked ? (
          <button className="tv-promo-sound-button" onClick={enableVideoSound} type="button">
            Включить звук видео
          </button>
        ) : null}
      </section>
    )
  }

  if (videoItems.length > 0 && availableVideoItems.length === 0 && imageItems.length === 0) {
    return (
      <section className="tv-promo-panel tv-promo-empty tv-promo-unavailable" role="status">
        <strong>Видео недоступно</strong>
      </section>
    )
  }

  if (imageUrl) {
    return (
      <section className="tv-promo-panel">
        <div className="tv-promo-media-frame">
          <img
            alt=""
            onError={() => markImageFailed(imageUrl)}
            onLoad={() => {
              setFailedImageUrls(new Set())
            }}
            src={imageUrl}
          />
        </div>
      </section>
    )
  }

  if (imageItems.length > 0 && availableImageItems.length === 0) {
    return (
      <section className="tv-promo-panel tv-promo-empty tv-promo-unavailable" role="status">
        <strong>Изображение недоступно</strong>
      </section>
    )
  }

  return (
    <section className="tv-promo-panel tv-promo-empty" aria-hidden="true">
      <strong>SmartQ</strong>
    </section>
  )
})

export function CallBoard({
  labels = getLocale('ru').board,
  liteMode = false,
  marqueeText,
  showMarquee = true,
  promoMedia,
  recentCallsLimit = 10,
  rooms,
  showRecentCalls = true,
  template = 'classic',
  tickets,
  voiceEnabled = true,
  dataReady = true,
}: CallBoardProps) {
  const [highlightedCallKey, setHighlightedCallKey] = useState('')
  const [announcementActive, setAnnouncementActive] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const activeAnnouncementKeyRef = useRef('')
  const knownCallKeysRef = useRef<Set<string>>(new Set())
  const announcementQueueRef = useRef<PendingAnnouncement[]>([])
  const highlightTimeoutRef = useRef<number | null>(null)
  const isAnnouncementPlayingRef = useRef(false)
  const hasRenderedRef = useRef(false)

  const currentCalls = useMemo(
    () => tickets
      .filter(isBoardCallTicket)
      .sort((left, right) => getCallTimestamp(right) - getCallTimestamp(left)),
    [tickets],
  )
  const currentCall = currentCalls[0]
  const currentCallKey = getCallKey(currentCall)
  const currentCallRoom = currentCall ? getTicketRoom(currentCall, rooms) : undefined
  const currentCallRoomName = currentCall ? formatBoardRoomName(currentCallRoom) : ''
  const historyLimit = Math.min(30, Math.max(0, Math.trunc(recentCallsLimit)))
  const historyCalls = currentCall
    ? currentCalls
      .filter((ticket) => getCallKey(ticket) !== currentCallKey)
      .slice(0, historyLimit)
    : []
  const historyVisible = showRecentCalls && historyLimit > 0
  const visibleCalls = currentCall
    ? [currentCall, ...(historyVisible ? historyCalls : [])]
    : []

  async function playBeep() {
    const AudioContextConstructor = window.AudioContext
      ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextConstructor) {
      return
    }

    const audioContext = audioContextRef.current ?? new AudioContextConstructor()
    audioContextRef.current = audioContext

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.001, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.216, audioContext.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.34)

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 380)
    })
  }

  function playNotificationFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const audio = new Audio(notificationAudioPath)
      let settled = false
      let sourceNode: MediaElementAudioSourceNode | null = null

      const finish = (played: boolean) => {
        if (settled) return

        settled = true
        audio.onended = null
        audio.onerror = null
        audio.onabort = null
        sourceNode?.disconnect()
        resolve(played)
      }

      audio.preload = 'auto'
      audio.volume = 1

      const AudioContextConstructor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (AudioContextConstructor) {
        const audioContext = audioContextRef.current ?? new AudioContextConstructor()
        audioContextRef.current = audioContext

        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => undefined)
        }

        const gainNode = audioContext.createGain()

        gainNode.gain.value = announcementVolumeBoost
        sourceNode = audioContext.createMediaElementSource(audio)
        sourceNode.connect(gainNode)
        gainNode.connect(audioContext.destination)
      }

      audio.onended = () => finish(true)
      audio.onerror = () => finish(false)
      audio.onabort = () => finish(false)
      audio.play().catch(() => finish(false))
    })
  }

  async function playNotificationSound(): Promise<void> {
    const played = await playNotificationFile()

    if (!played) {
      await playBeep().catch(() => undefined)
    }
  }

  function clearHighlightTimeout() {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }
  }

  function highlightCall(ticket: Ticket) {
    clearHighlightTimeout()
    setHighlightedCallKey(getCallKey(ticket))
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedCallKey(''), 2_000)
  }

  function processNextAnnouncement() {
    if (isAnnouncementPlayingRef.current) {
      return
    }

    const nextAnnouncement = announcementQueueRef.current.shift()

    if (!nextAnnouncement) {
      return
    }

    isAnnouncementPlayingRef.current = true
    setAnnouncementActive(true)
    highlightCall(nextAnnouncement.ticket)
    const playAnnouncement = nextAnnouncement.mode === 'voice'
      ? announceCall(nextAnnouncement.ticket, nextAnnouncement.room, nextAnnouncement.key)
      : playNotificationAnnouncement(nextAnnouncement.key)

    void playAnnouncement.catch(() => {
      finishAnnouncement(nextAnnouncement.key)
    })
  }

  function enqueueAnnouncement(announcement: PendingAnnouncement) {
    const alreadyQueued = announcementQueueRef.current.some((item) => item.key === announcement.key)

    if (alreadyQueued || activeAnnouncementKeyRef.current === announcement.key) {
      return
    }

    announcementQueueRef.current.push(announcement)
    processNextAnnouncement()
  }

  function finishAnnouncement(announcementKey: string) {
    if (activeAnnouncementKeyRef.current === announcementKey) {
      activeAnnouncementKeyRef.current = ''
    }
    isAnnouncementPlayingRef.current = false
    setAnnouncementActive(false)
    processNextAnnouncement()
  }

  async function playNotificationAnnouncement(announcementKey: string) {
    activeAnnouncementKeyRef.current = announcementKey
    await playNotificationSound()
    finishAnnouncement(announcementKey)
  }

  async function announceCall(ticket: Ticket, room?: TicketRoom, announcementKey = getCallAnnouncementKey(ticket)) {
    activeAnnouncementKeyRef.current = announcementKey
    const voiceSettings = voiceSettingsService.getSettings()
    const announcementLanguage = ticket.language

    if (announcementLanguage === 'en') {
      const audioSequence = buildEnglishCallAudioSequence(ticket, room, voiceSettings)
      await playEnglishAudioSequence(audioSequence)
    } else if (announcementLanguage === 'kk') {
      const audioSequence = buildKazakhCallAudioSequence(ticket, room, voiceSettings)
      await playKazakhAudioSequence(audioSequence)
    } else {
      const audioSequence = buildRussianCallAudioSequence(ticket, room, voiceSettings)
      await playRussianAudioSequence(audioSequence)
    }

    finishAnnouncement(announcementKey)
  }

  useEffect(() => () => {
    announcementQueueRef.current = []
    isAnnouncementPlayingRef.current = false
    clearHighlightTimeout()
  }, [])

  useEffect(() => {
    const callsWithCalledAt = currentCalls.filter((ticket) => Boolean(ticket.calledAt))

    if (!dataReady) {
      hasRenderedRef.current = false
      knownCallKeysRef.current = new Set()
      announcementQueueRef.current = []
      activeAnnouncementKeyRef.current = ''
      isAnnouncementPlayingRef.current = false
      setAnnouncementActive(false)
      clearHighlightTimeout()
      setHighlightedCallKey('')
      return
    }

    if (!hasRenderedRef.current) {
      callsWithCalledAt.forEach((ticket) => {
        const announcementKey = getCallAnnouncementKey(ticket)

        if (announcementKey) {
          knownCallKeysRef.current.add(announcementKey)
        }
      })
      hasRenderedRef.current = true
      return
    }

    if (callsWithCalledAt.length === 0) {
      return
    }

    callsWithCalledAt
      .filter((ticket) => {
        const announcementKey = getCallAnnouncementKey(ticket)

        return Boolean(announcementKey && !knownCallKeysRef.current.has(announcementKey))
      })
      .sort((left, right) => getCallTimestamp(left) - getCallTimestamp(right))
      .forEach((ticket) => {
        const announcementKey = getCallAnnouncementKey(ticket)

        if (!announcementKey) {
          return
        }

        knownCallKeysRef.current.add(announcementKey)
        enqueueAnnouncement({
          key: announcementKey,
          mode: voiceEnabled ? 'voice' : 'notification',
          room: getTicketRoom(ticket, rooms),
          ticket,
        })
      })
  }, [currentCalls, dataReady, rooms, voiceEnabled])

  const currentCallPlaceValue = currentCall ? getRoomDisplayValue(currentCallRoom) : ''
  const currentCallPlaceLabel = currentCall ? getRoomPlaceLabel() : ''
  const currentCallHighlightClass = currentCall && highlightedCallKey === currentCallKey ? 'tv-call-animated' : ''
  const cardCalls = currentCall
    ? [
      currentCall,
      ...(historyVisible ? historyCalls : []),
    ]
    : visibleCalls

  if (template === 'video_queue') {
    return (
      <div className={`tv-video-layout ${historyVisible ? '' : 'tv-video-layout-no-history'}`}>
        <section
          className={`tv-video-current ${currentCallHighlightClass}`}
        >
          {currentCall ? (
            <>
              <div className="tv-route-call">
                <div className="tv-route-ticket">
                  <strong>{currentCall.number}</strong>
                </div>
                <span aria-hidden="true">→</span>
                <div className="tv-route-center">
                  <span aria-hidden="true">→</span>
                  <div className="tv-route-place-label">{currentCallPlaceLabel}</div>
                </div>
                <div className="tv-route-place">
                  <strong>{currentCallPlaceValue}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="tv-empty-call">
              <BoardMultilingualLabel labelKey="waiting" />
            </div>
          )}
        </section>

        {historyVisible ? (
          <section className="tv-video-history">
            <span className="tv-video-section-title">Последние вызовы</span>
            <HistoryCallsTable
              highlightedCallKey={highlightedCallKey}
              labels={labels}
              recentCalls={historyCalls}
              rooms={rooms}
            />
          </section>
        ) : null}

        <PromoMediaPanel
          announcementActive={announcementActive}
          media={promoMedia}
        />

        {showMarquee ? <BoardMarqueeSequential liteMode={liteMode} text={marqueeText} /> : null}
      </div>
    )
  }

  if (template === 'big_board') {
    return (
      <div className="tv-big-board">
        <section
          className={`tv-big-current ${currentCallHighlightClass}`}
        >
          {currentCall ? (
            <>
              <div className="tv-big-route">
                <div className="tv-big-route-ticket">
                  <strong>{currentCall.number}</strong>
                </div>
                <span aria-hidden="true">→</span>
                <div className="tv-big-route-center">
                  <span aria-hidden="true">→</span>
                  <div className="tv-big-place">{currentCallPlaceLabel}</div>
                </div>
                <div className="tv-big-route-place">
                  <strong>{currentCallPlaceValue}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="tv-empty-call">
              <BoardMultilingualLabel labelKey="waiting" />
            </div>
          )}
        </section>

        {historyVisible ? (
          <section className="tv-big-history">
            <HistoryCallsTable
              highlightedCallKey={highlightedCallKey}
              labels={labels}
              recentCalls={historyCalls}
              rooms={rooms}
            />
          </section>
        ) : null}
      </div>
    )
  }

  if (template === 'minimal') {
    return (
      <div className="tv-layout tv-layout-minimal">
        {currentCall ? (
          <article
            className={`tv-call-card tv-call-featured ${highlightedCallKey === currentCallKey ? 'tv-call-animated' : ''}`}
          >
            <strong>{currentCall.number}</strong>
            <span>{currentCallRoomName}</span>
          </article>
        ) : (
          <div className="tv-empty-call">
            <BoardMultilingualLabel labelKey="waiting" />
          </div>
        )}
      </div>
    )
  }

  if (template === 'grid') {
    return (
      <div className="tv-layout tv-layout-grid">
        {visibleCalls.length > 0 ? visibleCalls.map((ticket) => (
          <article
            className={`tv-call-card ${highlightedCallKey === getCallKey(ticket) ? 'tv-call-animated' : ''}`}
            key={ticket.id}
          >
            <strong>{ticket.number}</strong>
            <span>{getRoomName(ticket, rooms)}</span>
          </article>
        )) : (
          <div className="tv-empty-call">
            <BoardMultilingualLabel labelKey="waiting" />
          </div>
        )}
      </div>
    )
  }

  if (template === 'cards') {
    return (
      <div className="tv-layout tv-layout-cards">
        {cardCalls.length > 0 ? cardCalls.map((ticket, index) => (
          <article
            className={`tv-call-card ${index === 0 ? 'tv-call-featured' : ''} ${highlightedCallKey === getCallKey(ticket) ? 'tv-call-animated' : ''}`}
            key={ticket.id}
          >
            <strong>{ticket.number}</strong>
            <span>{getRoomName(ticket, rooms)}</span>
          </article>
        )) : (
          <div className="tv-empty-call">
            <BoardMultilingualLabel labelKey="waiting" />
          </div>
        )}
      </div>
    )
  }

  if (template === 'list') {
    return (
      <section className="tv-layout tv-layout-list">
        {visibleCalls.length > 0 ? visibleCalls.map((ticket) => (
          <div
            className={`tv-list-row ${highlightedCallKey === getCallKey(ticket) ? 'tv-call-animated' : ''}`}
            key={ticket.id}
          >
            <strong>{ticket.number}</strong>
            <span>{getRoomName(ticket, rooms)}</span>
            {ticket.status === 'no_show' ? <em>{labels.noShow}</em> : null}
          </div>
        )) : (
          <div className="tv-empty-recent">
            <BoardMultilingualLabel labelKey="waiting" />
          </div>
        )}
      </section>
    )
  }

  return (
    <div className={`tv-grid ${historyVisible ? '' : 'tv-grid-single'}`}>
      {historyVisible ? (
        <ClassicHistoryPanel
          highlightedCallKey={highlightedCallKey}
          historyLimit={historyLimit}
          recentCalls={historyCalls}
          rooms={rooms}
        />
      ) : null}

      <section className="tv-current">
        <div className="tv-section-heading">
          <span className="tv-section-label">
            <BoardMultilingualLabel labelKey="currentCall" />
          </span>
        </div>
        {currentCall ? (
          <article
            className={`tv-call-card tv-call-featured ${highlightedCallKey === currentCallKey ? 'tv-call-animated' : ''}`}
          >
            <strong>{currentCall.number}</strong>
            <span>{currentCallRoomName}</span>
          </article>
        ) : (
          <div className="tv-empty-call">
            <BoardMultilingualLabel labelKey="waiting" />
          </div>
        )}
      </section>
    </div>
  )
}
