import { useEffect, useMemo, useState } from 'react'
import { Power, PowerOff } from 'lucide-react'
import { SpecialistControls } from '@features/specialist/SpecialistControls'
import { adminService } from '@services/adminService'
import { subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import { ticketService } from '@services/ticketService'
import type { TicketSettingsServiceTypeOption } from '@services/api'
import { getServiceOptionLabel } from '@features/tickets/ticketFormOptions'
import { t, useLanguage, type SmartQLanguage } from '@shared/locales/useLocale'
import type { Room, User } from '@shared/types'
import { Button, StatusBadge } from '@shared/ui/components'
import { formatRoomName } from '@shared/utils'
import { useGlobalStore } from '@store/global'
import { useQueueStore } from '@store/queue'

type RoomServiceReference = NonNullable<Room['serviceTypes']>[number] | NonNullable<Room['services']>[number]

function getRoomServiceRecordName(
  service: RoomServiceReference,
  language: SmartQLanguage,
  serviceTypeById: Map<string, string>,
): string {
  if (typeof service === 'string' || typeof service === 'number') {
    return serviceTypeById.get(String(service)) ?? ''
  }

  const serviceId = String(service.serviceTypeId ?? service.id ?? service._id ?? '')
  const translatedName = service.translations?.[language]

  return serviceTypeById.get(serviceId)
    ?? translatedName
    ?? service.name
    ?? service.title
    ?? ''
}

function getRoomServiceNames(
  room?: Room,
  serviceTypes: TicketSettingsServiceTypeOption[] = [],
  language: SmartQLanguage = 'ru',
): string[] {
  if (!room) {
    return []
  }

  const serviceTypeById = new Map(serviceTypes.map((serviceType) => [
    String(serviceType.id),
    getServiceOptionLabel(serviceType, language),
  ]))
  const directServices = [...(room.serviceTypes ?? []), ...(room.services ?? [])]
    .map((service) => getRoomServiceRecordName(service, language, serviceTypeById))
    .filter(Boolean)

  const serviceNames = [room.serviceTypeId, ...(room.serviceTypeIds ?? [])]
    .map((serviceTypeId) => serviceTypeById.get(String(serviceTypeId)))
    .filter((name): name is string => Boolean(name))

  return Array.from(new Set([...directServices, ...serviceNames]))
}

function hasConfiguredServices(room: Room): boolean {
  const serviceIds = [
    ...(room.serviceTypeIds ?? []),
    ...(room.services ?? []).map((service) => (
      typeof service === 'object'
        ? service.id ?? service.serviceTypeId ?? service.name ?? service.title
        : service
    )),
    ...(room.serviceTypes ?? []).map((service) => (
      typeof service === 'object'
        ? service.id ?? service.serviceTypeId ?? service.name ?? service.title
        : service
    )),
  ].filter((serviceId) => serviceId !== undefined && serviceId !== null && String(serviceId).trim() !== '')

  return Boolean(room.serviceTypeId) || serviceIds.length > 0
}

function SpecialistUserSummary({
  language,
  room,
  serviceTypes,
  user,
}: {
  language: SmartQLanguage
  room: Room
  serviceTypes: TicketSettingsServiceTypeOption[]
  user: User
}) {
  const roomServiceNames = getRoomServiceNames(room, serviceTypes, language)

  return (
    <div>
      <span className="eyebrow">{t.specialist.currentSpecialist}</span>
      <h2>{user.name}</h2>
      <dl className="specialist-doctor-details">
        <div>
          <dt>{t.specialist.fullName}</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>{t.specialist.servicePlace}</dt>
          <dd>{formatRoomName(room)}</dd>
        </div>
        <div>
          <dt>{t.specialist.specialty}</dt>
          <dd>{user.department || '-'}</dd>
        </div>
      </dl>
      <div className="specialist-room-services">
        <span>Услуги кабинета</span>
        <p>{roomServiceNames.length > 0 ? roomServiceNames.join(', ') : 'У кабинета не настроены услуги'}</p>
      </div>
    </div>
  )
}

function getUserRoomIds(user?: User | null): string[] {
  if (!user) {
    return []
  }

  return Array.from(new Set([
    user.roomId,
    user.assignedRoomId,
    ...(user.roomIds ?? []),
    ...(user.assignedRoomIds ?? []),
  ].filter((roomId): roomId is string => Boolean(roomId))))
}

function SpecialistRoomSelect({
  onChange,
  roomId,
  rooms,
}: {
  onChange: (roomId: string) => void
  roomId: string
  rooms: Room[]
}) {
  if (rooms.length <= 1) {
    return null
  }

  return (
    <label className="field specialist-room-select">
      <span>{t.tickets.room}</span>
      <select onChange={(event) => onChange(event.target.value)} value={roomId}>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {formatRoomName(room)}
          </option>
        ))}
      </select>
    </label>
  )
}

