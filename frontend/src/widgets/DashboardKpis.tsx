import {
  BellRing,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Hourglass,
  Stethoscope,
} from 'lucide-react'
import { t } from '@shared/locales/useLocale'
import type { Room, Ticket } from '@shared/types'
import { KPIWidget } from '@shared/ui/components'
import { useQueueStore } from '@store/queue'

type DashboardKpisProps = {
  rooms?: Room[]
  tickets?: Ticket[]
}

export function DashboardKpis({ rooms: inputRooms, tickets: inputTickets }: DashboardKpisProps = {}) {
  const storeRooms = useQueueStore((state) => state.rooms)
  const storeTickets = useQueueStore((state) => state.tickets)
  const rooms = inputRooms ?? storeRooms
  const tickets = inputTickets ?? storeTickets
  const activeRooms = rooms.filter((room) => room.isActive !== false && room.status !== 'paused').length
  const waitingTickets = tickets.filter((ticket) => ticket.status === 'waiting').length
  const calledTickets = tickets.filter((ticket) => ticket.status === 'called').length
  const inServiceTickets = tickets.filter((ticket) => ticket.status === 'in_service').length
  const completedTickets = tickets.filter((ticket) => ticket.status === 'completed').length

  return (
    <section className="kpi-grid">
      <KPIWidget
        helper="Все талоны в текущей очереди"
        icon={<ClipboardList size={20} />}
        title="Всего талонов"
        tone="info"
        value={tickets.length}
      />
      <KPIWidget
        helper="Ожидают вызова"
        icon={<Hourglass size={20} />}
        title="Ожидают"
        tone={waitingTickets > 0 ? 'warning' : 'neutral'}
        value={waitingTickets}
      />
      <KPIWidget
        helper="Пациенты уже вызваны"
        icon={<BellRing size={20} />}
        title="Вызваны"
        tone={calledTickets > 0 ? 'info' : 'neutral'}
        value={calledTickets}
      />
      <KPIWidget
        helper="Сейчас на приёме"
        icon={<Stethoscope size={20} />}
        title="Обслуживаются"
        tone={inServiceTickets > 0 ? 'success' : 'neutral'}
        value={inServiceTickets}
      />
      <KPIWidget
        helper={t.dashboard.activeRoomsHelper}
        icon={<DoorOpen size={20} />}
        title={t.dashboard.activeRooms}
        tone="success"
        value={activeRooms}
      />
      <KPIWidget
        helper="Обслуживание завершено"
        icon={<CheckCircle2 size={20} />}
        title="Завершены"
        tone={completedTickets > 0 ? 'success' : 'neutral'}
        value={completedTickets}
      />
    </section>
  )
}
