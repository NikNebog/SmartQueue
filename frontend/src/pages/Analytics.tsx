import { DataPanel, PageHeader, ResourceBanner, SummaryGrid } from '@components'
import { queueService } from '@services/queueService'
import { ticketService } from '@services/ticketService'
import { userService } from '@services/userService'
import { useServiceResource } from '@shared/useServiceResource'
import type { Room, Ticket, User } from '../types'

type AnalyticsData = {
  rooms: Room[]
  tickets: Ticket[]
  users: User[]
}

const emptyAnalyticsData: AnalyticsData = {
  rooms: [],
  tickets: [],
  users: [],
}

async function loadAnalyticsData(): Promise<AnalyticsData> {
  const [tickets, rooms, users] = await Promise.all([
    ticketService.getTickets(),
    queueService.getRooms(),
    userService.getUsers(),
  ])

  return { rooms, tickets, users }
}

export function Analytics() {
  const { data, error, loading } = useServiceResource(loadAnalyticsData, emptyAnalyticsData)

  return (
    <div className="architecture-page">
      <PageHeader
        description="Аналитика использует те же контрактные данные, что и будущий API."
        eyebrow="Аналитика"
        title="Аналитика"
      />
      <ResourceBanner error={error} loading={loading} />
      <DataPanel
        description="Здесь будут подключены графики без изменения контрактов страниц."
        title="Контракт аналитики"
      >
        <SummaryGrid rooms={data.rooms} tickets={data.tickets} users={data.users} />
      </DataPanel>
    </div>
  )
}
