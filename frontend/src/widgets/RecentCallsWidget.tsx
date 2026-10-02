import type { QueueEvent } from '@shared/types'
import { useLocale } from '@shared/locales/useLocale'
import { formatRoomName, formatTime } from '@shared/utils'

type RecentCallsWidgetProps = {
  events: QueueEvent[]
}

export function RecentCallsWidget({ events }: RecentCallsWidgetProps) {
  const t = useLocale()

  function getEventMessage(event: QueueEvent): string {
    if (event.type === 'ticket_called') {
      return t.queue.ticketCalled
    }

    if (event.type === 'status_update') {
      const statusLabel = event.status && event.status in t.status
        ? t.status[event.status as keyof typeof t.status]
        : event.status

      return statusLabel ? `${t.queue.movedToStatus}: ${statusLabel}` : t.queue.statusChanged
    }

    return event.message
  }

  return (
    <section className="widget-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">{t.queue.recentEvents}</span>
          <h2>{t.queue.signalLog}</h2>
        </div>
      </div>
      {events.length > 0 ? (
        <div className="event-list">
          {events.slice(0, 20).map((event) => {
            const eventDate = event.createdAt ?? event.occurredAt
            const hasRoom = Boolean(event.roomName) || event.roomId !== undefined
            const roomLabel = hasRoom ? formatRoomName({ id: event.roomId, name: event.roomName }) : ''
            const meta = [
              event.ticketNumber ? `${t.queue.ticketNumber} ${event.ticketNumber}` : '',
              roomLabel,
            ].filter(Boolean).join(' · ')

            return (
              <article className={`event-row event-${event.type}`} key={event.id}>
                <span />
                <div>
                  <strong>
                    <time dateTime={eventDate}>{formatTime(eventDate)}</time>
                    {' — '}
                    {getEventMessage(event)}
                  </strong>
                  {meta ? <time>{meta}</time> : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-inline">
          <strong>{t.queue.noEvents}</strong>
        </div>
      )}
    </section>
  )
}
