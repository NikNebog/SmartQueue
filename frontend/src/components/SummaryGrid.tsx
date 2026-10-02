import type { Room, Ticket, User } from '../types'

type SummaryGridProps = {
  rooms?: Room[]
  tickets?: Ticket[]
  users?: User[]
}

export function SummaryGrid({ rooms = [], tickets = [], users = [] }: SummaryGridProps) {
  const activeTickets = tickets.filter((ticket) =>
    ['waiting', 'called', 'in_service'].includes(ticket.status),
  ).length
  const activeRooms = rooms.length
  const specialists = users.filter((user) => user.role === 'specialist').length

  return (
    <section className="architecture-summary-grid">
      <article>
        <span>Активные талоны</span>
        <strong>{activeTickets}</strong>
      </article>
      <article>
        <span>Кабинеты</span>
        <strong>{activeRooms}</strong>
      </article>
      <article>
        <span>Специалисты</span>
        <strong>{specialists}</strong>
      </article>
    </section>
  )
}
