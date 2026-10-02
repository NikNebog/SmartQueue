import type { AdminRecord, TicketSettingsServiceTypeOption } from '@services/api'
import { getServiceOptionLabel } from '@features/tickets/ticketFormOptions'
import type { SmartQLanguage } from '@shared/locales/useLocale'
import type { Role, User } from '@shared/types'
import { formatRoomName } from '@shared/utils'

type AdminRoomServiceReference = string | number | {
  _id?: string | number
  id?: string | number
  name?: string
  serviceTypeId?: string | number
  title?: string
  translations?: Partial<Record<SmartQLanguage, string>>
}

export type AdminRoomRecord = AdminRecord & {
  active?: boolean
  isActive?: boolean
  isTicketIssueEnabled?: boolean
  kioskEnabled?: boolean
  name?: string
  number?: string | number
  placeType?: string
  place_type?: string
  roomName?: string
  roomId?: string | number
  services?: AdminRoomServiceReference[]
  serviceTypeId?: string | number
  serviceTypeIds?: Array<string | number>
  serviceTypes?: AdminRoomServiceReference[]
  estimatedWaitMinutes?: number | null
  status?: string
  ticketIssueEnabled?: boolean
  title?: string
  workEndTime?: string
  workStartTime?: string
  work_end_time?: string
  work_start_time?: string
  workingEndTime?: string
  workingStartTime?: string
}

export const roleLabels: Record<Role, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  specialist: 'Специалист',
}

function looksLikeMojibake(text: string): boolean {
  return /[РСЃ]/.test(text) && /[Ѓ‚„…†‡€‰Љ‹ЊЋЏ]/.test(text)
}

export function getRoomName(room?: AdminRoomRecord): string {
  return formatRoomName(room)
}

export function getRoomActive(room: AdminRoomRecord): boolean {
  return room.isActive
    ?? room.active
    ?? (room.status !== 'paused' && room.status !== 'inactive' && room.status !== 'deleted')
}

export function getRoomTicketIssueEnabled(room: AdminRoomRecord): boolean {
  return (room.ticketIssueEnabled ?? room.isTicketIssueEnabled ?? room.kioskEnabled) !== false
}

export function getRoomServiceTypeIds(room: AdminRoomRecord): string[] {
  if (room.serviceTypeId !== undefined) {
    return [String(room.serviceTypeId)]
  }

  if (Array.isArray(room.serviceTypeIds)) {
    return room.serviceTypeIds.map(String)
  }

  const services = room.serviceTypes ?? room.services

  if (Array.isArray(services)) {
    return services.map((serviceType) => {
      if (typeof serviceType === 'object' && serviceType !== null) {
        return String(serviceType.id ?? serviceType.serviceTypeId ?? serviceType.name ?? serviceType.title ?? '')
      }

      return String(serviceType)
    }).filter(Boolean)
  }

  return []
}

function getRoomServiceReferenceName(
  service: AdminRoomServiceReference,
  serviceTypeById: Map<string, string>,
  language: SmartQLanguage,
): string {
  if (typeof service === 'string' || typeof service === 'number') {
    return serviceTypeById.get(String(service)) ?? ''
  }

  const serviceId = String(service.serviceTypeId ?? service.id ?? service._id ?? '')

  return serviceTypeById.get(serviceId)
    ?? service.translations?.[language]
    ?? service.name
    ?? service.title
    ?? ''
}

export function getRoomServiceNames(
  room: AdminRoomRecord,
  serviceTypes: TicketSettingsServiceTypeOption[],
  language: SmartQLanguage = 'ru',
): string[] {
  const serviceTypeById = new Map(serviceTypes.map((serviceType) => [
    String(serviceType.id),
    getServiceOptionLabel(serviceType, language),
  ]))
  const directServiceNames = [...(room.serviceTypes ?? []), ...(room.services ?? [])]
    .map((service) => getRoomServiceReferenceName(service, serviceTypeById, language))
    .filter(Boolean)
  const idServiceNames = [
    ...(room.serviceTypeId !== undefined ? [room.serviceTypeId] : []),
    ...(room.serviceTypeIds ?? []),
  ]
    .map((serviceTypeId) => serviceTypeById.get(String(serviceTypeId)))
    .filter((name): name is string => Boolean(name))

  return Array.from(new Set([...directServiceNames, ...idServiceNames]))
}

export function getServiceTypeNames(
  room: AdminRoomRecord,
  serviceTypes: TicketSettingsServiceTypeOption[],
  language: SmartQLanguage = 'ru',
): string {
  const serviceNames = getRoomServiceNames(room, serviceTypes, language)

  if (serviceNames.length === 0) {
    return 'Не выбраны'
  }

  return serviceNames.join(', ')
}

export function getUserRoomId(user: User): string {
  return getUserRoomIds(user)[0] ?? ''
}

export function getUserRoomIds(user: User): string[] {
  return Array.from(new Set([
    user.roomId,
    user.assignedRoomId,
    ...(user.roomIds ?? []),
    ...(user.assignedRoomIds ?? []),
  ].filter((id): id is string => Boolean(id))))
}

export function getUserLogin(user: User): string {
  return user.email ?? 'Не указан'
}

export function getAdminErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    if (error.message && !looksLikeMojibake(error.message) && /[а-яё]/i.test(error.message)) {
      return error.message
    }

    if (error.message.toLowerCase().includes('backend')) {
      return `${fallbackMessage}. Проверьте подключение к backend.`
    }
  }

  return `${fallbackMessage}. Проверьте подключение к backend.`
}

export function moveItemToTop<T extends { id?: string | number }>(
  items: T[],
  itemOrId?: T | string | number | null,
): T[] {
  if (itemOrId === undefined || itemOrId === null) {
    return items
  }

  const itemId = typeof itemOrId === 'object' ? itemOrId.id : itemOrId

  if (itemId === undefined || itemId === null) {
    return items
  }

  const existingItem = items.find((item) => String(item.id) === String(itemId))
  const topItem = typeof itemOrId === 'object' ? itemOrId : existingItem

  if (!topItem) {
    return items
  }

  return [topItem, ...items.filter((item) => String(item.id) !== String(itemId))]
}
