import { DataPanel, PageHeader, ResourceBanner, SummaryGrid, TicketTable } from '@components'
import { queueService } from '@services/queueService'
import { ticketService } from '@services/ticketService'
import { userService } from '@services/userService'
import { useServiceResource } from '@shared/useServiceResource'
import type { Room, Ticket, User } from '../types'

type DashboardData = {
  rooms: Room[]
  tickets: Ticket[]
  users: User[]
}

const emptyDashboardData: DashboardData = {
  rooms: [],
  tickets: [],
  users: [],
}

async function loadDashboardData(): Promise<DashboardData> {
  const [tickets, rooms, users] = await Promise.all([
    ticketService.getTickets(),
    queueService.getRooms(),
    userService.getUsers(),
  ])

  return { rooms, tickets, users }
}

export function Dashboard() {
  const { data, error, loading } = useServiceResource(loadDashboardData, emptyDashboardData)

  return (
    <div className="architecture-page">
      <PageHeader
        description="Обзор состояния системы через контракт сервисного слоя."
        eyebrow="Панель управления"
        title="Панель управления"
      />
      <ResourceBanner error={error} loading={loading} />
      <SummaryGrid rooms={data.rooms} tickets={data.tickets} users={data.users} />
      <DataPanel
        description="Компонент получает данные только из ticketService, queueService и userService."
        title="Сводка очереди"
      >
        <TicketTable tickets={data.tickets} />
      </DataPanel>
    </div>
  )
}
