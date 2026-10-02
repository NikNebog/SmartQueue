import type { Ticket } from '../types'
import { formatRoomName } from '@shared/utils'

type BoardQueueProps = {
  tickets: Ticket[]
}

export function BoardQueue({ tickets }: BoardQueueProps) {
  const visibleTickets = tickets.filter((ticket) =>
    ['waiting', 'called', 'in_service'].includes(ticket.status),
  )
  const currentTicket = visibleTickets.find((ticket) => ticket.status === 'called') ?? visibleTickets[0]

  return (
    <section className="board-stage">
      {currentTicket ? (
        <article className="board-current-call">
          <span>Текущий вызов</span>
          <strong>{currentTicket.number}</strong>
          <p>{formatRoomName(currentTicket.room)}</p>
        </article>
      ) : (
        <p>Вызовы пациентов появятся здесь после подключения серверной части.</p>
      )}

      {visibleTickets.length > 1 ? (
        <div className="board-upcoming-list">
          {visibleTickets.slice(0, 4).map((ticket) => (
            <article key={ticket.id}>
              <strong>{ticket.number}</strong>
              <span>{formatRoomName(ticket.room)}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
