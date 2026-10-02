import { isAxiosError } from 'axios'
import type { Role, ServiceType, User } from '@shared/types'
import { apiClient } from '../client'
import { fallbackServiceTypeOptions } from '../serviceTypeCatalog'
import { normalizeBoardPromoMediaStorage } from '../../boardPromoMediaService'
import { normalizeBoardStyleSettings, type BoardStyleSettings } from '../../boardStyleSettingsService'
import type {
  AdminApi,
  AdminTerminalInput,
  AdminTerminalRecord,
  BoardSettings,
  AdminRecord,
  AdminRecordInput,
  AdminServiceTypeInput,
  AdminUserInput,
  TicketSettingsServiceTypeOption,
} from '../types'

type UnknownRecord = Record<string, unknown>

type BackendUser = Partial<User> & {
  assignedRoom?: UnknownRecord | null
  assignedRoomId?: string | number | null
  assignedRoomIds?: Array<string | number> | null
  assignedRooms?: UnknownRecord[] | null
  canManageTicketIssue?: boolean
  email?: string
  firstName?: string
  fullName?: string
  id?: string | number
  lastName?: string
  room?: UnknownRecord | null
  roomId?: string | number | null
  roomIds?: Array<string | number> | null
  rooms?: UnknownRecord[] | null
  username?: string
  _id?: string | number
}

type BackendUserResponse = BackendUser & {
  access_token?: string
  accessToken?: string
  token?: string
  user?: BackendUser
}

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

const serviceCodeByBackendName: Record<string, ServiceType> = {
  analysis: 'laboratory',
  billing: 'billing',
  consultation: 'consultation',
  diagnostics: 'diagnostics',
  laboratory: 'laboratory',
  other: 'registration',
  payment: 'billing',
  pharmacy: 'pharmacy',
  registration: 'registration',
  xray: 'diagnostics',
  'Р В°Р Р…Р В°Р В»Р С‘Р В·РЎвЂ№': 'laboratory',
  'Р В°Р С—РЎвЂљР ВµР С”Р В°': 'pharmacy',
  'Р Р†Р В°Р С”РЎвЂ Р С‘Р Р…Р В°РЎвЂ Р С‘РЎРЏ': 'consultation',
  'Р В·Р В°Р В±Р С•РЎР‚ Р С”РЎР‚Р С•Р Р†Р С‘': 'laboratory',
  'Р Т‘Р С‘Р В°Р С–Р Р…Р С•РЎРѓРЎвЂљР С‘Р С”Р В°': 'diagnostics',
  'Р Т‘РЎР‚РЎС“Р С–Р С•Р Вµ': 'registration',
  'Р С”Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ Р С”Р В°РЎР‚Р Т‘Р С‘Р С•Р В»Р С•Р С–Р В°': 'consultation',
  'Р С”Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ Р Р…Р ВµР Р†РЎР‚Р С•Р В»Р С•Р С–Р В°': 'consultation',
  'Р С”Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ Р С—Р ВµР Т‘Р С‘Р В°РЎвЂљРЎР‚Р В°': 'consultation',
  'Р С”Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ РЎвЂљР ВµРЎР‚Р В°Р С—Р ВµР Р†РЎвЂљР В°': 'consultation',
  'Р С”Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ РЎвЂ¦Р С‘РЎР‚РЎС“РЎР‚Р С–Р В°': 'consultation',
  'Р С”Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ': 'consultation',
  'Р С”РЎвЂљ': 'diagnostics',
  'Р В»Р В°Р В±Р С•РЎР‚Р В°РЎвЂљР С•РЎР‚Р С‘РЎРЏ': 'laboratory',
  'Р В»Р В°Р В±Р С•РЎР‚Р В°РЎвЂљР С•РЎР‚Р Р…РЎвЂ№Р Вµ Р В°Р Р…Р В°Р В»Р С‘Р В·РЎвЂ№': 'laboratory',
  'Р СРЎР‚РЎвЂљ': 'diagnostics',
  'Р С•Р С—Р В»Р В°РЎвЂљР В°': 'billing',
  'Р С•Р С—Р В»Р В°РЎвЂљР В° РЎС“РЎРѓР В»РЎС“Р С–': 'billing',
  'Р С—Р С•Р В»РЎС“РЎвЂЎР ВµР Р…Р С‘Р Вµ РЎРѓР С—РЎР‚Р В°Р Р†Р С”Р С‘': 'registration',
  'Р С—РЎР‚Р С‘РЎвЂР С Р Т‘Р С•Р С”РЎС“Р СР ВµР Р…РЎвЂљР С•Р Р†': 'registration',
  'Р С—РЎР‚Р С•РЎвЂ Р ВµР Т‘РЎС“РЎР‚Р Р…РЎвЂ№Р в„– Р С”Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљ': 'consultation',
  'РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ': 'registration',
  'РЎР‚Р ВµР Р…РЎвЂљР С–Р ВµР Р…': 'diagnostics',
  'РЎС“Р В·Р С‘': 'diagnostics',
  'РЎРЊР С”Р С–': 'diagnostics',
}

