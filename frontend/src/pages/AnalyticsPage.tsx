import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Clock, Stethoscope, UserX } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { AnalyticsCharts } from '@features/analytics/AnalyticsCharts'
import {
  createFilteredAnalyticsFromTickets,
  getTicketsForAnalyticsFilters,
} from '@features/analytics/periodAnalytics'
import { getServiceOptionLabel } from '@features/tickets/ticketFormOptions'
import { adminService } from '@services/adminService'
import { subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import type { TicketSettingsServiceTypeOption } from '@services/api'
import { formatWaitingTime, getWaitingMinutes, useCurrentTime } from '@shared/utils'
import type { Ticket } from '@shared/types'
import { KPIWidget } from '@shared/ui/components'
import { useLocale } from '@shared/locales/useLocale'
import { useQueueStore } from '@store/queue'

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function subtractMonths(date: Date, months: number): Date {
  const nextDate = new Date(date)
  const originalDay = nextDate.getDate()

  nextDate.setDate(1)
  nextDate.setMonth(nextDate.getMonth() - months)
  nextDate.setDate(Math.min(originalDay, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))

  return nextDate
}

function getCompletedServiceMinutes(ticket: Ticket): number | null {
  const serviceStartedAt = ticket.serviceStartedAt ?? ticket.startedAt

  if (ticket.status !== 'completed' || !serviceStartedAt || !ticket.completedAt) {
    return null
  }

  const startedAt = Date.parse(serviceStartedAt)
  const completedAt = Date.parse(ticket.completedAt)

  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    return null
  }

  return Math.round((completedAt - startedAt) / 60_000)
}

function getAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function getAverageWaitMinutes(tickets: Ticket[], now: number): number | null {
  return getAverage(
    tickets
      .map((ticket) => getWaitingMinutes(ticket, now))
      .filter((minutes): minutes is number => minutes !== null),
  )
}

function getAverageServiceMinutes(tickets: Ticket[]): number | null {
  return getAverage(
    tickets
      .map(getCompletedServiceMinutes)
      .filter((minutes): minutes is number => minutes !== null),
  )
}

function formatAnalyticsDuration(minutes: number | null): string {
  return minutes === null ? 'Нет данных' : formatWaitingTime(minutes)
}

function AnalyticsSummaryKpis({ now, tickets }: { now: number; tickets: Ticket[] }) {
  const completedTickets = tickets.filter((ticket) => ticket.status === 'completed').length
  const noShowTickets = tickets.filter((ticket) => ticket.status === 'no_show').length
  const averageWaitMinutes = getAverageWaitMinutes(tickets, now)
  const averageServiceMinutes = getAverageServiceMinutes(tickets)

  return (
    <section className="kpi-grid">
      <KPIWidget
        helper="С учётом выбранных фильтров"
        icon={<ClipboardList size={20} />}
        title="Всего талонов"
        tone="info"
        value={tickets.length}
      />
      <KPIWidget
        helper="Обслуживание завершено"
        icon={<CheckCircle2 size={20} />}
        title="Завершены"
        tone={completedTickets > 0 ? 'success' : 'neutral'}
        value={completedTickets}
      />
      <KPIWidget
        helper="Пациенты не подошли к вызову"
        icon={<UserX size={20} />}
        title="Не явились"
        tone={noShowTickets > 0 ? 'danger' : 'neutral'}
        value={noShowTickets}
      />
      <KPIWidget
        helper="От создания талона до вызова"
        icon={<Clock size={20} />}
        title="Среднее ожидание"
        tone="warning"
        value={formatAnalyticsDuration(averageWaitMinutes)}
      />
      <KPIWidget
        helper="От начала до завершения приёма"
        icon={<Stethoscope size={20} />}
        title="Среднее обслуживание"
        tone="success"
        value={formatAnalyticsDuration(averageServiceMinutes)}
      />
    </section>
  )
}

