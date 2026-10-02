import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClipboardPlus } from 'lucide-react'
import { ticketService } from '@services/ticketService'
import { subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import type { TicketSettingsOptions } from '@services/api'
import type { Room, Ticket, TicketCreateInput, TicketPriority } from '@shared/types'
import { useLocale } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'
import {
  formatPeopleAhead,
  formatRoomName,
  getAverageServiceDurationStats,
  getPriorityMeta,
  getRoomQueuePeopleAhead,
} from '@shared/utils'
import {
  getAutoRoomForService,
  getRoomsForService,
  getServiceOptionLabel,
  getServiceTypes,
} from './ticketFormOptions'

const priorities: TicketPriority[] = ['low', 'normal', 'high', 'critical']

type TicketCreateFormProps = {
  fallbackRooms?: Room[]
  loading: boolean
  onSubmit: (input: TicketCreateInput) => Promise<void>
  tickets?: Ticket[]
}

const emptyOptions: TicketSettingsOptions = {
  rooms: [],
  serviceTypes: [],
  specialists: [],
}

export function TicketCreateForm({
  fallbackRooms = [],
  loading,
  onSubmit,
  tickets = [],
}: TicketCreateFormProps) {
  const t = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [options, setOptions] = useState<TicketSettingsOptions>(emptyOptions)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [notes, setNotes] = useState('')
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
  const peopleAhead = useMemo(
    () => getRoomQueuePeopleAhead(autoRoom?.id, tickets),
    [autoRoom?.id, tickets],
  )
  const canCreateTicket = Boolean(selectedServiceType && autoRoom && priority)

  const loadOptions = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setOptionsLoading(true)
    }
    setError(null)

    try {
      setOptions(await ticketService.getTicketSettingsOptions())
    } catch (loadError) {
      console.error('Ticket create options load failed', loadError)
      setOptions(emptyOptions)
      setError(t.tickets.loadOptionsError)
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => subscribeServiceTypesChanged(() => {
    void loadOptions(false)
  }), [loadOptions])

  useEffect(() => {
    if (!serviceTypeId && serviceTypes[0]) {
      setServiceTypeId(String(serviceTypes[0].id))
    }
  }, [serviceTypeId, serviceTypes])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!selectedServiceType) {
      setError(t.tickets.selectService)
      return
    }

    if (!autoRoom) {
      setError(t.tickets.noServicePlace)
      return
    }

    await onSubmit({
      patientName: patientName.trim() || 'Пациент',
      priority,
      roomId: autoRoom.id,
      serviceType: selectedServiceType.code,
      serviceTypeId: selectedServiceType.id,
      notes: notes.trim() || undefined,
    })

    setPatientName('')
    setNotes('')
    setPriority('normal')
    setServiceTypeId(String(serviceTypes[0]?.id ?? ''))
  }

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>{t.tickets.patientName}</span>
        <input
          onChange={(event) => setPatientName(event.target.value)}
          placeholder={t.tickets.patientNamePlaceholder}
          value={patientName}
        />
      </label>

      <div className="form-grid">
        <label className="field service-type-field">
          <span>{t.tickets.serviceType}</span>
          <select
            disabled={loading || optionsLoading || serviceTypes.length === 0}
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
            onChange={(event) => setPriority(event.target.value as TicketPriority)}
            value={priority}
          >
            {priorities.map((item) => (
              <option key={item} value={item}>
                {getPriorityMeta(item).label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedServiceType && autoRoom ? (
        <div className="modal-info">
          {t.tickets.autoPlaceSelected}: {formatRoomName(autoRoom)}. {formatPeopleAhead(peopleAhead)}.
        </div>
      ) : null}
      {selectedServiceType && !autoRoom && !optionsLoading ? (
        <div className="modal-error">{t.tickets.noServicePlace}</div>
      ) : null}

      <label className="field">
        <span>{t.tickets.notes}</span>
        <textarea
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t.tickets.notesPlaceholder}
          rows={4}
          value={notes}
        />
      </label>

      {error ? <div className="modal-error">{error}</div> : null}

      <Button
        disabled={loading || optionsLoading || !canCreateTicket}
        icon={<ClipboardPlus size={18} />}
        type="submit"
        variant="primary"
      >
        {t.tickets.createTicket}
      </Button>
    </form>
  )
}