const serviceLabelByCode: Record<ServiceType, string> = {
  billing: 'Р С›Р С—Р В»Р В°РЎвЂљР В°',
  consultation: 'Р С™Р С•Р Р…РЎРѓРЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂ Р С‘РЎРЏ',
  diagnostics: 'Р В Р ВµР Р…РЎвЂљР С–Р ВµР Р…',
  laboratory: 'Р С’Р Р…Р В°Р В»Р С‘Р В·РЎвЂ№',
  pharmacy: 'Р вЂќРЎР‚РЎС“Р С–Р С•Р Вµ',
  registration: 'Р вЂќРЎР‚РЎС“Р С–Р С•Р Вµ',
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()

    return trimmed || undefined
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return undefined
}

function getId(value: UnknownRecord): string | number {
  const rawId = value.id ?? value.roomId ?? value._id ?? value.uuid

  return typeof rawId === 'string' || typeof rawId === 'number'
    ? rawId
    : `record-${Math.random().toString(36).slice(2, 8)}`
}

function getAvatarInitials(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'SQ'
}

function normalizeIdValue(value: string | number): string | number {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && String(value).trim() !== '' ? numberValue : value
}

function normalizeIdList(values?: Array<string | number>): Array<string | number> {
  return (values ?? []).map(normalizeIdValue)
}

function toArray(value: unknown, keys: string[] = []): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }

  if (!isRecord(value)) {
    return []
  }

  for (const key of keys) {
    const nested = value[key]

    if (Array.isArray(nested)) {
      return nested.filter(isRecord)
    }
  }

  if (Array.isArray(value.data)) {
    return value.data.filter(isRecord)
  }

  if (isRecord(value.data)) {
    return toArray(value.data, keys)
  }

  if (Array.isArray(value.items)) {
    return value.items.filter(isRecord)
  }

  return []
}

function isRole(value: unknown): value is Role {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()

  return normalized === 'admin' || normalized === 'manager' || normalized === 'specialist'
}

function toRole(value: unknown, fallbackRole: Role = 'specialist'): Role {
  if (!isRole(value)) {
    return fallbackRole
  }

  return value.trim().toLowerCase() as Role
}

function toServiceCode(option: UnknownRecord): ServiceType {
  const rawCode = getText(option.code)
    ?? getText(option.name)
    ?? getText(option.title)
    ?? getText(option.value)
    ?? ''
  const normalized = rawCode.trim().toLowerCase()

  return serviceCodeByBackendName[normalized] ?? 'consultation'
}

function toServiceTypeOption(option: UnknownRecord): TicketSettingsServiceTypeOption {
  const code = toServiceCode(option)
  const translations = {
    ...(option.translations && typeof option.translations === 'object'
      ? option.translations as TicketSettingsServiceTypeOption['translations']
      : {}),
    ...(getText(option.nameKk ?? option.name_kk) ? { kk: getText(option.nameKk ?? option.name_kk) } : {}),
    ...(getText(option.nameEn ?? option.name_en) ? { en: getText(option.nameEn ?? option.name_en) } : {}),
  }
  const averageDurationMinutes = getPositiveNumber(
    option.averageDurationMinutes
      ?? option.average_duration_minutes
      ?? option.avgServiceMinutes
      ?? option.avg_service_minutes
      ?? option.durationMinutes
      ?? option.duration_minutes,
  )
  const priorityWeight = getPositiveNumber(
    option.priorityWeight
      ?? option.priority_weight
      ?? option.weight,
  )
  const active = typeof option.active === 'boolean'
    ? option.active
    : typeof option.isActive === 'boolean'
      ? option.isActive
      : typeof option.enabled === 'boolean'
        ? option.enabled
        : undefined

  return {
    ...(active === undefined ? {} : { active }),
    ...(averageDurationMinutes === undefined ? {} : { averageDurationMinutes }),
    code,
    id: getId(option),
    name: getText(option.name)
      ?? getText(option.title)
      ?? getText(option.label)
      ?? getText(option.code)
      ?? serviceLabelByCode[code],
    ...(priorityWeight === undefined ? {} : { priorityWeight }),
    ...(getText(option.ticketPrefix ?? option.ticket_prefix) ? { ticketPrefix: getText(option.ticketPrefix ?? option.ticket_prefix) } : {}),
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
  }
}

function getServiceTypeRecord(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ['serviceType', 'service_type', 'data', 'item', 'record']) {
    const nested = value[key]

    if (isRecord(nested)) {
      return nested
    }
  }

  return value
}

