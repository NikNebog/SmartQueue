import { DataPanel, PageHeader, ResourceBanner, TicketTable } from '@components'
import { queueService } from '@services/queueService'
import { useServiceResource } from '@shared/useServiceResource'
import type { Ticket } from '../types'

const emptyTickets: Ticket[] = []

async function loadQueue(): Promise<Ticket[]> {
  return queueService.getQueue()
}

export function Queue() {
  const { data: tickets, error, loading } = useServiceResource(loadQueue, emptyTickets)

  return (
    <div className="architecture-page">
      <PageHeader
        description="Очередь отображается через queueService и готова к подключению API."
        eyebrow="Очередь"
        title="Очередь"
      />
      <ResourceBanner error={error} loading={loading} />
      <DataPanel title="Текущая очередь">
        <TicketTable tickets={tickets} />
      </DataPanel>
    </div>
  )
}
