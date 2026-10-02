import { io, type Socket } from 'socket.io-client'
import type { QueueEvent, QueueEventType } from '@shared/types'
import { formatRoomVoiceTarget } from '@shared/utils/room'
import { REALTIME_BASE_URL, isBackendMode } from './apiProvider'

type QueueEventListener = (event: QueueEvent) => void
type RealtimeEventType = Extract<QueueEventType, 'status_update' | 'ticket_called'>
const realtimeEventTypes: RealtimeEventType[] = ['status_update', 'ticket_called']
const statusLabels: Record<string, string> = {
  called: 'Вызван',
  cancelled: 'Отменён',
  completed: 'Завершён',
  created: 'Создан',
  in_service: 'На обслуживании',
  no_show: 'Не явился',
  redirected: 'Перенаправлен',
  waiting: 'Ожидание',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function logDev(message: string, payload?: unknown): void {
  if (!import.meta.env.DEV) {
    return
  }

  if (payload !== undefined) {
    console.log(message, payload)
    return
  }

  console.log(message)
}

function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const child = value[key]

  return isRecord(child) ? child : undefined
}

function getValue(value: unknown, keys: string[]): unknown {
  if (!isRecord(value)) {
    return undefined
  }

  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) {
      return value[key]
    }
  }

  return undefined
}

function getNestedValue(value: unknown, directKeys: string[], nestedKey: string, nestedKeys: string[]): unknown {
  return getValue(value, directKeys) ?? getValue(getRecord(value, nestedKey), nestedKeys)
}

function toText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return undefined
}

function toId(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return undefined
}

function normalizeStatus(value: unknown): string | undefined {
  return toText(value)?.toLowerCase().replace(/-/g, '_')
}

function getWrappedPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload
  }

  return getRecord(payload, 'payload')
    ?? getRecord(payload, 'data')
    ?? getRecord(payload, 'event')
    ?? payload
}

function getEventRoomTarget(roomName?: string, roomId?: string | number): string {
  if (!roomName?.trim() && roomId === undefined) {
    return 'к месту обслуживания'
  }

  return formatRoomVoiceTarget({ id: roomId, name: roomName })
}

function getEventDateText(payload: unknown): string | undefined {
  return toText(getValue(payload, [
    'createdAt',
    'created_at',
    'occurredAt',
    'occurred_at',
    'timestamp',
    'updatedAt',
    'updated_at',
  ]))
}

function getCreatedAt(rawDate?: string): string {
  const date = rawDate ? new Date(rawDate) : new Date()

  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
}

function buildMessage(
  type: RealtimeEventType,
  ticketNumber?: string,
  roomName?: string,
  roomId?: string | number,
  status?: string,
): string {
  const ticketLabel = ticketNumber ? `Талон ${ticketNumber}` : 'Талон'

  if (type === 'ticket_called') {
    return `${ticketLabel} вызван ${getEventRoomTarget(roomName, roomId)}`
  }

  const statusLabel = status ? statusLabels[status] ?? status : 'обновлён'

  return `${ticketLabel} переведён в статус «${statusLabel}»`
}

function getStablePayloadSignature(payload: unknown): string {
  try {
    return JSON.stringify(payload) ?? String(payload)
  } catch {
    return String(payload)
  }
}

function createEventId(
  type: RealtimeEventType,
  rawPayload: unknown,
  payload: unknown,
  ticketId?: string | number,
  ticketNumber?: string,
  roomId?: string | number,
  status?: string,
  createdAt?: string,
): string {
  const rawEventId = toId(
    getValue(payload, ['eventId', 'event_id'])
      ?? getValue(rawPayload, ['eventId', 'event_id']),
  )

  if (rawEventId !== undefined) {
    return String(rawEventId)
  }

  return [
    type,
    ticketId
      ?? ticketNumber
      ?? toId(getValue(payload, ['id', '_id']) ?? getValue(rawPayload, ['id', '_id']))
      ?? 'ticket',
    roomId ?? 'room',
    status ?? 'status',
    createdAt ?? getStablePayloadSignature(payload),
  ].join(':')
}

