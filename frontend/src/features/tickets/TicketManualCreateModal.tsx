import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import { ticketService } from '@services/ticketService'
import type {
  TicketCreateSettingsPayload,
  TicketSettingsOptions,
} from '@services/api'
import type {
  Room,
  ServiceType,
  Ticket,
  TicketPriority,
} from '@shared/types'
import { useLocale } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'
import {
  formatRoomName,
  formatPeopleAhead,
  getAverageServiceDurationStats,
  getRoomQueuePeopleAhead,
} from '@shared/utils'
import {
  getAutoRoomForService,
  getAutoSpecialistForRoom,
  getPriorityLabel,
  getRoomsForService,
  getServiceOptionLabel,
  getServiceTypes,
  ticketPriorities,
} from './ticketFormOptions'

type TicketManualCreateModalProps = {
  fallbackRooms: Room[]
  onClose: () => void
  onSaved: () => Promise<void>
  open: boolean
  tickets: Ticket[]
}

const emptyOptions: TicketSettingsOptions = {
  rooms: [],
  serviceTypes: [],
  specialists: [],
}

function normalizeId(value?: string | number | null): string {
  return value == null ? '' : String(value)
}

export function TicketManualCreateModal({
  fallbackRooms,
  onClose,
  onSaved,
  open,
  tickets,
}: TicketManualCreateModalProps) {
  const t = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [note, setNote] = useState('')
  const [options, setOptions] = useState<TicketSettingsOptions>(emptyOptions)
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [saving, setSaving] = useState(false)
  const [serviceTypeId, setServiceTypeId] = useState('')

  const loadOptions = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoadingOptions(true)
    }

    try {
      setOptions(await ticketService.getTicketSettingsOptions())
    } catch (loadError) {
      console.error('Ticket create options load failed', loadError)
      setOptions(emptyOptions)
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setNote('')
    setPriority('normal')
    setSaving(false)
    setServiceTypeId('')
  }, [open])

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

  const serviceTypes = useMemo(() => getServiceTypes(options), [options])
  const selectedServiceType = serviceTypes.find((item) => String(item.id) === serviceTypeId) ?? serviceTypes[0]
  const rooms = useMemo(
    () => getRoomsForService(options, selectedServiceType?.id, fallbackRooms),
    [fallbackRooms, options, selectedServiceType?.id],
  )
  const autoRoom = useMemo(
    () => getAutoRoomForService(
      rooms,
      fallbackRooms,
      tickets,
      getAverageServiceDurationStats(tickets, selectedServiceType?.id, selectedServiceType?.code).averageMinutes,
    ),
    [fallbackRooms, rooms, selectedServiceType?.code, selectedServiceType?.id, tickets],
  )
  const autoDoctor = useMemo(
    () => autoRoom ? getAutoSpecialistForRoom(autoRoom.id, options.specialists) : undefined,
    [autoRoom, options.specialists],
  )
  const noRoomAvailable = Boolean(selectedServiceType && !autoRoom && !loadingOptions)
  const noDoctorAssigned = Boolean(autoRoom && !autoDoctor && !loadingOptions)
  const peopleAhead = useMemo(
    () => getRoomQueuePeopleAhead(autoRoom?.id, tickets),
    [autoRoom?.id, tickets],
  )
  const canCreateTicket = Boolean(selectedServiceType && autoRoom && priority)

  useEffect(() => {
    const hasSelectedServiceType = serviceTypes.some(
      (serviceType) => String(serviceType.id) === serviceTypeId,
    )

    if (open && serviceTypes[0] && !hasSelectedServiceType) {
      setServiceTypeId(String(serviceTypes[0].id))
    }
  }, [open, serviceTypeId, serviceTypes])

  if (!open) {
    return null
  }

  const isBusy = saving || loadingOptions

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedServiceType) {
      setError(t.tickets.selectService)
      return
    }

    if (!autoRoom) {
      setError(t.tickets.noServicePlace)
      return
    }

    const trimmedNote = note.trim()
    const payload: TicketCreateSettingsPayload = {
      comment: trimmedNote || undefined,
      doctorId: normalizeId(autoDoctor?.id) || undefined,
      note: trimmedNote || undefined,
      priority,
      roomId: normalizeId(autoRoom.id),
      serviceType: selectedServiceType.code ?? (serviceTypeId as ServiceType),
      serviceTypeId: selectedServiceType.id,
      status: 'waiting',
    }

    setError(null)
    setSaving(true)

    try {
      await ticketService.createTicketWithSettings(payload)
      onClose()
      await onSaved()
    } catch (saveError) {
      console.error('Manual ticket create failed', saveError)
      setError(t.tickets.createError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <form className="ticket-settings-modal" onSubmit={handleSubmit}>
        <header className="modal-header">
          <div>
            <h2>{t.tickets.createTicket}</h2>
          </div>
          <button
            aria-label={t.common.cancel}
            className="modal-close"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {error ? <div className="modal-error">{error}</div> : null}
        {!error && noRoomAvailable ? (
          <div className="modal-error">{t.tickets.noServicePlace}</div>
        ) : null}
        {!error && noDoctorAssigned ? (
          <div className="modal-info">{t.tickets.autoPlaceNoSpecialist}</div>
        ) : null}
        {!error && autoRoom ? (
          <div className="modal-info">
            {t.tickets.autoPlaceSelected}: {formatRoomName(autoRoom)}. {formatPeopleAhead(peopleAhead)}.
          </div>
        ) : null}

        <div className="settings-form-grid">
          <label className="field service-type-field">
            <span>{t.tickets.serviceType}</span>
            <select
              disabled={isBusy}
              onChange={(event) => {
                setServiceTypeId(event.target.value)
                setError(null)
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
            <span>{t.tickets.priority}</span>
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

          <label className="field settings-comment-field">
            <span>{t.tickets.note}</span>
            <input
              disabled={isBusy}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t.tickets.notePlaceholder}
              value={note}
            />
          </label>
        </div>

        <footer className="modal-actions">
          <Button disabled={saving} onClick={onClose} variant="ghost">
            {t.common.cancel}
          </Button>
          <Button disabled={isBusy || !canCreateTicket} type="submit" variant="primary">
            {saving ? t.tickets.creating : t.tickets.create}
          </Button>
        </footer>
      </form>
    </div>
  )
}