function toServiceTypeResponseOption(
  value: unknown,
  fallback: Partial<TicketSettingsServiceTypeOption> & Partial<AdminServiceTypeInput>,
): TicketSettingsServiceTypeOption {
  return toServiceTypeOption({
    ...fallback,
    ...(getServiceTypeRecord(value) ?? {}),
  })
}

function getPositiveNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined
}

function toServiceTypePayload(input: Partial<AdminServiceTypeInput>) {
  const kk = input.translations?.kk?.trim()
  const en = input.translations?.en?.trim()
  const ticketPrefix = input.ticketPrefix?.trim().toUpperCase()

  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.ticketPrefix !== undefined ? { ticketPrefix } : {}),
    ...(input.translations !== undefined ? {
      nameKk: kk || null,
      nameEn: en || null,
      translations: {
        ...(kk ? { kk } : {}),
        ...(en ? { en } : {}),
      },
    } : {}),
    ...(input.averageDurationMinutes !== undefined
      ? { averageDurationMinutes: Math.max(1, Math.round(input.averageDurationMinutes)) }
      : {}),
    ...(input.priorityWeight !== undefined
      ? { priorityWeight: Math.max(0, Math.round(input.priorityWeight)) }
      : {}),
    ...(input.active === undefined ? {} : { active: input.active, isActive: input.active }),
  }
}

function getServiceTypeIds(record: UnknownRecord): Array<string | number> {
  const singleServiceTypeId = record.serviceTypeId ?? record.service_type_id

  if (typeof singleServiceTypeId === 'string' || typeof singleServiceTypeId === 'number') {
    return [singleServiceTypeId]
  }

  const rawServiceTypeIds = record.serviceTypeIds
    ?? record.serviceIds
    ?? record.servicesIds

  if (Array.isArray(rawServiceTypeIds)) {
    return rawServiceTypeIds
      .map((item) => typeof item === 'string' || typeof item === 'number' ? item : undefined)
      .filter((item): item is string | number => item !== undefined)
  }

  const rawServices = record.serviceTypes ?? record.services

  if (!Array.isArray(rawServices)) {
    return []
  }

  return rawServices
    .map((service) => {
      if (typeof service === 'string' || typeof service === 'number') {
        return service
      }

      if (isRecord(service)) {
        const id = service.id ?? service._id ?? service.serviceTypeId ?? service.name ?? service.title

        return typeof id === 'string' || typeof id === 'number' ? id : undefined
      }

      return undefined
    })
    .filter((item): item is string | number => item !== undefined)
}

function toRoomRecord(record: UnknownRecord): AdminRecord {
  const name = getText(record.name)
    ?? getText(record.title)
    ?? getText(record.roomName)
    ?? 'Р С™Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљ Р В±Р ВµР В· Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘РЎРЏ'
  const isActive = typeof record.isActive === 'boolean'
    ? record.isActive
    : typeof record.active === 'boolean'
      ? record.active
      : record.status !== 'paused' && record.status !== 'inactive' && record.status !== 'deleted'
  const serviceTypeIds = getServiceTypeIds(record)
  const workEndTime = getText(record.workEndTime ?? record.workingEndTime ?? record.work_end_time)
  const workStartTime = getText(record.workStartTime ?? record.workingStartTime ?? record.work_start_time)
  const estimatedWaitMinutes = typeof record.estimatedWaitMinutes === 'number'
    ? record.estimatedWaitMinutes
    : typeof record.estimatedWaitMinutes === 'string' && record.estimatedWaitMinutes.trim() !== ''
      ? Number(record.estimatedWaitMinutes)
      : undefined
  const ticketIssueEnabled = typeof record.ticketIssueEnabled === 'boolean'
    ? record.ticketIssueEnabled
    : typeof record.isTicketIssueEnabled === 'boolean'
      ? record.isTicketIssueEnabled
      : typeof record.kioskEnabled === 'boolean'
        ? record.kioskEnabled
        : undefined

  return {
    ...record,
    active: isActive,
    id: getId(record),
    isActive,
    ...(ticketIssueEnabled === undefined ? {} : { ticketIssueEnabled, isTicketIssueEnabled: ticketIssueEnabled }),
    name,
    ...(getText(record.number) ? { number: getText(record.number) } : {}),
    ...(getText(record.placeType ?? record.place_type) ? { placeType: getText(record.placeType ?? record.place_type) } : {}),
    ...(estimatedWaitMinutes !== undefined && Number.isFinite(estimatedWaitMinutes)
      ? { estimatedWaitMinutes: Math.max(0, Math.round(estimatedWaitMinutes)) }
      : {}),
    serviceTypeIds,
    ...(workEndTime ? { workEndTime } : {}),
    ...(workStartTime ? { workStartTime } : {}),
    ...(workEndTime ? { workingEndTime: workEndTime } : {}),
    ...(workStartTime ? { workingStartTime: workStartTime } : {}),
  }
}

