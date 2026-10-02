import type { Ticket, TicketStatus } from '@shared/types'
import { getTicketStatusMeta } from '@shared/utils'

const statuses: TicketStatus[] = [
  'created',
  'waiting',
  'called',
  'in_service',
  'completed',
  'redirected',
  'postponed',
  'cancelled',
  'no_show',
]

type QueueStatusRailProps = {
  tickets: Ticket[]
}

export function QueueStatusRail({ tickets }: QueueStatusRailProps) {
  return (
    <section className="status-rail">
      {statuses.map((status) => {
        const meta = getTicketStatusMeta(status)
        const count = tickets.filter((ticket) => ticket.status === status).length

        return (
          <article className={`status-rail-item rail-${meta.tone}`} key={status}>
            <span>{meta.label}</span>
            <strong>{count}</strong>
          </article>
        )
      })}
    </section>
  )
}
