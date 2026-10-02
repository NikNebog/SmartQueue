import { DataPanel, PageHeader, ResourceBanner, TicketTable } from '@components'
import { queueService } from '@services/queueService'
import { userService } from '@services/userService'
import { useServiceResource } from '@shared/useServiceResource'
import type { Ticket, User } from '../types'

type SpecialistData = {
  tickets: Ticket[]
  user?: User
}

const emptySpecialistData: SpecialistData = {
  tickets: [],
}

async function loadSpecialistData(): Promise<SpecialistData> {
  const [tickets, user] = await Promise.all([
    queueService.getQueue(),
    userService.getCurrentUser(),
  ])

  return { tickets, user }
}

export function Specialist() {
  const { data, error, loading } = useServiceResource(loadSpecialistData, emptySpecialistData)

  return (
    <div className="architecture-page">
      <PageHeader
        description="Рабочее место специалиста готово к подключению вызовов через queueService."
        eyebrow="Специалист"
        title="Специалист"
      />
      <ResourceBanner error={error} loading={loading} />
      <DataPanel
        description={data.user ? `Текущий профиль: ${data.user.name}` : 'Профиль загрузится через userService.'}
        title="Очередь специалиста"
      >
        <TicketTable tickets={data.tickets} />
      </DataPanel>
    </div>
  )
}
