import type { Room, Ticket } from '@shared/types'
import { useLocale } from '@shared/locales/useLocale'
import { formatRoomName, formatWaitingTime, getAverageWaitingMinutes, getRoomClosedLabel } from '@shared/utils'

type RoomLoadWidgetProps = {
  now?: number
  rooms: Room[]
  tickets?: Ticket[]
}

const activeTicketStatuses = ['created', 'waiting', 'called', 'in_service', 'redirected']

function getRoomStatusLabel(room: Room, t: ReturnType<typeof useLocale>) {
  if (room.isActive === false || room.status === 'paused') {
    return getRoomClosedLabel(room)
  }

  return room.status === 'busy' ? t.status.busy : t.common.active
}

export function RoomLoadWidget({ now, rooms, tickets = [] }: RoomLoadWidgetProps) {
  const t = useLocale()
  const activeRooms = rooms.filter((room) => room.status !== 'paused' && room.isActive !== false)

  return (
    <section className="widget-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">{t.analytics.rooms}</span>
          <h2>{t.analytics.loadPerRoom}</h2>
        </div>
      </div>
      {activeRooms.length > 0 ? (
        <div className="room-list">
          {activeRooms.map((room) => {
            const workload = room.workload ?? room.loadPercent
            const roomTickets = tickets.filter(
              (ticket) =>
                ticket.roomId === room.id &&
                activeTicketStatuses.includes(ticket.status),
            )
            const ticketsCount = roomTickets.length
            const averageWaitingMinutes = getAverageWaitingMinutes(roomTickets, now)

            return (
              <article className="room-row" key={room.id}>
                <div>
                  <strong>{formatRoomName(room)}</strong>
                  <span>{room.department}</span>
                </div>
                <div className="load-track">
                  <i style={{ width: `${workload}%` }} />
                </div>
                <div className="room-row-meta">
                  <b>{workload}%</b>
                  <span>{t.analytics.activeTickets}: {ticketsCount}</span>
                  <span>
                    {averageWaitingMinutes === null
                      ? t.analytics.noQueue
                      : `${t.analytics.averageWaiting}: ${formatWaitingTime(averageWaitingMinutes)}`}
                  </span>
                  <em>{getRoomStatusLabel(room, t)}</em>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-inline">
          <strong>{t.common.noData}</strong>
          <span>{t.analytics.noQueue}</span>
        </div>
      )}
    </section>
  )
}