function normalizeRecordIdList(values: unknown): Array<string | number> {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((value) => {
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number' && Number.isFinite(value)) return value
      return undefined
    })
    .filter((value): value is string | number => value !== undefined)
}

function toTerminalRecord(record: UnknownRecord): AdminTerminalRecord {
  return {
    active: typeof record.active === 'boolean' ? record.active : record.isActive !== false,
    id: getId(record),
    location: getText(record.location ?? record.place ?? record.installationPlace) ?? '',
    name: getText(record.name ?? record.title) ?? 'Р СћР ВµРЎР‚Р СР С‘Р Р…Р В°Р В»',
    roomIds: normalizeRecordIdList(record.roomIds ?? record.rooms),
    serviceTypeIds: normalizeRecordIdList(record.serviceTypeIds ?? record.services ?? record.serviceTypes),
  }
}

function toTerminalPayload(input: AdminTerminalInput | Partial<AdminTerminalInput>) {
  return {
    active: input.active ?? true,
    isActive: input.active ?? true,
    location: input.location ?? '',
    name: input.name ?? '',
    roomIds: normalizeIdList(input.roomIds),
    serviceTypeIds: normalizeIdList(input.serviceTypeIds),
  }
}

function normalizeBoardTemplate(value: unknown): BoardSettings['template'] {
  return value === 'grid'
    || value === 'list'
    || value === 'minimal'
    || value === 'cards'
    || value === 'video_queue'
    || value === 'big_board'
    ? value
    : 'classic'
}

function normalizeRecentCallsLimit(value: unknown): BoardSettings['recentCallsLimit'] {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? Math.min(30, Math.max(0, Math.trunc(numericValue)))
    : 10
}

function normalizeMarqueeSizePercent(value: unknown): number {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
      ? Math.min(300, Math.max(60, Math.round(numericValue)))
      : 100
}

function normalizeMarqueeOffsetPx(value: unknown): number {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? Math.min(200, Math.max(-200, Math.round(numericValue)))
    : 0
}

function toBoardSettings(value: unknown): BoardSettings {
  const record = isRecord(value) ? value : {}
  const promoMediaByProfileId = normalizeBoardPromoMediaStorage(record.promoMediaByProfileId)
  const styleSettings = isRecord(record.styleSettings)
    ? Object.fromEntries(
      Object.entries(record.styleSettings)
        .filter(([, settings]) => isRecord(settings))
        .map(([profileId, settings]) => [
          profileId,
          normalizeBoardStyleSettings(settings as Partial<BoardStyleSettings>),
        ]),
    )
    : {}
  const screens = Array.isArray(record.screens)
    ? record.screens.filter(isRecord).map((screen) => ({
        id: getText(screen.id) ?? `screen-${Math.random().toString(36).slice(2, 8)}`,
        name: getText(screen.name) ?? 'Р В­Р С”РЎР‚Р В°Р Р…',
        roomIds: normalizeRecordIdList(screen.roomIds).map(String),
        roomNames: normalizeRecordIdList(screen.roomNames).map(String),
      }))
    : []
  const profiles = Array.isArray(record.profiles)
    ? record.profiles.filter(isRecord).map((profile) => ({
        boardType: (profile.boardType === 'individual' ? 'individual' : 'general') as BoardSettings['boardType'],
        id: getText(profile.id) ?? `${profile.boardType === 'individual' ? 'individual' : 'general'}-${getText(profile.roomBoardId) ?? 'general'}`,
        liteMode: typeof profile.liteMode === 'boolean' ? profile.liteMode : false,
        marqueeOffsetPx: normalizeMarqueeOffsetPx(profile.marqueeOffsetPx),
        marqueeSizePercent: normalizeMarqueeSizePercent(profile.marqueeSizePercent),
        marqueeText: getText(profile.marqueeText) ?? '',
        showMarquee: typeof profile.showMarquee === 'boolean' ? profile.showMarquee : true,
        name: getText(profile.name) ?? (profile.boardType === 'individual' ? 'Р ВР Р…Р Т‘Р С‘Р Р†Р С‘Р Т‘РЎС“Р В°Р В»РЎРЉР Р…Р С•Р Вµ РЎвЂљР В°Р В±Р В»Р С•' : 'Р С›Р В±РЎвЂ°Р ВµР Вµ РЎвЂљР В°Р В±Р В»Р С•'),
        recentCallsLimit: normalizeRecentCallsLimit(profile.recentCallsLimit),
        roomBoardId: getText(profile.roomBoardId),
        roomIds: normalizeRecordIdList(profile.roomIds).map(String),
        showRecentCalls: typeof profile.showRecentCalls === 'boolean' ? profile.showRecentCalls : true,
        showTime: typeof profile.showTime === 'boolean' ? profile.showTime : true,
        template: normalizeBoardTemplate(profile.template),
        voiceEnabled: typeof profile.voiceEnabled === 'boolean' ? profile.voiceEnabled : true,
      }))
    : []

  return {
    boardType: record.boardType === 'individual' ? 'individual' : 'general',
    liteMode: typeof record.liteMode === 'boolean' ? record.liteMode : false,
    marqueeOffsetPx: normalizeMarqueeOffsetPx(record.marqueeOffsetPx),
    marqueeSizePercent: normalizeMarqueeSizePercent(record.marqueeSizePercent),
    marqueeText: getText(record.marqueeText) ?? '',
    promoMediaByProfileId,
    showMarquee: typeof record.showMarquee === 'boolean' ? record.showMarquee : true,
    profiles,
    recentCallsLimit: normalizeRecentCallsLimit(record.recentCallsLimit),
    roomBoardId: getText(record.roomBoardId),
    roomIds: normalizeRecordIdList(record.roomIds).map(String),
    screens,
    showRecentCalls: typeof record.showRecentCalls === 'boolean' ? record.showRecentCalls : true,
    showTime: typeof record.showTime === 'boolean' ? record.showTime : true,
    styleSettings,
    template: normalizeBoardTemplate(record.template),
    voiceEnabled: typeof record.voiceEnabled === 'boolean' ? record.voiceEnabled : true,
  }
}

