import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { TicketPrintPreview, type TicketPrintData } from '@features/tickets/TicketPrintPreview'
import {
  getAvailableServiceTypes,
  getAutoRoomForService,
  getRoomsForService,
  getServiceOptionLabel,
  getServiceTypes,
} from '@features/tickets/ticketFormOptions'
import { getAppInitials, useAppSettings } from '@services/appSettingsService'
import { adminService } from '@services/adminService'
import { kioskService } from '@services/kioskService'
import { subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import { ticketService } from '@services/ticketService'
import type { AdminTerminalRecord, TicketSettingsOptions, TicketSettingsRoomOption } from '@services/api'
import type { Ticket } from '@shared/types'
import { getLocale, useLanguage, useLocale } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'
import { LanguageSelect } from '@shared/ui/core-components'
import {
  formatPeopleAhead,
  formatRoomName,
  getAverageServiceDurationStats,
  getRoomQueuePeopleAhead,
  getTicketPeopleAhead,
} from '@shared/utils'
import { useQueueStore } from '@store/queue'

const emptyOptions: TicketSettingsOptions = {
  rooms: [],
  serviceTypes: [],
  specialists: [],
}
const kioskRefreshIntervalMs = 10_000

export function KioskPage() {
  const appSettings = useAppSettings()
  const language = useLanguage()
  const t = useLocale()
  const [searchParams] = useSearchParams()
  const terminalId = searchParams.get('terminalId') ?? ''
  const loadQueue = useQueueStore((state) => state.loadQueue)
  const queueRooms = useQueueStore((state) => state.rooms)
  const queueTickets = useQueueStore((state) => state.tickets)
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingTerminal, setLoadingTerminal] = useState(Boolean(terminalId))
  const [options, setOptions] = useState<TicketSettingsOptions>(emptyOptions)
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('')
  const [terminal, setTerminal] = useState<AdminTerminalRecord | null>(null)

  const loadTicketOptions = useCallback(async () => {
    const nextOptions = await ticketService.getTicketSettingsOptions()

    setOptions(nextOptions)

    return nextOptions
  }, [])

  useEffect(() => {
    let active = true

    setLoadingOptions(true)
    void loadQueue({ force: true, successMessage: 'Данные киоска обновлены' })
    loadTicketOptions()
      .then((nextOptions) => {
        if (active) {
          setOptions(nextOptions)
        }
      })
      .catch((loadError) => {
        console.error('Kiosk options load failed', loadError)
        if (active) {
          setOptions(emptyOptions)
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
  }, [loadQueue, loadTicketOptions])

  useEffect(() => subscribeServiceTypesChanged(() => {
    void loadQueue({ force: true, successMessage: 'Данные киоска обновлены' })
    void loadTicketOptions()
  }), [loadQueue, loadTicketOptions])

  useEffect(() => {
    let active = true

    async function refreshKioskData() {
      if (!active || document.hidden || createdTicket) {
        return
      }

      try {
        await Promise.all([
          loadQueue({ force: true, successMessage: '' }),
          loadTicketOptions(),
          terminalId
            ? adminService.getTerminals().then((terminals) => {
                if (active) {
                  setTerminal(terminals.find((item) => String(item.id) === terminalId) ?? null)
                }
              })
            : Promise.resolve(),
        ])
      } catch (refreshError) {
        console.error('Kiosk auto refresh failed', refreshError)
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshKioskData()
    }, kioskRefreshIntervalMs)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [createdTicket, loadQueue, loadTicketOptions, terminalId])

  useEffect(() => {
    let active = true

    if (!terminalId) {
      setTerminal(null)
      setLoadingTerminal(false)
      return () => {
        active = false
      }
    }

    setLoadingTerminal(true)
    adminService.getTerminals()
      .then((terminals) => {
        if (!active) return
        setTerminal(terminals.find((item) => String(item.id) === terminalId) ?? null)
      })
      .catch((terminalLoadError) => {
        console.error('Kiosk terminal load failed', terminalLoadError)
        if (active) {
          setTerminal(null)
        }
      })
      .finally(() => {
        if (active) {
          setLoadingTerminal(false)
        }
      })

    return () => {
      active = false
    }
  }, [terminalId])

  function filterTerminalRooms(rooms: TicketSettingsRoomOption[], nextTerminal: AdminTerminalRecord | null) {
    if (!terminalId) {
      return rooms
    }

    if (!nextTerminal?.active) {
      return []
    }

    const allowedRoomIds = new Set(nextTerminal.roomIds.map(String))

    return rooms.filter((room) => allowedRoomIds.has(String(room.id)))
  }

  const serviceTypes = useMemo(
    () => {
      const enabledServiceTypes = getAvailableServiceTypes(options, queueRooms, queueTickets)

      if (!terminalId) {
        return enabledServiceTypes
      }

      if (!terminal?.active) {
        return []
      }

      const allowedServiceTypeIds = new Set(terminal.serviceTypeIds.map(String))

      return enabledServiceTypes.filter((serviceType) => allowedServiceTypeIds.has(String(serviceType.id)))
    },
    [options, queueRooms, queueTickets, terminal, terminalId],
  )
  const selectedServiceType = serviceTypes.find(
    (serviceType) => String(serviceType.id) === selectedServiceTypeId,
  )
  const rooms = useMemo(
    () => filterTerminalRooms(getRoomsForService(options, selectedServiceType?.id, queueRooms), terminal),
    [options, queueRooms, selectedServiceType?.id, terminal, terminalId],
  )

  useEffect(() => {
    const selectedServiceAvailable = serviceTypes.some(
      (serviceType) => String(serviceType.id) === selectedServiceTypeId,
    )

    if ((!selectedServiceTypeId || !selectedServiceAvailable) && serviceTypes[0]) {
      setSelectedServiceTypeId(String(serviceTypes[0].id))
    }

    if (serviceTypes.length === 0 && selectedServiceTypeId) {
      setSelectedServiceTypeId('')
    }
  }, [selectedServiceTypeId, serviceTypes])

  useEffect(() => {
    if (!createdTicket) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      resetKiosk()
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [createdTicket])

  const printData = useMemo<TicketPrintData | undefined>(() => {
    if (!createdTicket) {
      return undefined
    }

    const room = rooms.find((item) => String(item.id) === createdTicket.roomId)

    return {
      date: new Date(createdTicket.createdAt),
      estimatedWaitMinutes: createdTicket.etaMinutes,
      language: createdTicket.language ?? language,
      organizationName: appSettings.appName,
      peopleAhead: getTicketPeopleAhead(createdTicket),
      priorityLabel: getLocale(createdTicket.language ?? language).priority[createdTicket.priority],
      roomName: formatRoomName(room ?? { id: createdTicket.roomId, name: createdTicket.roomName }),
      serviceName: selectedServiceType
        ? getServiceOptionLabel(selectedServiceType, createdTicket.language ?? language)
        : getLocale(createdTicket.language ?? language).serviceType.consultation,
      ticketNumber: createdTicket.number,
    }
  }, [appSettings.appName, createdTicket, language, rooms, selectedServiceType])

  function resetKiosk() {
    setCreatedTicket(null)
    setError(null)
    setLoading(false)
  }

  async function handleCreateTicket() {
    if (!selectedServiceType || loading) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      await loadQueue({ force: true, successMessage: 'Данные киоска обновлены' })
      const latestOptions = await loadTicketOptions()
      const latestRooms = useQueueStore.getState().rooms
      const latestTickets = useQueueStore.getState().tickets
      const latestTerminal = terminalId
        ? (await adminService.getTerminals()).find((item) => String(item.id) === terminalId) ?? null
        : null
      const latestServiceType = getServiceTypes(latestOptions).find(
        (serviceType) => String(serviceType.id) === String(selectedServiceType.id),
      )
      const latestServiceRooms = filterTerminalRooms(
        getRoomsForService(latestOptions, latestServiceType?.id, latestRooms),
        latestTerminal,
      )
      const averageServiceMinutes = getAverageServiceDurationStats(
        latestTickets,
        latestServiceType?.id,
        latestServiceType?.code,
      ).averageMinutes
      const latestRoom = getAutoRoomForService(
        latestServiceRooms,
        latestRooms,
        latestTickets,
        averageServiceMinutes,
      )
      const peopleAhead = latestRoom ? getRoomQueuePeopleAhead(latestRoom.id, latestTickets) : 0

      if (!latestServiceType) {
        setError(t.kiosk.serviceClosedToday)
        return
      }

      if (!latestRoom) {
        setError(t.kiosk.serviceClosedToday)
        return
      }

      const ticket = await kioskService.createTicketForKiosk({
        language,
        priority: 'normal',
        roomId: latestRoom.id,
        serviceType: latestServiceType.code,
        serviceTypeId: latestServiceType.id,
        status: 'waiting',
      })
      const resolvedPeopleAhead = getTicketPeopleAhead(ticket, peopleAhead)
      const estimatedWaitMinutes = ticket.etaMinutes > 0
        ? ticket.etaMinutes
        : Math.max(0, Math.round(resolvedPeopleAhead * averageServiceMinutes))

      setCreatedTicket({
        ...ticket,
        etaMinutes: estimatedWaitMinutes,
        peopleAhead: resolvedPeopleAhead,
        queuePosition: ticket.queuePosition ?? resolvedPeopleAhead + 1,
      })
      void loadQueue({ force: true, successMessage: 'Данные успешно обновлены' })
    } catch (createError) {
      console.error('Kiosk ticket create failed', createError)
      setError(t.kiosk.createError)
    } finally {
      setLoading(false)
    }
  }

  if (createdTicket) {
    return (
      <main className="kiosk-page">
        <section className="kiosk-result">
          <CheckCircle2 aria-hidden="true" className="no-print" size={72} />
          <span className="kiosk-result-label no-print">{t.kiosk.created}</span>
          <div className="kiosk-ticket-number no-print">
            <span>{t.kiosk.ticketNumber}</span>
            <strong>{createdTicket.number}</strong>
          </div>
          <div className="kiosk-queue-position no-print">
            {formatPeopleAhead(getTicketPeopleAhead(createdTicket), createdTicket.language ?? language)}
          </div>
          {printData ? (
            <section className="kiosk-ticket-preview-shell no-print">
              <TicketPrintPreview data={printData} showPrintButton={false} />
            </section>
          ) : null}
          <TicketPrintPreview autoPrint data={printData} screenHidden showPrintButton={false} />
          <Button
            className="kiosk-back-button no-print"
            icon={<ArrowLeft size={20} />}
            onClick={resetKiosk}
            size="lg"
            variant="secondary"
          >
            {t.kiosk.back}
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="kiosk-page">
      <section className="kiosk-shell">
        <div className="kiosk-heading">
          <div className="kiosk-brand-row">
            {appSettings.logoDataUrl ? (
              <img alt={appSettings.appName} className="brand-logo brand-logo-lg" src={appSettings.logoDataUrl} />
            ) : (
              <div className="brand-mark">{getAppInitials(appSettings.appName)}</div>
            )}
            <strong>{appSettings.appName}</strong>
          </div>
          <LanguageSelect variant="large" />
          <h1>{t.kiosk.chooseService}</h1>
        </div>

        {error ? <div className="modal-error">{error}</div> : null}
        {!error && !loadingOptions && !loadingTerminal && serviceTypes.length === 0 ? (
          <div className="modal-error">{t.kiosk.noRoomsForService}</div>
        ) : null}

        <div className="kiosk-service-grid">
          {serviceTypes.map((serviceType) => {
            const id = String(serviceType.id)
            const selected = id === String(selectedServiceType?.id)

            return (
              <button
                className={selected ? 'kiosk-service-button active' : 'kiosk-service-button'}
                disabled={loading || loadingOptions || loadingTerminal}
                key={id}
                onClick={() => {
                  setSelectedServiceTypeId(id)
                  setError(null)
                }}
                type="button"
              >
                {getServiceOptionLabel(serviceType, language)}
              </button>
            )
          })}
        </div>

        <Button
          className="kiosk-submit"
          disabled={loading || loadingOptions || loadingTerminal || !selectedServiceType}
          onClick={handleCreateTicket}
          size="lg"
          variant="primary"
        >
          {loading ? t.kiosk.creatingTicket : t.kiosk.createTicket}
        </Button>
      </section>
    </main>
  )
}
