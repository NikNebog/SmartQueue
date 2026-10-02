import type { AnalyticsPoint, Room, Ticket } from '@shared/types'
import { useLocale } from '@shared/locales/useLocale'
import { formatRoomName, formatWaitingTime, getAverageWaitingMinutes } from '@shared/utils'

type AnalyticsChartsProps = {
  analytics: AnalyticsPoint[]
  now?: number
  rooms: Room[]
  selectedServiceTypeId?: string | number
  tickets: Ticket[]
}

const workdayStartHour = 8

function formatPeriodLabel(label: string, index: number): string {
  const normalizedLabel = label.trim()
  const periodMatch = normalizedLabel.match(/^Период\s+(\d+)$/i)
  const numericPeriod = periodMatch ? Number(periodMatch[1]) : Number(normalizedLabel)

  if (Number.isInteger(numericPeriod) && numericPeriod >= 1 && numericPeriod <= 24) {
    const hour = (workdayStartHour + numericPeriod - 1) % 24

    return `${String(hour).padStart(2, '0')}:00`
  }

  if (/^\d{1,2}:00$/.test(normalizedLabel)) {
    const [hour] = normalizedLabel.split(':')

    return `${hour.padStart(2, '0')}:00`
  }

  if (!normalizedLabel) {
    const hour = (workdayStartHour + index) % 24

    return `${String(hour).padStart(2, '0')}:00`
  }

  return normalizedLabel
}

function getCompletedServiceMinutes(ticket: Ticket): number | null {
  if (ticket.status !== 'completed') {
    return null
  }

  const serviceStartedAt = ticket.serviceStartedAt ?? ticket.startedAt

  if (!serviceStartedAt || !ticket.completedAt) {
    return null
  }

  const startedAt = Date.parse(serviceStartedAt)
  const completedAt = Date.parse(ticket.completedAt)

  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    return null
  }

  return Math.round((completedAt - startedAt) / 60_000)
}

function getAverageServiceMinutes(tickets: Ticket[]): number | null {
  const serviceMinutes = tickets
    .map(getCompletedServiceMinutes)
    .filter((minutes): minutes is number => minutes !== null)

  if (serviceMinutes.length === 0) {
    return null
  }

  return Math.round(serviceMinutes.reduce((sum, minutes) => sum + minutes, 0) / serviceMinutes.length)
}

function formatOptionalDuration(minutes?: number): string {
  return minutes === undefined ? 'Нет данных' : formatWaitingTime(minutes)
}

function normalizeServiceId(value?: string | number | null): string {
  return value == null ? '' : String(value)
}

function getRoomServiceIds(room: Room): string[] {
  const nestedServices = [...(room.serviceTypes ?? []), ...(room.services ?? [])]
    .map((service) => {
      if (typeof service === 'string' || typeof service === 'number') {
        return normalizeServiceId(service)
      }

      return normalizeServiceId(service.serviceTypeId ?? service.id ?? service._id ?? service.name ?? service.title)
    })

  return Array.from(new Set([
    normalizeServiceId(room.serviceTypeId),
    ...(room.serviceTypeIds ?? []).map(normalizeServiceId),
    ...nestedServices,
  ].filter(Boolean)))
}

function getRoomServiceNames(room: Room): string[] {
  const nestedServices = [...(room.serviceTypes ?? []), ...(room.services ?? [])]
    .map((service) => {
      if (typeof service === 'string' || typeof service === 'number') {
        return String(service)
      }

      return String(service.name ?? service.title ?? service.serviceTypeId ?? service.id ?? service._id ?? '').trim()
    })
    .filter(Boolean)

  return Array.from(new Set(nestedServices))
}

function roomSupportsSelectedService(room: Room, selectedServiceTypeId?: string | number): boolean {
  const serviceTypeId = normalizeServiceId(selectedServiceTypeId)

  return !serviceTypeId || getRoomServiceIds(room).some((roomServiceTypeId) => roomServiceTypeId === serviceTypeId)
}

