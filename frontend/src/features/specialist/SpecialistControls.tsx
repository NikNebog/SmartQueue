import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, FastForward, PauseCircle, Play, RotateCcw, Shuffle, UserX, X } from 'lucide-react'
import { ticketService } from '@services/ticketService'
import type { TicketSettingsOptions } from '@services/api'
import type { RedirectTicketInput, Room, Ticket, TicketPriority } from '@shared/types'
import { t } from '@shared/locales/useLocale'
import { Button, TicketCard } from '@shared/ui/components'
import {
  formatRoomName,
  getAverageServiceDurationStats,
  getPriorityMeta,
  useCurrentTime,
} from '@shared/utils'
import { useQueueStore } from '@store/queue'
import {
  getAutoRoomForService,
  getRoomsForService,
  getServiceOptionLabel,
  getServiceTypes,
} from '@features/tickets/ticketFormOptions'

type SpecialistControlsProps = {
  room: Room
}

const priorityOrder: Record<TicketPriority, number> = {
  critical: 0,
  high: 1,
  above_normal: 2,
  normal: 3,
  low: 4,
}

const specialistVisibleStatuses = ['waiting', 'called', 'in_service', 'redirected'] as const

const emptyTicketSettingsOptions: TicketSettingsOptions = {
  rooms: [],
  serviceTypes: [],
  specialists: [],
}

function normalizeId(value?: string | number | null): string {
  return value == null ? '' : String(value)
}

function isCriticalTicket(ticket: Ticket): boolean {
  return ticket.priority === 'critical' || getPriorityMeta(ticket.priority).label.toLowerCase() === 'критический'
}

type RedirectPatientModalProps = {
  fallbackRooms: Room[]
  onClose: () => void
  onRedirect: (input: RedirectTicketInput) => Promise<void>
  open: boolean
  ticket: Ticket | null
  tickets: Ticket[]
}

function RedirectPatientModal({
  fallbackRooms,
  onClose,
  onRedirect,
  open,
  ticket,
  tickets,
}: RedirectPatientModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [note, setNote] = useState('')
  const [options, setOptions] = useState<TicketSettingsOptions>(emptyTicketSettingsOptions)
  const [saving, setSaving] = useState(false)
  const [serviceTypeId, setServiceTypeId] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setNote('')
    setOptions(emptyTicketSettingsOptions)
    setSaving(false)
    setServiceTypeId('')
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true

    setLoadingOptions(true)
    ticketService
      .getTicketSettingsOptions()
      .then((nextOptions) => {
        if (active) {
          setOptions(nextOptions)
        }
      })
      .catch((loadError) => {
        console.error('Redirect options load failed', loadError)
        if (active) {
          setError(t.specialist.redirectOptionsLoadError)
          setOptions(emptyTicketSettingsOptions)
        }
      })
      .finally(() => {
        if (active) {
          setLoadingOptions(false)
        }
      })

    return () => {
      active = false
    }
  }, [open])

  const serviceTypes = useMemo(() => getServiceTypes(options), [options])
  const selectedServiceType = serviceTypes.find((serviceType) => String(serviceType.id) === serviceTypeId)
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
  const noRoomAvailable = Boolean(selectedServiceType && !autoRoom && !loadingOptions)
  const isBusy = saving || loadingOptions

  if (!open || !ticket) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!ticket) {
      return
    }

    if (!selectedServiceType) {
      setError(t.tickets.selectService)
      return
    }

    if (!autoRoom) {
      setError(t.tickets.noServicePlace)
      return
    }

    const trimmedNote = note.trim()

    setError(null)
    setSaving(true)

    try {
      await onRedirect({
        comment: trimmedNote || undefined,
        note: trimmedNote || undefined,
        reason: trimmedNote || t.specialist.redirectPatientReason,
        roomId: normalizeId(autoRoom.id),
        serviceTypeId: selectedServiceType.id,
        ticketId: ticket.id,
      })
      onClose()
    } catch (redirectError) {
      console.error('Redirect patient failed', redirectError)
      setError(t.specialist.redirectPatientError)
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
              <Shuffle size={14} />
              {t.specialist.redirect}
            </span>
            <h2>{t.specialist.redirectPatient}</h2>
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
        {!error && autoRoom ? (
          <div className="modal-info">{t.tickets.autoPlaceSelected}: {formatRoomName(autoRoom)}</div>
        ) : null}

        <div className="settings-form-grid">
          <label className="field service-type-field">
            <span>{t.specialist.newService}</span>
            <select
              disabled={isBusy || serviceTypes.length === 0}
              onChange={(event) => {
                setServiceTypeId(event.target.value)
                setError(null)
              }}
              value={serviceTypeId}
            >
              <option value="">{t.tickets.selectService}</option>
              {serviceTypes.map((serviceType) => (
                <option key={String(serviceType.id)} value={String(serviceType.id)}>
                  {getServiceOptionLabel(serviceType)}
                </option>
              ))}
            </select>
          </label>

          <label className="field settings-comment-field">
            <span>{t.tickets.note}</span>
            <input
              disabled={isBusy}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
        </div>

        <footer className="modal-actions">
          <Button disabled={saving} onClick={onClose} variant="ghost">
            {t.common.cancel}
          </Button>
          <Button disabled={isBusy || !selectedServiceType || !autoRoom} type="submit" variant="primary">
            {saving ? t.specialist.redirecting : t.specialist.redirect}
          </Button>
        </footer>
      </form>
    </div>
  )
}