function getRoomId(user: BackendUser): string | undefined {
  return getRoomIds(user)[0]
}

function getRoomIds(user: BackendUser): string[] {
  const roomIds = [
    user.roomId,
    user.assignedRoomId,
    ...(user.roomIds ?? []),
    ...(user.assignedRoomIds ?? []),
    ...(user.rooms ?? []).map((room) => room.id ?? room.roomId ?? room._id),
    ...(user.assignedRooms ?? []).map((room) => room.id ?? room.roomId ?? room._id),
    isRecord(user.room) ? user.room.id ?? user.room.roomId ?? user.room._id : undefined,
    isRecord(user.assignedRoom) ? user.assignedRoom.id ?? user.assignedRoom.roomId ?? user.assignedRoom._id : undefined,
  ]

  return Array.from(new Set(
    roomIds
      .filter((roomId): roomId is string | number => typeof roomId === 'string' || typeof roomId === 'number')
      .map(String)
      .filter(Boolean),
  ))
}

function toUser(user: BackendUser, fallbackRole: Role = 'specialist'): User {
  const role = toRole(user.role, fallbackRole)
  const joinedName = [getText(user.firstName), getText(user.lastName)].filter(Boolean).join(' ')
  const name = getText(user.name)
    ?? getText(user.fullName)
    ?? joinedName
    ?? getText(user.username)
    ?? getText(user.email)
    ?? 'Р вЂР ВµР В· Р С‘Р СР ВµР Р…Р С‘'
  const roomId = getRoomId(user)
  const roomIds = getRoomIds(user)

  return {
    assignedRoomId: roomId,
    assignedRoomIds: roomIds,
    avatarInitials: user.avatarInitials ?? getAvatarInitials(name),
    department: user.department ?? (role === 'manager' ? 'Р Р€Р С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘Р Вµ Р С•РЎвЂЎР ВµРЎР‚Р ВµР Т‘РЎРЉРЎР‹' : 'Р С™Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљ'),
    email: getText(user.email),
    id: String(user.id ?? user._id ?? ''),
    name,
    role,
    roomId,
    roomIds,
    canManageTicketIssue: user.canManageTicketIssue ?? true,
  }
}

function unwrapUser(response: BackendUserResponse): BackendUser {
  return response.user ?? response
}

function hasUserId(user: User): boolean {
  return user.id.trim() !== '' && user.id !== 'undefined' && user.id !== 'null'
}

function getDesiredRoomIds(input: Partial<AdminUserInput>): Array<string | number> {
  const roomIds: Array<string | number | undefined> = [
    input.roomId,
    input.assignedRoomId,
    ...(input.roomIds ?? []),
    ...(input.assignedRoomIds ?? []),
  ]

  return Array.from(new Set(roomIds.filter((roomId): roomId is string | number => (
    typeof roomId === 'string' || typeof roomId === 'number'
  ))))
}

function toRegisterPayload(input: AdminUserInput) {
  return {
    canManageTicketIssue: input.canManageTicketIssue ?? true,
    email: input.email?.trim(),
    name: input.name.trim(),
    password: input.password?.trim(),
    role: input.role,
  }
}