function isActiveRoom(room: Room): boolean {
  return room.active !== false && room.isActive !== false && room.status !== 'paused'
}

export function AnalyticsCharts({ analytics, now, rooms, selectedServiceTypeId, tickets }: AnalyticsChartsProps) {
  const t = useLocale()
  const maxTicketCount = Math.max(
    ...analytics.flatMap((point) => [point.waiting, point.completed, point.noShow ?? 0]),
    1,
  )
  const maxDurationMinutes = Math.max(
    ...analytics.flatMap((point) => [point.avgWaitMinutes, point.avgServiceMinutes ?? 0]),
    1,
  )

  function getBarHeight(value: number, maxValue: number): string {
    if (value <= 0) {
      return '0%'
    }

    return `${Math.max(10, (value / maxValue) * 100)}%`
  }

  const formattedAnalytics = analytics.map((point, index) => ({
    ...point,
    displayLabel: formatPeriodLabel(point.label, index),
  }))
  const displayedRooms = rooms
    .filter(isActiveRoom)
    .filter((room) => roomSupportsSelectedService(room, selectedServiceTypeId))

  return (
    <div className="analytics-grid">
      <section className="chart-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{t.analytics.queueCurve}</span>
            <h2>{t.analytics.waitingVsCompleted}</h2>
          </div>
        </div>
        <div className="chart-legend">
          <span><i className="legend-dot legend-waiting" /> Ожидают</span>
          <span><i className="legend-dot legend-completed" /> Завершены</span>
          <span><i className="legend-dot legend-no-show" /> Не явились</span>
        </div>
        <div className="analytics-chart-frame">
          <span className="analytics-axis-label analytics-axis-y">Количество талонов</span>
          <div className="bar-chart" role="img" aria-label="Количество ожидающих и завершённых талонов по периодам">
            {formattedAnalytics.map((point) => (
              <div className="bar-group" key={point.label}>
                <span
                  className="bar bar-waiting"
                  title={`Ожидают: ${point.waiting}`}
                  style={{ height: getBarHeight(point.waiting, maxTicketCount) }}
                />
                <span
                  className="bar bar-completed"
                  title={`Завершены: ${point.completed}`}
                  style={{ height: getBarHeight(point.completed, maxTicketCount) }}
                />
                <span
                  className="bar bar-no-show"
                  title={`Не явились: ${point.noShow ?? 0}`}
                  style={{ height: getBarHeight(point.noShow ?? 0, maxTicketCount) }}
                />
                <small>{point.displayLabel}</small>
              </div>
            ))}
          </div>
          <span className="analytics-axis-label analytics-axis-x">Период</span>
        </div>
        <p className="chart-note">
          Столбцы показывают, сколько талонов ожидали и сколько было завершено в каждом периоде.
        </p>
      </section>

      <section className="chart-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{t.analytics.waitTime}</span>
            <h2>{t.analytics.averageWaitMinutes}</h2>
          </div>
        </div>
        <div className="analytics-axis-row">
          <span>Период</span>
          <span>Среднее время, мин</span>
        </div>
        <div className="chart-legend chart-legend-compact">
          <span><i className="legend-line legend-waiting" /> Ожидание</span>
          <span><i className="legend-line legend-service" /> Обслуживание</span>
        </div>
        <div className="analytics-scroll-panel">
          <div className="wait-list">
            {formattedAnalytics.map((point) => (
              <div className="duration-row" key={point.label}>
                <span>{point.displayLabel}</span>
                <div className="duration-bars">
                  <div>
                    <small>Ожидание</small>
                    <span>
                      <i className="duration-waiting" style={{ width: getBarHeight(point.avgWaitMinutes, maxDurationMinutes) }} />
                    </span>
                  </div>
                  <div>
                    <small>Обслуживание</small>
                    <span>
                      <i className="duration-service" style={{ width: getBarHeight(point.avgServiceMinutes ?? 0, maxDurationMinutes) }} />
                    </span>
                  </div>
                </div>
                <strong>
                  {formatWaitingTime(point.avgWaitMinutes)}
                  <small>{formatOptionalDuration(point.avgServiceMinutes)}</small>
                </strong>
              </div>
            ))}
          </div>
        </div>
        <p className="chart-note">
          Верхняя полоса показывает фактическое ожидание, нижняя — среднее обслуживание после завершения приёма.
        </p>
      </section>

      <section className="chart-panel wide-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{t.analytics.rooms}</span>
            <h2>{t.analytics.loadPerRoom}</h2>
          </div>
        </div>
        <div className="chart-legend">
          <span><i className="legend-dot legend-waiting" /> Ожидают</span>
          <span><i className="legend-dot legend-called" /> Вызваны</span>
          <span><i className="legend-dot legend-service" /> На обслуживании</span>
          <span><i className="legend-dot legend-completed" /> Завершены</span>
        </div>
        <div className="analytics-axis-row">
          <span>Место обслуживания</span>
          <span>Среднее время ожидания, мин</span>
        </div>
        <div className="room-load-grid analytics-room-grid">
          {displayedRooms.length === 0 ? (
            <div className="empty-state compact-empty analytics-room-empty">
              <h2>{t.analytics.noRoomsForService}</h2>
            </div>
          ) : null}
          {displayedRooms.map((room) => {
            const roomTickets = tickets.filter((ticket) => String(ticket.roomId ?? '') === String(room.id))
            const averageWaitingMinutes = getAverageWaitingMinutes(roomTickets, now)
            const averageServiceMinutes = getAverageServiceMinutes(roomTickets)
            const roomServiceNames = getRoomServiceNames(room)
            const waitingCount = roomTickets.filter((ticket) => ticket.status === 'waiting').length
            const calledCount = roomTickets.filter((ticket) => ticket.status === 'called').length
            const inServiceCount = roomTickets.filter((ticket) => ticket.status === 'in_service').length
            const completedCount = roomTickets.filter((ticket) => ticket.status === 'completed').length

            return (
              <article className="room-load-card" key={room.id}>
                <span>{formatRoomName(room)}</span>
                <strong>{room.loadPercent}%</strong>
                <small>{t.queue.status}: {t.status[room.status]}</small>
                <small>
                  {averageWaitingMinutes === null
                    ? t.analytics.noQueue
                    : `${t.analytics.averageWaiting}: ${formatWaitingTime(averageWaitingMinutes)}`}
                </small>
                <small>
                  {averageServiceMinutes === null
                    ? t.analytics.noCompletedAppointments
                    : `${t.analytics.averageService}: ${formatWaitingTime(averageServiceMinutes)}`}
                </small>
                <small>
                  {room.estimatedWaitMinutes === undefined
                    ? 'План ожидания: не задан'
                    : `План ожидания: ${formatWaitingTime(room.estimatedWaitMinutes)}`}
                </small>
                <small>
                  {roomServiceNames.length > 0
                    ? `Типы услуг: ${roomServiceNames.join(', ')}`
                    : 'Типы услуг: не заданы'}
                </small>
                <dl className="room-status-summary">
                  <div className="room-status-item room-status-waiting">
                    <dt>{t.status.waiting}</dt>
                    <dd>{waitingCount}</dd>
                  </div>
                  <div className="room-status-item room-status-called">
                    <dt>{t.status.called}</dt>
                    <dd>{calledCount}</dd>
                  </div>
                  <div className="room-status-item room-status-service">
                    <dt>{t.status.in_service}</dt>
                    <dd>{inServiceCount}</dd>
                  </div>
                  <div className="room-status-item room-status-completed">
                    <dt>{t.status.completed}</dt>
                    <dd>{completedCount}</dd>
                  </div>
                </dl>
                <div className="load-track">
                  <i style={{ width: `${room.loadPercent}%` }} />
                </div>
              </article>
            )
          })}
        </div>
        <p className="chart-note">
          {t.analytics.loadPerRoom}
        </p>
      </section>
    </div>
  )
}
