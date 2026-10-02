import type {
  TicketSettingsOptions,
  TicketSettingsRoomOption,
  TicketSettingsServiceTypeOption,
  TicketSettingsUserOption,
} from '@services/api'
import { fallbackServiceTypeOptions } from '@services/api/serviceTypeCatalog'
import { getCurrentLanguage, getLocale, type SmartQLanguage } from '@shared/locales/useLocale'
import type {
  Room,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '@shared/types'
import {
  fallbackServiceDurationMinutes,
  getAverageServiceDurationStats,
  getPriorityMeta,
  getTicketStatusMeta,
  isWithinTicketIssueHours,
} from '@shared/utils'

export const ticketPriorities: TicketPriority[] = [
  'low',
  'normal',
  'above_normal',
  'high',
  'critical',
]

export const ticketStatuses: TicketStatus[] = [
  'waiting',
  'called',
  'in_service',
  'completed',
  'no_show',
  'postponed',
  'redirected',
  'cancelled',
]

export const fallbackServiceTypes = fallbackServiceTypeOptions
export const activeQueueStatuses = new Set<TicketStatus>(['created', 'waiting', 'called', 'in_service', 'redirected'])
const fallbackServiceOptionKeys = new Map<string, keyof ReturnType<typeof getLocale>['serviceOptions']>([
  ['Регистрация', 'registration'],
  ['Консультация терапевта', 'therapistConsultation'],
  ['Консультация педиатра', 'pediatricianConsultation'],
  ['Консультация кардиолога', 'cardiologistConsultation'],
  ['Консультация невролога', 'neurologistConsultation'],
  ['Консультация хирурга', 'surgeonConsultation'],
  ['Лабораторные анализы', 'labTests'],
  ['Забор крови', 'bloodSampling'],
  ['Рентген', 'xray'],
  ['УЗИ', 'ultrasound'],
  ['ЭКГ', 'ecg'],
  ['МРТ', 'mri'],
  ['КТ', 'ct'],
  ['Оплата услуг', 'billingServices'],
  ['Получение справки', 'certificate'],
  ['Вакцинация', 'vaccination'],
  ['Процедурный кабинет', 'procedureRoom'],
  ['Приём документов', 'documentIntake'],
  ['Другое', 'other'],
])

export function getServiceOptionLabel(option?: TicketSettingsServiceTypeOption, language?: SmartQLanguage): string {
  const resolvedLanguage = language ?? getCurrentLanguage()

  if (!option) {
    return getLocale(resolvedLanguage).tickets.unassigned
  }

  const translatedName = option.translations?.[resolvedLanguage]

  if (translatedName) {
    return translatedName
  }

  const fallbackKey = fallbackServiceOptionKeys.get(option.name)

  return fallbackKey ? getLocale(resolvedLanguage).serviceOptions[fallbackKey] : option.name
}

export function getPriorityLabel(priority: TicketPriority): string {
  return getPriorityMeta(priority).label
}

export function getStatusLabel(status: TicketStatus): string {
  if (status === 'in_service') {
    return getLocale().status.in_service
  }

  return getTicketStatusMeta(status).label
}

export function getServiceTypes(options: TicketSettingsOptions): TicketSettingsServiceTypeOption[] {
  const serviceTypes = options.serviceTypes.length > 0 ? options.serviceTypes : fallbackServiceTypes

  return serviceTypes.filter((serviceType) => serviceType.active !== false)
}

function normalizeServiceId(value?: string | number | null): string {
  return value == null ? '' : String(value)
}

function getFallbackRoomServiceIds(room: Room): string[] {
  const record = room as Room & {
    serviceTypeId?: string | number
    serviceTypeIds?: Array<string | number>
    serviceTypes?: Array<string | number | { _id?: string | number; id?: string | number; serviceTypeId?: string | number }>
    services?: Array<string | number | { _id?: string | number; id?: string | number; serviceTypeId?: string | number }>
    ticketIssueEnabled?: boolean
    isTicketIssueEnabled?: boolean
    kioskEnabled?: boolean
  }

  return getRoomServiceIds(record)
}

export function getRoomServiceIds(room: TicketSettingsRoomOption): string[] {
  const singleId = normalizeServiceId(room.serviceTypeId)
  const explicitIds = Array.isArray(room.serviceTypeIds)
    ? room.serviceTypeIds.map(normalizeServiceId)
    : []
  const nestedServices = [...(room.serviceTypes ?? []), ...(room.services ?? [])]
    .map((service) => {
      if (typeof service === 'string' || typeof service === 'number') {
        return normalizeServiceId(service)
      }

      return normalizeServiceId(service.serviceTypeId ?? service.id ?? service._id ?? service.name ?? service.title)
    })

  return Array.from(new Set([singleId, ...explicitIds, ...nestedServices].filter(Boolean)))
}

export function roomSupportsService(
  room: TicketSettingsRoomOption,
  serviceTypeId?: string | number,
): boolean {
  const serviceId = normalizeServiceId(serviceTypeId)

  if (!serviceId) {
    return true
  }

  return getRoomServiceIds(room).includes(serviceId)
}

export function getRooms(options: TicketSettingsOptions, fallbackRooms: Room[] = []): TicketSettingsRoomOption[] {
  const mergedRooms: TicketSettingsRoomOption[] = options.rooms
    .filter((room) => room.isActive !== false && room.active !== false)
    .map((room) => ({
      active: room.active,
      id: room.id,
      isActive: room.isActive,
      isTicketIssueEnabled: room.isTicketIssueEnabled,
      kioskEnabled: room.kioskEnabled,
      name: room.name,
      number: room.number,
      placeType: room.placeType,
      roomId: room.roomId,
      roomName: room.roomName,
      serviceTypeId: room.serviceTypeId,
      serviceTypeIds: room.serviceTypeIds,
      serviceTypes: room.serviceTypes,
      services: room.services,
      ticketIssueEnabled: room.ticketIssueEnabled,
      title: room.title,
      workEndTime: room.workEndTime ?? room.workingEndTime,
      workStartTime: room.workStartTime ?? room.workingStartTime,
      workingEndTime: room.workingEndTime,
      workingStartTime: room.workingStartTime,
    }))

  fallbackRooms
    .filter((room) => room.isActive !== false)
    .forEach((room) => {
      if (!mergedRooms.some((item) => String(item.id) === room.id)) {
        mergedRooms.push({
          id: room.id,
          name: room.name,
          number: room.number,
          placeType: room.placeType,
          serviceTypeId: room.serviceTypeId,
          serviceTypeIds: getFallbackRoomServiceIds(room),
          serviceTypes: room.serviceTypes,
          services: room.services,
          ticketIssueEnabled: room.ticketIssueEnabled,
          isTicketIssueEnabled: room.isTicketIssueEnabled,
          kioskEnabled: room.kioskEnabled,
          workEndTime: room.workEndTime ?? room.workingEndTime,
          workStartTime: room.workStartTime ?? room.workingStartTime,
          workingEndTime: room.workingEndTime,
          workingStartTime: room.workingStartTime,
        })
      }
    })

  return mergedRooms
}

export function getRoomsForService(
  options: TicketSettingsOptions,
  serviceTypeId?: string | number,
  fallbackRooms: Room[] = [],
): TicketSettingsRoomOption[] {
  return getRooms(options, fallbackRooms).filter((room) => roomSupportsService(room, serviceTypeId))
}

export function getSpecialists(options: TicketSettingsOptions): TicketSettingsUserOption[] {
  return options.specialists
}

export function getSpecialistRoomIds(specialist: TicketSettingsUserOption): string[] {
  return Array.from(new Set([
    normalizeServiceId(specialist.roomId),
    normalizeServiceId(specialist.assignedRoomId),
    ...(specialist.roomIds ?? []).map(normalizeServiceId),
    ...(specialist.assignedRoomIds ?? []).map(normalizeServiceId),
  ].filter(Boolean)))
}

export function getSpecialistsForRoom(
  options: TicketSettingsOptions,
  roomId?: string | number,
): TicketSettingsUserOption[] {
  const selectedRoomId = normalizeServiceId(roomId)
  const specialists = getSpecialists(options)

  if (!selectedRoomId) {
    return specialists
  }

  return specialists.filter((specialist) => (
    getSpecialistRoomIds(specialist).includes(selectedRoomId)
  ))
}

export function getRoomLoadPercent(room: TicketSettingsRoomOption, fallbackRooms: Room[]): number {
  const roomId = normalizeServiceId(room.id)
  const fallbackRoom = fallbackRooms.find((item) => normalizeServiceId(item.id) === roomId)
  const roomWithLoad = room as TicketSettingsRoomOption & {
    loadPercent?: number
    workload?: number
  }

  return fallbackRoom?.loadPercent ?? roomWithLoad.loadPercent ?? fallbackRoom?.workload ?? roomWithLoad.workload ?? 0
}

export function isRoomTicketIssueEnabled(room: TicketSettingsRoomOption, fallbackRooms: Room[]): boolean {
  const roomId = normalizeServiceId(room.id)
  const fallbackRoom = fallbackRooms.find((item) => normalizeServiceId(item.id) === roomId)
  const issueEnabled = room.ticketIssueEnabled
    ?? room.isTicketIssueEnabled
    ?? room.kioskEnabled
    ?? fallbackRoom?.ticketIssueEnabled
    ?? fallbackRoom?.isTicketIssueEnabled
    ?? fallbackRoom?.kioskEnabled

  return issueEnabled !== false
}

function getFallbackRoom(room: TicketSettingsRoomOption, fallbackRooms: Room[]): Room | undefined {
  const roomId = normalizeServiceId(room.id)

  return fallbackRooms.find((item) => normalizeServiceId(item.id) === roomId)
}

function mergeRoomWithFallback(room: TicketSettingsRoomOption, fallbackRooms: Room[]): TicketSettingsRoomOption {
  const fallbackRoom = getFallbackRoom(room, fallbackRooms)

  return {
    ...fallbackRoom,
    ...room,
    workEndTime: room.workEndTime ?? room.workingEndTime ?? fallbackRoom?.workEndTime ?? fallbackRoom?.workingEndTime,
    workStartTime: room.workStartTime ?? room.workingStartTime ?? fallbackRoom?.workStartTime ?? fallbackRoom?.workingStartTime,
    workingEndTime: room.workingEndTime ?? fallbackRoom?.workingEndTime,
    workingStartTime: room.workingStartTime ?? fallbackRoom?.workingStartTime,
  }
}

export function isRoomAvailableForTicket(
  room: TicketSettingsRoomOption,
  fallbackRooms: Room[],
  _tickets: Ticket[] = [],
  _averageServiceMinutes = fallbackServiceDurationMinutes,
  now: Date | number = new Date(),
): boolean {
  const fallbackRoom = getFallbackRoom(room, fallbackRooms)
  const roomWithFallback = mergeRoomWithFallback(room, fallbackRooms)
  const isActive = room.isActive !== false &&
    room.active !== false &&
    fallbackRoom?.active !== false &&
    fallbackRoom?.isActive !== false

  return isActive &&
    isRoomTicketIssueEnabled(room, fallbackRooms) &&
    isWithinTicketIssueHours(roomWithFallback, now)
}

export function getRoomQueueCount(roomId: string | number, tickets: Array<{ roomId?: string | number; status: TicketStatus }>): number {
  const normalizedRoomId = normalizeServiceId(roomId)

  return tickets.filter((ticket) =>
    normalizeServiceId(ticket.roomId) === normalizedRoomId && activeQueueStatuses.has(ticket.status),
  ).length
}

export function getAutoRoomForService(
  rooms: TicketSettingsRoomOption[],
  fallbackRooms: Room[],
  tickets: Ticket[],
  averageServiceMinutes = fallbackServiceDurationMinutes,
  now: Date | number = new Date(),
): TicketSettingsRoomOption | undefined {
  return [...rooms]
    .filter((room) => isRoomAvailableForTicket(room, fallbackRooms, tickets, averageServiceMinutes, now))
    .map((room, index) => ({ index, room }))
    .sort((left, right) => {
      const queueDelta = getRoomQueueCount(left.room.id, tickets) - getRoomQueueCount(right.room.id, tickets)

      return queueDelta || left.index - right.index
    })[0]?.room
}

export function getAutoSpecialistForRoom(
  roomId: string | number,
  specialists: TicketSettingsUserOption[],
): TicketSettingsUserOption | undefined {
  const normalizedRoomId = normalizeServiceId(roomId)

  return specialists.find((specialist) =>
    getSpecialistRoomIds(specialist).includes(normalizedRoomId),
  )
}

export function getAvailableServiceTypes(
  options: TicketSettingsOptions,
  fallbackRooms: Room[],
  tickets: Ticket[],
): TicketSettingsServiceTypeOption[] {
  return getServiceTypes(options).filter((serviceType) => {
    const serviceRooms = getRoomsForService(options, serviceType.id, fallbackRooms)
    const averageServiceMinutes = getAverageServiceDurationStats(
      tickets,
      serviceType.id,
      serviceType.code,
    ).averageMinutes

    return Boolean(getAutoRoomForService(serviceRooms, fallbackRooms, tickets, averageServiceMinutes))
  })
}