function normalizeQueueEvent(type: RealtimeEventType, payload: unknown): QueueEvent {
  const eventPayload = getWrappedPayload(payload)
  const ticket = getRecord(eventPayload, 'ticket') ?? getRecord(payload, 'ticket')
  const room = getRecord(eventPayload, 'room') ?? getRecord(payload, 'room')
  const ticketId = toId(
    getNestedValue(eventPayload, ['ticketId', 'ticket_id'], 'ticket', ['id', '_id'])
      ?? getNestedValue(payload, ['ticketId', 'ticket_id'], 'ticket', ['id', '_id']),
  )
  const ticketNumber = toText(
    getNestedValue(eventPayload, ['ticketNumber', 'ticket_number', 'number'], 'ticket', ['number', 'ticketNumber'])
      ?? getNestedValue(payload, ['ticketNumber', 'ticket_number', 'number'], 'ticket', ['number', 'ticketNumber']),
  )
  const roomId = toId(
    getNestedValue(eventPayload, ['roomId', 'room_id'], 'room', ['id', '_id', 'roomId'])
      ?? getNestedValue(payload, ['roomId', 'room_id'], 'room', ['id', '_id', 'roomId']),
  )
  const roomName = toText(
    getValue(eventPayload, ['roomName', 'room_name'])
      ?? getValue(payload, ['roomName', 'room_name'])
      ?? getValue(room, ['name', 'roomName', 'room_name', 'title'])
      ?? getValue(ticket, ['roomName', 'room_name']),
  )
  const status = normalizeStatus(
    getValue(eventPayload, ['status', 'newStatus', 'new_status'])
      ?? getValue(payload, ['status', 'newStatus', 'new_status'])
      ?? getValue(ticket, ['status']),
  )
  const eventDateText = getEventDateText(eventPayload) ?? getEventDateText(payload)
  const createdAt = getCreatedAt(eventDateText)
  const fallbackMessage = toText(
    getValue(eventPayload, ['message', 'text', 'description'])
      ?? getValue(payload, ['message', 'text', 'description']),
  )
  const message = ticketNumber || roomName || roomId !== undefined || status
    ? buildMessage(type, ticketNumber, roomName, roomId, status)
    : fallbackMessage ?? buildMessage(type, ticketNumber, roomName, roomId, status)

  return {
    createdAt,
    id: createEventId(
      type,
      payload,
      eventPayload,
      ticketId,
      ticketNumber,
      roomId,
      status,
      eventDateText ? createdAt : undefined,
    ),
    message,
    occurredAt: createdAt,
    roomId,
    roomName,
    status,
    ticketId,
    ticketNumber,
    type,
  }
}

class SmartQSocketClient {
  private listeners = new Set<QueueEventListener>()
  private socket: Socket | null = null

  connect(): void {
    if (!isBackendMode) {
      return
    }

    if (!this.socket) {
      this.socket = io(REALTIME_BASE_URL, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        withCredentials: true,
      })

      realtimeEventTypes.forEach((eventType) => {
        this.socket?.on(eventType, (payload: unknown) => {
          logDev(`Received ${eventType}`, payload)
          this.emitEvent(normalizeQueueEvent(eventType, payload))
        })
      })

      this.socket.on('connect', () => logDev('Socket connected'))
      this.socket.on('disconnect', () => logDev('Socket disconnected'))
      this.socket.on('connect_error', (error) => {
        if (import.meta.env.DEV) {
          console.warn('Socket подключение не удалось', error)
        }
      })
    }

    if (!this.socket.connected) {
      this.socket.connect()
    }
  }

  disconnect(): void {
    this.socket?.disconnect()
    this.listeners.clear()
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected)
  }

  subscribe(listener: QueueEventListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  emitEvent(event: QueueEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }
}

export const socketClient = new SmartQSocketClient()