export function SpecialistControls({ room }: SpecialistControlsProps) {
  const [returnError, setReturnError] = useState<string | null>(null)
  const [returningTicketId, setReturningTicketId] = useState<string | null>(null)
  const [postponingTicketId, setPostponingTicketId] = useState<string | null>(null)
  const [redirectTicketItem, setRedirectTicketItem] = useState<Ticket | null>(null)
  const [callingUrgentTicketId, setCallingUrgentTicketId] = useState<string | null>(null)
  const callNextTicket = useQueueStore((state) => state.callNextTicket)
  const completeService = useQueueStore((state) => state.completeService)
  const activeTickets = useQueueStore((state) => state.activeTickets)
  const loadRoomQueue = useQueueStore((state) => state.loadRoomQueue)
  const loading = useQueueStore((state) => state.loading)
  const noShowTickets = useQueueStore((state) => state.noShowTickets)
  const postponeTicket = useQueueStore((state) => state.postponeTicket)
  const postponedTickets = useQueueStore((state) => state.postponedTickets)
  const redirectTicket = useQueueStore((state) => state.redirectTicket)
  const returnTicket = useQueueStore((state) => state.returnTicket)
  const rooms = useQueueStore((state) => state.rooms)
  const skipTicket = useQueueStore((state) => state.skipTicket)
  const startService = useQueueStore((state) => state.startService)
  const tickets = useQueueStore((state) => state.tickets)
  const now = useCurrentTime()

  const roomTickets = useMemo(
    () =>
      activeTickets.filter((ticket) =>
        String(ticket.roomId) === String(room.id) &&
        specialistVisibleStatuses.includes(ticket.status as (typeof specialistVisibleStatuses)[number]),
      ),
    [activeTickets, room.id],
  )

  const currentTicket = useMemo<Ticket | undefined>(
    () =>
      roomTickets.find(
        (ticket) =>
          ticket.id === room.currentTicketId &&
          ['called', 'in_service'].includes(ticket.status),
      ) ??
      roomTickets.find((ticket) => ['called', 'in_service'].includes(ticket.status)),
    [room.currentTicketId, roomTickets],
  )

  const waitingTickets = useMemo(
    () =>
      roomTickets
        .filter(
          (ticket) =>
            ticket.status === 'waiting' ||
            ticket.status === 'redirected',
        )
        .sort((left, right) => {
          const priorityDelta = priorityOrder[left.priority] - priorityOrder[right.priority]
          if (priorityDelta !== 0) return priorityDelta
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        }),
    [roomTickets],
  )
  const roomNoShowTickets = useMemo(
    () =>
      noShowTickets
        .filter((ticket) => String(ticket.roomId) === String(room.id))
        .filter((ticket) => ticket.status === 'no_show')
        .sort((left, right) => {
          const leftDate = left.updatedAt ?? left.calledAt ?? left.createdAt
          const rightDate = right.updatedAt ?? right.calledAt ?? right.createdAt

          return new Date(rightDate).getTime() - new Date(leftDate).getTime()
        }),
    [noShowTickets, room.id],
  )
  const roomPostponedTickets = useMemo(
    () =>
      postponedTickets
        .filter((ticket) => String(ticket.roomId) === String(room.id))
        .filter((ticket) => ticket.status === 'postponed')
        .sort((left, right) => {
          const leftDate = left.updatedAt ?? left.calledAt ?? left.createdAt
          const rightDate = right.updatedAt ?? right.calledAt ?? right.createdAt

          return new Date(rightDate).getTime() - new Date(leftDate).getTime()
        }),
    [postponedTickets, room.id],
  )
  const handleReturnTicket = async (ticketId: string) => {
    setReturnError(null)
    setReturningTicketId(ticketId)

    try {
      await returnTicket(ticketId, room.id)
    } catch (error) {
      console.error('Specialist return ticket failed', error)
      setReturnError(
        error instanceof Error ? error.message : t.specialist.returnPatientError,
      )
    } finally {
      setReturningTicketId(null)
    }
  }

  const handlePostponeTicket = async (ticketId: string) => {
    setReturnError(null)
    setPostponingTicketId(ticketId)

    try {
      await postponeTicket(ticketId)
    } catch (error) {
      console.error('Specialist postpone ticket failed', error)
      setReturnError(t.specialist.postponePatientError)
    } finally {
      setPostponingTicketId(null)
    }
  }

  const handleRedirectTicket = async (input: RedirectTicketInput) => {
    await redirectTicket(input)
  }

  const openRedirectModal = (ticket: Ticket) => {
    setRedirectTicketItem(ticket)
  }

  const handleCallUrgentTicket = async (ticket: Ticket) => {
    if (ticket.status !== 'waiting' || String(ticket.roomId) !== String(room.id) || !isCriticalTicket(ticket)) {
      return
    }

    setCallingUrgentTicketId(ticket.id)
    setReturnError(null)

    try {
      await ticketService.callTicket(ticket.id)
      await loadRoomQueue(room.id)
    } catch (error) {
      console.error('Specialist urgent call failed', error)
      setReturnError(t.specialist.urgentCallError)
    } finally {
      setCallingUrgentTicketId(null)
    }
  }

  return (
    <div className="specialist-workspace">
      <section className="specialist-panel specialist-current-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{room.department}</span>
            <h2>{formatRoomName(room)}</h2>
          </div>
          <Button
            disabled={loading || Boolean(currentTicket) || waitingTickets.length === 0}
            icon={<FastForward size={18} />}
            onClick={() => void callNextTicket(room.id)}
            variant="primary"
          >
            {t.specialist.callNext}
          </Button>
        </div>

        {currentTicket ? (
          <TicketCard
            actionSlot={
              <div className="button-row">
                {currentTicket.status === 'called' ? (
                  <>
                    <Button disabled={loading} icon={<Play size={17} />} onClick={() => void startService(currentTicket.id)} variant="secondary">
                      {t.specialist.startService}
                    </Button>
                    <Button disabled={loading} icon={<UserX size={17} />} onClick={() => void skipTicket(currentTicket.id)} variant="danger">
                      {t.specialist.noShow}
                    </Button>
                    <Button
                      disabled={loading || postponingTicketId === currentTicket.id}
                      icon={<PauseCircle size={17} />}
                      onClick={() => void handlePostponeTicket(currentTicket.id)}
                      variant="secondary"
                    >
                      {postponingTicketId === currentTicket.id ? t.specialist.postponingTicket : t.specialist.postponeTicket}
                    </Button>
                    <Button disabled={loading} icon={<Shuffle size={17} />} onClick={() => openRedirectModal(currentTicket)} variant="secondary">
                      {t.specialist.redirectPatient}
                    </Button>
                  </>
                ) : null}
                {currentTicket.status === 'in_service' ? (
                  <>
                    <Button disabled={loading} icon={<CheckCircle2 size={17} />} onClick={() => void completeService(currentTicket.id)} variant="primary">
                      {t.specialist.complete}
                    </Button>
                    <Button
                      disabled={loading || postponingTicketId === currentTicket.id}
                      icon={<PauseCircle size={17} />}
                      onClick={() => void handlePostponeTicket(currentTicket.id)}
                      variant="secondary"
                    >
                      {postponingTicketId === currentTicket.id ? t.specialist.postponingTicket : t.specialist.postponeTicket}
                    </Button>
                    <Button disabled={loading} icon={<Shuffle size={17} />} onClick={() => openRedirectModal(currentTicket)} variant="secondary">
                      {t.specialist.redirectPatient}
                    </Button>
                  </>
                ) : null}
              </div>
            }
            now={now}
            room={room}
            ticket={currentTicket}
          />
        ) : (
          <div className="empty-state compact-empty">
            <span className="eyebrow">{t.specialist.ready}</span>
            <h2>{t.specialist.noActivePatient}</h2>
          </div>
        )}
      </section>

      <aside className="specialist-panel specialist-waiting-panel">
        <section className="specialist-side-section">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{t.specialist.nextPatients}</span>
              <h2>{t.specialist.waitingList}</h2>
            </div>
            <strong className="waiting-count">{waitingTickets.length}</strong>
          </div>

          {waitingTickets.length > 0 ? (
            <div className="specialist-waiting-list">
              {waitingTickets.map((ticket) => (
                <div
                  className={isCriticalTicket(ticket) ? 'critical-ticket-frame' : undefined}
                  key={ticket.id}
                >
                  <TicketCard
                    actionSlot={
                      isCriticalTicket(ticket) && ticket.status === 'waiting' ? (
                        <div className="button-row">
                          <Button
                            disabled={loading || callingUrgentTicketId === ticket.id}
                            icon={<FastForward size={17} />}
                            onClick={() => void handleCallUrgentTicket(ticket)}
                            variant="primary"
                          >
                            {callingUrgentTicketId === ticket.id ? t.specialist.calling : t.specialist.callOutOfTurn}
                          </Button>
                        </div>
                      ) : null
                    }
                    compact
                    now={now}
                    room={room}
                    ticket={ticket}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h2>{t.specialist.waitingListEmpty}</h2>
            </div>
          )}
        </section>

        <section className="specialist-side-section">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{t.specialist.returnPatientQueue}</span>
              <h2>{t.specialist.noShowPatients}</h2>
            </div>
            <strong className="waiting-count">{roomNoShowTickets.length}</strong>
          </div>

          {returnError ? <div className="modal-error">{returnError}</div> : null}

          {roomNoShowTickets.length > 0 ? (
            <div className="specialist-waiting-list">
              {roomNoShowTickets.map((ticket) => (
                <TicketCard
                  actionSlot={
                    <div className="button-row">
                      <Button
                        disabled={loading || returningTicketId === ticket.id}
                        icon={<RotateCcw size={17} />}
                        onClick={() => void handleReturnTicket(ticket.id)}
                        variant="secondary"
                      >
                        {t.specialist.returnPatient}
                      </Button>
                    </div>
                  }
                  compact
                  key={ticket.id}
                  now={now}
                  room={room}
                  ticket={ticket}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h2>{t.specialist.noShowListEmpty}</h2>
            </div>
          )}
        </section>

        <section className="specialist-side-section">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{t.specialist.postponedPatientQueue}</span>
              <h2>{t.specialist.postponedPatients}</h2>
            </div>
            <strong className="waiting-count">{roomPostponedTickets.length}</strong>
          </div>

          {roomPostponedTickets.length > 0 ? (
            <div className="specialist-waiting-list">
              {roomPostponedTickets.map((ticket) => (
                <TicketCard
                  actionSlot={
                    <div className="button-row">
                      <Button
                        disabled={loading || returningTicketId === ticket.id}
                        icon={<RotateCcw size={17} />}
                        onClick={() => void handleReturnTicket(ticket.id)}
                        variant="secondary"
                      >
                        {t.specialist.returnPatient}
                      </Button>
                    </div>
                  }
                  compact
                  key={ticket.id}
                  now={now}
                  room={room}
                  ticket={ticket}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h2>{t.specialist.postponedListEmpty}</h2>
            </div>
          )}
        </section>
      </aside>
      <RedirectPatientModal
        fallbackRooms={rooms}
        onClose={() => setRedirectTicketItem(null)}
        onRedirect={handleRedirectTicket}
        open={Boolean(redirectTicketItem)}
        ticket={redirectTicketItem}
        tickets={tickets}
      />
    </div>
  )
}