function toUserUpdatePayload(input: Partial<AdminUserInput>) {
  const roomIds = getDesiredRoomIds(input)
  const roomId = roomIds[0]
  const hasRoomAssignmentInput = 'roomId' in input ||
    'assignedRoomId' in input ||
    'roomIds' in input ||
    'assignedRoomIds' in input
  const payload: UnknownRecord = {}

  if (input.name?.trim()) {
    payload.name = input.name.trim()
  }

  if (input.email?.trim()) {
    payload.email = input.email.trim()
  }

  if (input.role) {
    payload.role = input.role
  }

  if (input.password?.trim()) {
    payload.password = input.password.trim()
  }

  if (typeof input.canManageTicketIssue === 'boolean') {
    payload.canManageTicketIssue = input.canManageTicketIssue
  }

  if (hasRoomAssignmentInput) {
    payload.assignedRoomId = roomId ? normalizeIdValue(roomId) : null
    payload.assignedRoomIds = normalizeIdList(roomIds)
    payload.roomId = roomId ? normalizeIdValue(roomId) : null
    payload.roomIds = normalizeIdList(roomIds)
  }

  return payload
}

function toRoomCreatePayload(input: AdminRecordInput) {
  const name = getText(input.name) ?? getText(input.title) ?? ''
  const number = getText(input.number)
  const placeType = getText(input.placeType) ?? getText(input.place_type)
  const workEndTime = getText(input.workEndTime ?? input.workingEndTime ?? input.work_end_time)
  const workStartTime = getText(input.workStartTime ?? input.workingStartTime ?? input.work_start_time)
  const hasServiceTypeIds = Array.isArray(input.serviceTypeIds)
  const serviceTypeIds = normalizeIdList(input.serviceTypeIds as Array<string | number> | undefined)
  const estimatedWaitMinutesRaw = input.estimatedWaitMinutes
  const estimatedWaitMinutes = estimatedWaitMinutesRaw === null
    ? null
    : typeof estimatedWaitMinutesRaw === 'number'
    ? estimatedWaitMinutesRaw
    : typeof estimatedWaitMinutesRaw === 'string' && estimatedWaitMinutesRaw.trim() !== ''
      ? Number(estimatedWaitMinutesRaw)
      : undefined
  const ticketIssueEnabled = typeof input.ticketIssueEnabled === 'boolean'
    ? input.ticketIssueEnabled
    : typeof input.isTicketIssueEnabled === 'boolean'
      ? input.isTicketIssueEnabled
      : typeof input.kioskEnabled === 'boolean'
        ? input.kioskEnabled
        : undefined

  return {
    ...(name ? { name } : {}),
    ...(number ? { number } : {}),
    ...(placeType ? { placeType } : {}),
    ...(hasServiceTypeIds ? { serviceTypeIds } : {}),
    ...(estimatedWaitMinutes === null
      ? { estimatedWaitMinutes: null }
      : estimatedWaitMinutes === undefined || !Number.isFinite(estimatedWaitMinutes)
      ? {}
      : { estimatedWaitMinutes: Math.max(0, Math.round(estimatedWaitMinutes)) }),
    ...(ticketIssueEnabled === undefined ? {} : { ticketIssueEnabled, isTicketIssueEnabled: ticketIssueEnabled }),
    ...(workEndTime ? { workEndTime } : {}),
    ...(workStartTime ? { workStartTime } : {}),
    ...(workEndTime ? { workingEndTime: workEndTime } : {}),
    ...(workStartTime ? { workingStartTime: workStartTime } : {}),
  }
}

function toRoomUpdatePayload(input: AdminRecordInput) {
  const createPayload = toRoomCreatePayload(input)
  const isActive = typeof input.isActive === 'boolean'
    ? input.isActive
    : typeof input.active === 'boolean'
      ? input.active
      : undefined

  return {
    ...createPayload,
    ...(isActive === undefined ? {} : { active: isActive, isActive }),
  }
}

function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response
}

function getStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

