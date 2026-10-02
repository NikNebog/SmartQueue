import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Settings, X } from 'lucide-react'
import { subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import { ticketService } from '@services/ticketService'
import type {
  TicketSettingsOptions,
  TicketSettingsPayload,
} from '@services/api'
import type {
  Room,
  ServiceType,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '@shared/types'
import {
  formatWaitingTime,
  formatRoomName,
  getServiceTypeLabel,
  getWaitingMinutes,
  useCurrentTime,
} from '@shared/utils'
import { Button } from '@shared/ui/components'
import {
  getPriorityLabel,
  getRoomsForService,
  getServiceOptionLabel,
  getServiceTypes,
  getSpecialistsForRoom,
  getStatusLabel,
  ticketPriorities,
  ticketStatuses,
} from './ticketFormOptions'

type TicketSettingsModalProps = {
  fallbackRooms: Room[]
  onClose: () => void
  onSaved: () => Promise<void>
  open: boolean
  ticket?: Ticket
}

const emptyOptions: TicketSettingsOptions = {
  rooms: [],
  serviceTypes: [],
  specialists: [],
}

function getFallbackServiceType(ticket: Ticket) {
  return {
    code: ticket.serviceType,
    id: ticket.serviceTypeId ?? ticket.serviceType,
    name: getServiceTypeLabel(ticket.serviceType),
  }
}

function getEditableStatus(status: TicketStatus): TicketStatus {
  return status === 'created' ? 'waiting' : status
}

export function TicketSettingsModal({
  fallbackRooms,
  onClose,
  onSaved,
  open,
  ticket,
}: TicketSettingsModalProps) {
  const [comment, setComment] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [etaMinutes, setEtaMinutes] = useState(0)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [options, setOptions] = useState<TicketSettingsOptions>(emptyOptions)
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [roomId, setRoomId] = useState('')
  const [saving, setSaving] = useState(false)
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [status, setStatus] = useState<TicketStatus>('waiting')
  const now = useCurrentTime()

  const loadOptions = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoadingOptions(true)
    }

    try {
      setOptions(await ticketService.getTicketSettingsOptions())
    } catch (loadError) {
      console.error('Ticket settings options load failed', loadError)
      setOptions(emptyOptions)
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !ticket) {
      return
    }

    setComment(ticket.notes ?? '')
    setDoctorId(ticket.assignedTo ?? '')
    setEtaMinutes(ticket.etaMinutes)
    setError(null)
    setPriority(ticket.priority)
    setRoomId(ticket.roomId ?? '')
    setServiceTypeId(String(ticket.serviceTypeId ?? ticket.serviceType))
    setStatus(getEditableStatus(ticket.status))
  }, [open, ticket])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadOptions()
  }, [loadOptions, open])

  useEffect(() => subscribeServiceTypesChanged(() => {
    if (open) {
      void loadOptions(false)
    }
  }), [loadOptions, open])

  const serviceTypes = useMemo(() => {
    if (!ticket) {
      return getServiceTypes(options)
    }

    const availableServiceTypes = getServiceTypes(options)
    const hasCurrent = availableServiceTypes.some((item) => item.code === ticket.serviceType)

    return hasCurrent ? availableServiceTypes : [getFallbackServiceType(ticket), ...availableServiceTypes]
  }, [options, ticket])

  useEffect(() => {
    if (!open || !ticket || serviceTypes.length === 0) {
      return
    }

    const currentServiceType = serviceTypes.find((item) => String(item.id) === ticket.serviceType)
      ?? serviceTypes.find((item) => item.code === ticket.serviceType)

    if (currentServiceType) {
      setServiceTypeId(String(currentServiceType.id))
    }
  }, [open, serviceTypes, ticket])

  const selectedServiceType = serviceTypes.find((item) => String(item.id) === serviceTypeId)
  const rooms = useMemo(
    () => getRoomsForService(options, selectedServiceType?.id, fallbackRooms),
    [fallbackRooms, options, selectedServiceType?.id],
  )

  const specialists = useMemo(() => {
    const availableSpecialists = getSpecialistsForRoom(options, roomId)

    if (!ticket?.assignedTo || availableSpecialists.some((item) => String(item.id) === ticket.assignedTo)) {
      return availableSpecialists
    }

    return [
      {
        id: ticket.assignedTo,
        name: 'Текущий специалист',
      },
      ...availableSpecialists,
    ]
  }, [options, roomId, ticket?.assignedTo])

  useEffect(() => {
    if (!open || !ticket) {
      return
    }

    setRoomId((currentRoomId) => (
      currentRoomId && rooms.some((room) => String(room.id) === currentRoomId)
        ? currentRoomId
        : ''
    ))
  }, [open, rooms, ticket])

  useEffect(() => {
    if (!open || !ticket) {
      return
    }

    setDoctorId((currentDoctorId) => (
      currentDoctorId && specialists.some((specialist) => String(specialist.id) === currentDoctorId)
        ? currentDoctorId
        : ''
    ))
  }, [open, specialists, ticket])

  if (!open || !ticket) {
    return null
  }

  const isBusy = saving || loadingOptions

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!ticket) {
      return
    }

    const payload: TicketSettingsPayload = {
      comment,
      doctorId: doctorId || undefined,
      etaMinutes,
      priority,
      roomId: roomId || undefined,
      serviceType: selectedServiceType?.code ?? (serviceTypeId as ServiceType),
      serviceTypeId: selectedServiceType?.id ?? serviceTypeId,
      status: getEditableStatus(status),
    }

    setError(null)
    setSaving(true)

    try {
      await ticketService.updateTicketSettings(ticket.id, payload)
      await onSaved()
      onClose()
    } catch (saveError) {
      console.error('Ticket settings save failed', saveError)
      setError('Не удалось сохранить настройки талона.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <form className="ticket-settings-modal" onSubmit={handleSubmit}>
        <header className="modal-header">
          <div>
            <span className="eyebrow">
              <Settings size={14} />
              Управление
            </span>
            <h2>Редактировать талон {ticket.number}</h2>
          </div>
          <button
            aria-label="Отмена"
            className="modal-close"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {error ? <div className="modal-error">{error}</div> : null}

        <div className="settings-form-grid">
          <label className="field service-type-field">
            <span>Номер талона</span>
            <input readOnly value={ticket.number} />
          </label>

          <label className="field">
            <span>Тип услуги</span>
            <select
              disabled={isBusy}
              onChange={(event) => {
                setServiceTypeId(event.target.value)
                setRoomId('')
                setDoctorId('')
              }}
              value={serviceTypeId}
            >
              {serviceTypes.map((serviceType) => (
                <option key={String(serviceType.id)} value={String(serviceType.id)}>
                  {getServiceOptionLabel(serviceType)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Место обслуживания</span>
            <select
              disabled={isBusy || rooms.length === 0}
              onChange={(event) => {
                setRoomId(event.target.value)
                setDoctorId('')
              }}
              value={roomId}
            >
              <option value="">Не назначен</option>
              {rooms.map((room) => (
                <option key={String(room.id)} value={String(room.id)}>
                  {formatRoomName(room)}
                </option>
              ))}
            </select>
            {selectedServiceType && rooms.length === 0 ? (
              <small className="field-hint">Нет доступных мест обслуживания для выбранной услуги</small>
            ) : null}
          </label>

          <label className="field">
            <span>Врач</span>
            <select
              disabled={isBusy}
              onChange={(event) => setDoctorId(event.target.value)}
              value={doctorId}
            >
              <option value="">Не назначен</option>
              {specialists.map((specialist) => (
                <option key={String(specialist.id)} value={String(specialist.id)}>
                  {specialist.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Приоритет</span>
            <select
              disabled={isBusy}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
              value={priority}
            >
              {ticketPriorities.map((item) => (
                <option key={item} value={item}>
                  {getPriorityLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Статус</span>
            <select
              disabled={isBusy}
              onChange={(event) => setStatus(event.target.value as TicketStatus)}
              value={status}
            >
              {ticketStatuses.map((item) => (
                <option key={item} value={item}>
                  {getStatusLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Фактическое ожидание</span>
            <input readOnly value={formatWaitingTime(getWaitingMinutes(ticket, now))} />
          </label>

          <label className="field">
            <span>Плановое ожидание, мин</span>
            <input
              disabled={isBusy}
              min={0}
              onChange={(event) => setEtaMinutes(Number(event.target.value))}
              type="number"
              value={etaMinutes}
            />
          </label>

          <label className="field settings-comment-field">
            <span>Комментарий</span>
            <textarea
              disabled={isBusy}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              value={comment}
            />
          </label>
        </div>

        <footer className="modal-actions">
          <Button disabled={saving} onClick={onClose} variant="ghost">
            Отмена
          </Button>
          <Button disabled={isBusy} type="submit" variant="primary">
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
