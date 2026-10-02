import { DataPanel, PageHeader, ResourceBanner, TicketTable } from '@components'
import { ticketService } from '@services/ticketService'
import { useServiceResource } from '@shared/useServiceResource'
import type { Ticket } from '../types'

const emptyTickets: Ticket[] = []

async function loadTickets(): Promise<Ticket[]> {
  return ticketService.getTickets()
}

export function Tickets() {
  const { data: tickets, error, loading } = useServiceResource(loadTickets, emptyTickets)

  return (
    <div className="architecture-page">
      <PageHeader
        description="Список талонов получает данные через ticketService."
        eyebrow="Талоны"
        title="Талоны"
      />
      <ResourceBanner error={error} loading={loading} />
      <DataPanel title="Реестр талонов">
        <TicketTable tickets={tickets} />
      </DataPanel>
    </div>
  )
}