async function requestFirst<T>(requests: Array<() => Promise<T>>): Promise<T> {
  let lastError: unknown

  for (const request of requests) {
    try {
      return await request()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

async function getAdminRecords(path: string, keys: string[]) {
  const response = await apiClient.get<unknown>(path)

  return toArray(response.data, keys)
}

async function getUsers(path: string) {
  const records = await getAdminRecords(path, ['users', 'staff'])

  return records.map((user) => toUser(user as BackendUser))
}

async function createRoom(path: string, input: AdminRecordInput) {
  const payload = toRoomCreatePayload(input)
  const response = await requestFirst([
    () => apiClient.post<unknown>(path, payload),
    () => apiClient.post<unknown>(path, {
      name: payload.name,
      services: payload.serviceTypeIds,
    }),
    () => apiClient.post<unknown>(path, {
      serviceTypeIds: payload.serviceTypeIds,
      title: payload.name,
    }),
  ])

  return toRoomRecord(isRecord(response.data) ? response.data : {})
}

async function updateRoom(path: string, id: string | number, input: AdminRecordInput) {
  const payload = toRoomUpdatePayload(input)
  const response = await requestFirst([
    () => apiClient.patch<unknown>(`${path}/${id}`, payload),
    () => apiClient.patch<unknown>(`${path}/${id}`, {
      active: payload.active,
      isTicketIssueEnabled: payload.isTicketIssueEnabled,
      name: payload.name,
      ...(Array.isArray(payload.serviceTypeIds) ? { services: payload.serviceTypeIds } : {}),
      ticketIssueEnabled: payload.ticketIssueEnabled,
    }),
    () => apiClient.put<unknown>(`${path}/${id}`, payload),
  ])

  return toRoomRecord(isRecord(response.data) ? response.data : { id, ...payload })
}

async function deleteRecord(path: string, id: string | number) {
  await apiClient.delete(`${path}/${id}`)
}

async function fetchUsers(): Promise<User[]> {
  return requestFirst([
    () => getUsers('/users'),
    () => getUsers('/staff'),
  ])
}

async function resolveCreatedUser(input: AdminUserInput, response: BackendUserResponse): Promise<User> {
  let user = toUser(unwrapUser(response), input.role)

  if (hasUserId(user)) {
    return user
  }

  const users = await fetchUsers().catch(() => [])
  const normalizedEmail = input.email?.trim().toLowerCase()
  const foundUser = users.find((item) => (
    normalizedEmail && item.email?.trim().toLowerCase() === normalizedEmail
  )) ?? users.find((item) => item.name === input.name && item.role === input.role)

  if (foundUser) {
    return foundUser
  }

  user = {
    ...user,
    email: input.email,
    name: input.name,
    role: input.role,
    roomAssignmentPending: getDesiredRoomIds(input).length > 0,
  }

  return user
}

async function assignUserToRoom(userId: string | number, roomId: string | number) {
  return assignUserToRooms(userId, [roomId])
}

async function assignUserToRooms(userId: string | number, roomIds: Array<string | number>) {
  const normalizedRoomIds = normalizeIdList(roomIds)
  const normalizedRoomId = normalizedRoomIds[0]
  const response = await requestFirst([
    () => apiClient
      .patch<BackendUserResponse>(`/users/${userId}`, {
        assignedRoomId: normalizedRoomId,
        assignedRoomIds: normalizedRoomIds,
        roomId: normalizedRoomId,
        roomIds: normalizedRoomIds,
      })
      .then((result) => result.data),
    () => apiClient
      .patch<BackendUserResponse>(`/users/${userId}`, {
        assignedRoomId: normalizedRoomId,
        assignedRoomIds: normalizedRoomIds,
      })
      .then((result) => result.data),
    () => apiClient
      .patch<BackendUserResponse>(`/staff/${userId}`, {
        roomId: normalizedRoomId,
        roomIds: normalizedRoomIds,
      })
      .then((result) => result.data),
  ])

  return toUser(unwrapUser(response), 'specialist')
}

function getDeleteUserError(error: unknown): Error {
  if (isNetworkError(error)) {
    return new Error('Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ Р С” backend')
  }

  const status = getStatus(error)

  if (status === 404 || status === 405 || status === 501) {
    return new Error('Р Р€Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р Вµ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ Р С—Р С•Р С”Р В° Р Р…Р Вµ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С‘Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ backend.')
  }

  return new Error('Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р Р†РЎР‚Р В°РЎвЂЎР В°')
}

export const backendAdminApi: AdminApi = {
  async getServiceTypes() {
    try {
      const response = await apiClient.get<unknown>('/service-types')

      const serviceTypes = toArray(response.data, ['serviceTypes', 'services']).map(toServiceTypeOption)

      return serviceTypes.length > 0 ? serviceTypes : fallbackServiceTypeOptions
    } catch (error) {
      console.warn('backendAdminApi: GET /service-types is not available, using fallback services', error)

      return fallbackServiceTypeOptions
    }
  },

  async createServiceType(input) {
    const response = await apiClient.post<unknown>('/service-types', toServiceTypePayload(input))

    return toServiceTypeResponseOption(response.data, input)
  },

  async updateServiceType(id, input) {
    const response = await apiClient.patch<unknown>(`/service-types/${id}`, toServiceTypePayload(input))

    return toServiceTypeResponseOption(response.data, { id, ...input })
  },

  async deleteServiceType(id) {
    try {
      await deleteRecord('/service-types', id)
    } catch (deleteError) {
      console.warn('backendAdminApi.deleteServiceType: DELETE failed, trying soft delete', deleteError)

      try {
        await apiClient.patch(`/service-types/${id}`, {
          active: false,
          isActive: false,
        })
      } catch (patchError) {
        console.warn('backendAdminApi.deleteServiceType: soft delete failed', patchError)
        throw deleteError
      }
    }
  },

  getRooms() {
    const getRoomsRecords = async (path: string) => {
      const records = await getAdminRecords(path, ['rooms'])
      return records.map(toRoomRecord)
    }
    return getRoomsRecords('/rooms')
  },

  createRoom(input) {
    return createRoom('/rooms', input)
  },

  updateRoom(id, input) {
    return updateRoom('/rooms', id, input)
  },

  async updateRoomTicketIssue(id, enabled) {
    const response = await apiClient.patch<unknown>(`/rooms/${id}/ticket-issue`, {
      isTicketIssueEnabled: enabled,
      kioskEnabled: enabled,
      ticketIssueEnabled: enabled,
    })

    return toRoomRecord(isRecord(response.data) ? response.data : { id, ticketIssueEnabled: enabled })
  },

  deleteRoom(id) {
    return deleteRecord('/rooms', id)
  },

  async getStaff() {
    const users = await fetchUsers()

    return users
      .filter((user) => user.role === 'specialist')
      .map((user) => ({ ...user }))
  },

  createStaff(input) {
    return apiClient
      .post<unknown>('/staff', input)
      .then((response) => toRoomRecord(isRecord(response.data) ? response.data : {}))
  },

  updateStaff(id, input) {
    return apiClient
      .patch<unknown>(`/staff/${id}`, input)
      .then((response) => toRoomRecord(isRecord(response.data) ? response.data : { id, ...input }))
  },

  deleteStaff(id) {
    return deleteRecord('/staff', id)
  },

  getUsers() {
    return fetchUsers()
  },

  async createUser(input: AdminUserInput) {
    const desiredRoomIds = getDesiredRoomIds(input)
    let response: BackendUserResponse

    try {
      response = await apiClient
        .post<BackendUserResponse>('/auth/register', toRegisterPayload(input))
        .then((result) => result.data)
    } catch (error) {
      console.warn('backendAdminApi.createUser: account registration failed', error)
      throw new Error('Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р В°Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ Р Т‘Р В»РЎРЏ Р Р†РЎвЂ¦Р С•Р Т‘Р В°')
    }

    const createdUser = await resolveCreatedUser(input, response)


    if (desiredRoomIds.length === 0) {
      return createdUser
    }

    if (!hasUserId(createdUser)) {
      return {
        ...createdUser,
        roomAssignmentPending: true,
      }
    }

    try {
      return await assignUserToRooms(createdUser.id, desiredRoomIds)
    } catch (error) {
      console.warn('backendAdminApi.createUser: room assignment failed after user creation', error)

      return {
        ...createdUser,
        roomAssignmentPending: true,
      }
    }
  },

  async updateUser(id, input) {
    const payload = toUserUpdatePayload(input)
    
    const response = await requestFirst([
      () => apiClient.patch<BackendUserResponse>(`/users/${id}`, payload).then((result) => result.data),
      () => apiClient.patch<BackendUserResponse>(`/staff/${id}`, payload).then((result) => result.data),
    ])
    return toUser(unwrapUser(response), input.role)
  },

  async deleteUser(id) {
    try {
      await requestFirst([
        () => deleteRecord('/users', id),
        () => deleteRecord('/staff', id),
      ])
    } catch (error) {
      throw getDeleteUserError(error)
    }
  },

  assignDoctorToRoom(userId, roomId) {
    return assignUserToRoom(userId, roomId)
  },

  async getTerminals() {
    const response = await apiClient.get<unknown>('/terminals')

    return toArray(response.data, ['terminals']).map(toTerminalRecord)
  },

  async createTerminal(input) {
    const response = await apiClient.post<unknown>('/terminals', toTerminalPayload(input))

    return toTerminalRecord(isRecord(response.data) ? response.data : { ...input, id: Date.now() })
  },

  async updateTerminal(id, input) {
    const response = await apiClient.patch<unknown>(`/terminals/${id}`, toTerminalPayload(input))

    return toTerminalRecord(isRecord(response.data) ? response.data : { ...input, id })
  },

  deleteTerminal(id) {
    return deleteRecord('/terminals', id)
  },

  async getBoardSettings() {
    const response = await requestFirst([
      () => apiClient.get<unknown>('/board-settings').then((result) => result.data),
      () => apiClient.get<unknown>('/settings/board').then((result) => result.data),
    ])

    return toBoardSettings(isRecord(response) && isRecord(response.settings) ? response.settings : response)
  },

  async updateBoardSettings(input) {
    const payload = {
      ...defaultBoardSettings,
      ...input,
      promoMediaByProfileId: input.promoMediaByProfileId ?? defaultBoardSettings.promoMediaByProfileId,
      screens: input.screens ?? defaultBoardSettings.screens,
      styleSettings: input.styleSettings ?? defaultBoardSettings.styleSettings,
    }
    const response = await requestFirst([
      () => apiClient.patch<unknown>('/board-settings', payload).then((result) => result.data),
      () => apiClient.put<unknown>('/board-settings', payload).then((result) => result.data),
      () => apiClient.patch<unknown>('/settings/board', payload).then((result) => result.data),
    ])

    return toBoardSettings(isRecord(response) && isRecord(response.settings) ? response.settings : response)
  },
}