function SpecialistRoomToggle({ onChanged, room }: { onChanged: (room: Room) => Promise<void>; room: Room }) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const issueClosed = (room.ticketIssueEnabled ?? room.isTicketIssueEnabled ?? room.kioskEnabled) === false

  async function handleToggleRoom() {
    setError(null)
    setSaving(true)

    try {
      if (issueClosed && !hasConfiguredServices(room)) {
        setError(t.specialist.roomHasNoServices)
        return
      }

      const nextIssueEnabled = issueClosed
      await adminService.updateRoomTicketIssue(room.id, nextIssueEnabled)
      await onChanged({
        ...room,
        isTicketIssueEnabled: nextIssueEnabled,
        ticketIssueEnabled: nextIssueEnabled,
      })
    } catch (toggleError) {
      console.error('Specialist room toggle failed', toggleError)
      setError(issueClosed ? t.specialist.openTicketIssueError : t.specialist.closeTicketIssueError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="specialist-room-toggle">
      <Button
        disabled={saving}
        icon={issueClosed ? <Power size={18} /> : <PowerOff size={18} />}
        onClick={handleToggleRoom}
        variant={issueClosed ? 'primary' : 'danger'}
      >
          {issueClosed
            ? saving ? t.specialist.enablingTicketIssue : t.specialist.enableTicketIssue
            : saving ? t.specialist.closingTicketIssue : t.specialist.closeTicketIssue}
      </Button>
      {error ? <div className="modal-error">{error}</div> : null}
    </div>
  )
}

export function SpecialistPanelPage() {
  const language = useLanguage()
  const [roomOverride, setRoomOverride] = useState<Room | null>(null)
  const [roomStatusChecked, setRoomStatusChecked] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [serviceTypes, setServiceTypes] = useState<TicketSettingsServiceTypeOption[]>([])
  const user = useGlobalStore((state) => state.user)
  const hydrated = useQueueStore((state) => state.hydrated)
  const loadRoomNoShowTickets = useQueueStore((state) => state.loadRoomNoShowTickets)
  const loadRoomPostponedTickets = useQueueStore((state) => state.loadRoomPostponedTickets)
  const loadRoomQueue = useQueueStore((state) => state.loadRoomQueue)
  const loading = useQueueStore((state) => state.loading)
  const rooms = useQueueStore((state) => state.rooms)
  const specialistRoomIds = useMemo(() => getUserRoomIds(user), [user])
  const specialistRoomId = specialistRoomIds.includes(selectedRoomId)
    ? selectedRoomId
    : specialistRoomIds[0]
  const storeRoom = rooms.find((item) => item.id === specialistRoomId)
  const assignedRooms = specialistRoomIds
    .map((roomId) => rooms.find((item) => item.id === roomId))
    .filter((item): item is Room => Boolean(item))
  const room = storeRoom
    ? roomOverride && roomOverride.id === storeRoom.id
      ? { ...storeRoom, ...roomOverride }
      : storeRoom
    : roomOverride?.id === specialistRoomId
      ? roomOverride
      : undefined
  const roomInactive = room?.isActive === false || room?.status === 'paused'

  useEffect(() => {
    if (!specialistRoomIds.length) {
      setSelectedRoomId('')
      return
    }

    if (!specialistRoomIds.includes(selectedRoomId)) {
      setSelectedRoomId(specialistRoomIds[0])
    }
  }, [selectedRoomId, specialistRoomIds])

  async function refreshSpecialistRoom(nextRoom?: Room) {
    if (nextRoom) {
      setRoomOverride(nextRoom)
    }

    if (specialistRoomId) {
      await Promise.all([
        loadRoomQueue(specialistRoomId),
        loadRoomNoShowTickets(specialistRoomId),
        loadRoomPostponedTickets(specialistRoomId),
      ])
    }
  }

  useEffect(() => {
    if (!specialistRoomId) {
      setRoomStatusChecked(false)
      return
    }

    let active = true
    const roomId = specialistRoomId

    setRoomStatusChecked(false)

    async function refreshRoomQueue(silent = false) {
      await Promise.all([
        loadRoomQueue(roomId, { silent }),
        loadRoomNoShowTickets(roomId, { silent }),
        loadRoomPostponedTickets(roomId, { silent }),
      ])

      if (active) {
        setRoomStatusChecked(true)
      }
    }

    void refreshRoomQueue()
    const interval = window.setInterval(() => {
      void refreshRoomQueue(true)
    }, 5_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [loadRoomNoShowTickets, loadRoomPostponedTickets, loadRoomQueue, specialistRoomId])

  useEffect(() => {
    let active = true

    const loadServiceTypes = () => {
      ticketService
        .getTicketSettingsOptions()
        .then((options) => {
          if (active) {
            setServiceTypes(options.serviceTypes)
          }
        })
        .catch((loadError) => {
          console.error('Specialist service types load failed', loadError)
          if (active) {
            setServiceTypes([])
          }
        })
    }

    loadServiceTypes()
    const unsubscribe = subscribeServiceTypesChanged(loadServiceTypes)

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (!user) {
    return null
  }

  if (!room) {
    if (specialistRoomId && (loading || !hydrated || !roomStatusChecked)) {
      return (
        <section className="empty-state">
          <span className="eyebrow">{t.specialist.panel}</span>
          <h1>{t.specialist.loadingData}</h1>
          <p>{t.specialist.checkingRoomStatus}</p>
        </section>
      )
    }

    return (
      <section className="empty-state">
        <span className="eyebrow">{t.specialist.panel}</span>
        <h1>{specialistRoomId ? t.specialist.inactiveRoomTitle : t.specialist.noRoomAssigned}</h1>
        <p>{specialistRoomId ? t.specialist.inactiveRoomDescription : t.specialist.assignRoom}</p>
      </section>
    )
  }

  return (
    <div className="page-stack">
      <section className="specialist-header">
        <SpecialistUserSummary language={language} room={room} serviceTypes={serviceTypes} user={user} />
        <div className="specialist-header-actions">
          <SpecialistRoomSelect
            onChange={(nextRoomId) => {
              setRoomOverride(null)
              setSelectedRoomId(nextRoomId)
            }}
            roomId={specialistRoomId}
            rooms={assignedRooms}
          />
          <StatusBadge
            label={roomInactive ? t.specialist.ticketIssueStopped : t.status[room.status]}
            tone={roomInactive ? 'warning' : 'success'}
          />
          {user.canManageTicketIssue !== false ? (
            <SpecialistRoomToggle onChanged={refreshSpecialistRoom} room={room} />
          ) : null}
        </div>
      </section>
      {roomInactive ? (
        <div className="modal-info">
          {t.specialist.inactiveRoomNotice}
        </div>
      ) : null}
      <SpecialistControls room={room} />
    </div>
  )
}
