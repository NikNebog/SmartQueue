import type { ServicePlaceType } from '@shared/types'
import { getLocale } from '@shared/locales/useLocale'

type RoomNameSource = {
  id?: string | number | null
  name?: string | number | null
  number?: string | number | null
  placeType?: ServicePlaceType | string | null
  place_type?: ServicePlaceType | string | null
  roomId?: string | number | null
  roomName?: string | number | null
  title?: string | number | null
}

type PlaceMeta = {
  lowerLabel: string
  preposition: string
  type: ServicePlaceType
}

const defaultPlaceType: ServicePlaceType = 'room'
const roomNumberBody = String.raw`\d+[A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]?`
const roomNumberPattern = new RegExp(`^${roomNumberBody}$`)
const roomNumberPartPattern = new RegExp(roomNumberBody)

const placeTypeMeta: Record<ServicePlaceType, PlaceMeta> = {
  desk: {
    lowerLabel: 'столу',
    preposition: 'к',
    type: 'desk',
  },
  room: {
    lowerLabel: 'кабинет',
    preposition: 'в',
    type: 'room',
  },
  window: {
    lowerLabel: 'окну',
    preposition: 'к',
    type: 'window',
  },
}

function normalizeRoomText(value?: string | number | null): string {
  return value == null ? '' : String(value).trim()
}

export function normalizeRoomLookupValue(value?: string | number | null): string {
  return normalizeRoomText(value).replace(/\s+/g, '').toLocaleLowerCase('ru-RU')
}

export function isValidRoomNumber(value?: string | number | null): boolean {
  const text = normalizeRoomText(value).replace(/\s+/g, '')

  return roomNumberPattern.test(text)
}

function normalizePlaceType(value?: ServicePlaceType | string | null): ServicePlaceType | undefined {
  const text = normalizeRoomText(value).toLowerCase()

  if (text === 'window' || text === 'окно') return 'window'
  if (text === 'desk' || text === 'стол') return 'desk'
  if (text === 'room' || text === 'cabinet' || text === 'кабинет') return 'room'

  return undefined
}

function inferPlaceTypeFromText(value?: string | number | null): ServicePlaceType | undefined {
  const text = normalizeRoomText(value).toLowerCase()

  if (/^окно\b/.test(text)) return 'window'
  if (/^стол\b/.test(text)) return 'desk'
  if (/^кабинет\b/.test(text)) return 'room'

  return undefined
}

function hasPlaceLabel(value: string): boolean {
  return /^(кабинет|окно|стол|терезе|үстел|room|window|desk)\b/i.test(value)
}

function extractRoomNumber(value?: string | number | null): string {
  const text = normalizeRoomText(value)
  const match = text.match(roomNumberPartPattern)

  return match?.[0] ?? ''
}

export function roomMatchesIdentifier(room: RoomNameSource | null | undefined, identifier?: string | number | null): boolean {
  const target = normalizeRoomLookupValue(identifier)

  if (!room || !target) {
    return false
  }

  const lookupValues = [
    room.id,
    room.roomId,
    room.number,
    room.name,
    room.title,
    room.roomName,
    getRoomPlaceNumber(room),
    getRoomBoardId(room),
    extractRoomNumber(room.name),
    extractRoomNumber(room.title),
    extractRoomNumber(room.roomName),
  ]

  return lookupValues.some((value) => normalizeRoomLookupValue(value) === target)
}

export function getRoomPlaceType(room?: RoomNameSource | null): ServicePlaceType {
  if (!room) {
    return defaultPlaceType
  }

  return normalizePlaceType(room.placeType ?? room.place_type)
    ?? inferPlaceTypeFromText(room.name)
    ?? inferPlaceTypeFromText(room.roomName)
    ?? inferPlaceTypeFromText(room.title)
    ?? defaultPlaceType
}

export function getRoomPlaceNumber(room?: RoomNameSource | null): string {
  if (!room) {
    return ''
  }

  const rawNumber = normalizeRoomText(room.number)
  const number = rawNumber
    ? isValidRoomNumber(rawNumber) ? rawNumber.replace(/\s+/g, '') : extractRoomNumber(rawNumber) || rawNumber
    : ''

  return number
    || extractRoomNumber(room.name)
    || extractRoomNumber(room.title)
    || extractRoomNumber(room.roomName)
    || ''
}

export function getRoomBoardId(room?: RoomNameSource | null): string {
  if (!room) {
    return ''
  }

  const number = getRoomPlaceNumber(room)

  if (number) {
    return number
  }

  const namedId = extractRoomNumber(room.name)
    || extractRoomNumber(room.title)
    || extractRoomNumber(room.roomName)

  if (namedId) {
    return namedId
  }

  return normalizeRoomText(room.id)
}

export function formatRoomName(room?: RoomNameSource | null): string {
  if (!room) {
    return 'Кабинет не назначен'
  }

  const placeType = getRoomPlaceType(room)
  const placeLabel = getRoomPlaceTypeLabel(placeType)
  const placeNumber = getRoomPlaceNumber(room)
  const rawName = normalizeRoomText(room.name)
    || normalizeRoomText(room.roomName)
    || normalizeRoomText(room.title)
    || normalizeRoomText(room.number)

  if (placeNumber) {
    return `${placeLabel} ${placeNumber}`
  }

  if (rawName) {
    return hasPlaceLabel(rawName)
      ? rawName
      : isValidRoomNumber(rawName)
        ? `${placeLabel} ${rawName}`
        : rawName
  }

  const roomId = normalizeRoomText(room.roomId) || normalizeRoomText(room.id)

  return roomId ? `${placeLabel} ${roomId}` : 'Кабинет не назначен'
}

export function formatRoomVoiceTarget(room?: RoomNameSource | null): string {
  const placeType = getRoomPlaceType(room)
  const meta = placeTypeMeta[placeType]
  const placeNumber = getRoomPlaceNumber(room)
  const roomId = normalizeRoomText(room?.roomId) || normalizeRoomText(room?.id)
  const targetNumber = placeNumber || roomId

  return targetNumber
    ? `${meta.preposition} ${meta.lowerLabel} ${targetNumber}`
    : `${meta.preposition} ${meta.lowerLabel}`
}

export function getRoomClosedLabel(room?: RoomNameSource | null): string {
  const placeTypes = getLocale().placeTypes
  const placeType = getRoomPlaceType(room)

  if (placeType === 'window') return placeTypes.windowClosed
  if (placeType === 'desk') return placeTypes.deskClosed

  return placeTypes.roomClosed
}

export function getRoomPlaceTypeLabel(placeType: ServicePlaceType | string): string {
  const normalizedPlaceType = normalizePlaceType(placeType) ?? defaultPlaceType
  const placeTypes = getLocale().placeTypes

  if (normalizedPlaceType === 'window') return placeTypes.window
  if (normalizedPlaceType === 'desk') return placeTypes.desk

  return placeTypes.room
}