export function AnalyticsPage() {
  const t = useLocale()
  const error = useQueueStore((state) => state.error)
  const hydrated = useQueueStore((state) => state.hydrated)
  const loading = useQueueStore((state) => state.loading)
  const refreshAnalyticsData = useQueueStore((state) => state.refreshAnalyticsData)
  const rooms = useQueueStore((state) => state.rooms)
  const tickets = useQueueStore((state) => state.tickets)
  const today = useMemo(() => toDateInputValue(new Date()), [])
  const minDate = useMemo(() => toDateInputValue(subtractMonths(new Date(), 6)), [])
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [serviceTypesError, setServiceTypesError] = useState<string | null>(null)
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('')
  const [serviceTypes, setServiceTypes] = useState<TicketSettingsServiceTypeOption[]>([])
  const location = useLocation()
  const now = useCurrentTime()
  const hasAnalyticsData = tickets.length > 0 || rooms.length > 0
  const analyticsFilters = useMemo(() => ({
    dateFrom,
    dateTo,
    serviceTypeId: selectedServiceTypeId || undefined,
  }), [dateFrom, dateTo, selectedServiceTypeId])
  const periodIsValid = useMemo(() => (
    dateFrom >= minDate &&
    dateFrom <= today &&
    dateTo >= minDate &&
    dateTo <= today &&
    dateFrom <= dateTo
  ), [dateFrom, dateTo, minDate, today])
  const periodError = periodIsValid ? null : 'Выберите корректный период'
  const chartAnalytics = useMemo(
    () => periodIsValid ? createFilteredAnalyticsFromTickets(tickets, analyticsFilters, now) : [],
    [analyticsFilters, now, periodIsValid, tickets],
  )
  const periodTickets = useMemo(
    () => periodIsValid ? getTicketsForAnalyticsFilters(tickets, analyticsFilters) : [],
    [analyticsFilters, periodIsValid, tickets],
  )

  const loadServiceTypes = useCallback(async () => {
    try {
      setServiceTypes(await adminService.getServiceTypes())
      setServiceTypesError(null)
    } catch (loadError) {
      console.error('Analytics service types load failed', loadError)
      setServiceTypes([])
      setServiceTypesError('Не удалось загрузить типы услуг для фильтра.')
    }
  }, [])

  useEffect(() => {
    if (periodIsValid) {
      void refreshAnalyticsData()
    }
  }, [analyticsFilters, location.key, periodIsValid, refreshAnalyticsData])

  useEffect(() => {
    void loadServiceTypes()
  }, [loadServiceTypes])

  useEffect(() => subscribeServiceTypesChanged(() => {
    void loadServiceTypes()
    void refreshAnalyticsData()
  }), [loadServiceTypes, refreshAnalyticsData])

  useEffect(() => {
    if (
      selectedServiceTypeId &&
      !serviceTypes.some((serviceType) => String(serviceType.id) === selectedServiceTypeId)
    ) {
      setSelectedServiceTypeId('')
    }
  }, [selectedServiceTypeId, serviceTypes])

  useEffect(() => {
    const handleFocus = () => {
      void refreshAnalyticsData()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAnalyticsData()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshAnalyticsData])

  return (
    <div className="page-stack">
      {loading && !hydrated ? (
        <section className="empty-state compact-empty">
          <h2>Загрузка аналитики...</h2>
          <p>Получаем данные из backend.</p>
        </section>
      ) : null}
      {error ? (
        <section className="empty-state compact-empty">
          <h2>Не удалось загрузить аналитику</h2>
          <p>Проверьте подключение к серверу.</p>
        </section>
      ) : hasAnalyticsData ? (
        <>
          <section className="analytics-period-panel">
            <label className="field">
              <span>Дата от</span>
              <input
                max={dateTo < today ? dateTo : today}
                min={minDate}
                onChange={(event) => setDateFrom(event.target.value)}
                type="date"
                value={dateFrom}
              />
            </label>
            <label className="field">
              <span>Дата до</span>
              <input
                max={today}
                min={dateFrom > minDate ? dateFrom : minDate}
                onChange={(event) => setDateTo(event.target.value)}
                type="date"
                value={dateTo}
              />
            </label>
            <label className="field">
                <span>{t.tickets.serviceType}</span>
              <select
                onChange={(event) => setSelectedServiceTypeId(event.target.value)}
                value={selectedServiceTypeId}
              >
                <option value="">{t.queue.allServices}</option>
                {serviceTypes.map((serviceType) => (
                  <option key={String(serviceType.id)} value={String(serviceType.id)}>
                    {getServiceOptionLabel(serviceType)}
                  </option>
                ))}
              </select>
            </label>
            {serviceTypesError ? <div className="modal-info">{serviceTypesError}</div> : null}
          </section>
          {periodError ? <div className="modal-error">{periodError}</div> : null}
          {!periodError && periodTickets.length === 0 ? (
            <div className="modal-info">По выбранным фильтрам данных нет.</div>
          ) : null}
          {!periodError ? (
            <>
              <AnalyticsSummaryKpis now={now} tickets={periodTickets} />
              <AnalyticsCharts
                analytics={chartAnalytics}
                now={now}
                rooms={rooms}
                selectedServiceTypeId={selectedServiceTypeId || undefined}
                tickets={periodTickets}
              />
            </>
          ) : null}
        </>
      ) : !loading && hydrated ? (
        <section className="empty-state compact-empty">
          <h2>Данных для аналитики пока нет</h2>
          <p>Создайте или обработайте талоны, чтобы увидеть статистику.</p>
        </section>
      ) : null}
    </div>
  )
}
