import { TicketCreateForm } from '@features/tickets/TicketCreateForm'
import type { Room, Ticket, TicketCreateInput } from '@shared/types'
import { t } from '@shared/locales/useLocale'
import { TicketCard } from '@shared/ui/components'
import { useCurrentTime } from '@shared/utils'
import { useQueueStore } from '@store/queue'

export function TicketCreatePage() {
  const createTicket = useQueueStore((state) => state.createTicket)
  const loading = useQueueStore((state) => state.loading)
  const rooms = useQueueStore((state) => state.rooms)
  const selectedTicketId = useQueueStore((state) => state.selectedTicketId)
  const tickets = useQueueStore((state) => state.tickets)
  const createdTicket = tickets.find((ticket) => ticket.id === selectedTicketId)
  const now = useCurrentTime()

  async function handleCreateTicket(input: TicketCreateInput): Promise<void> {
    await createTicket(input)
  }

  return (
    <div className="page-stack">
      <section className="content-grid ticket-create-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{t.tickets.tickets}</span>
              <h2>{t.tickets.createPatientTicket}</h2>
            </div>
          </div>
          <TicketCreateForm fallbackRooms={rooms} loading={loading} onSubmit={handleCreateTicket} tickets={tickets} />
        </div>

        <aside className="side-column">
          <TicketPreview now={now} rooms={rooms} ticket={createdTicket} />
        </aside>
      </section>
    </div>
  )
}

function TicketPreview({ now, rooms, ticket }: { now: number; rooms: Room[]; ticket?: Ticket }) {
  if (!ticket) {
    return (
      <div className="empty-state compact-empty">
        <span className="eyebrow">{t.tickets.preview}</span>
        <h2>{t.tickets.noTicketSelected}</h2>
        <p>{t.tickets.lastCreatedTicket}</p>
      </div>
    )
  }

  return <TicketCard now={now} room={rooms.find((room) => room.id === ticket.roomId)} ticket={ticket} />
}
