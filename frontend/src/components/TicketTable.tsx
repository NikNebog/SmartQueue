import type { Ticket } from '../types'
import { formatRoomName, formatWaitingTime, getWaitingMinutes, useCurrentTime } from '@shared/utils'
import { StatusBadge } from './StatusBadge'

const priorityLabels: Record<Ticket['priority'], string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
}

type TicketTableProps = {
  tickets: Ticket[]
  emptyText?: string
}

export function TicketTable({
  emptyText = 'Данные появятся после подключения серверной части.',
  tickets,
}: TicketTableProps) {
  const now = useCurrentTime()

  if (tickets.length === 0) {
    return <div className="architecture-empty">{emptyText}</div>
  }

  return (
    <div className="architecture-table-shell">
      <table className="architecture-table">
        <thead>
          <tr>
            <th>Талон</th>
            <th>Услуга</th>
            <th>Кабинет</th>
            <th>Приоритет</th>
            <th>Ожидание</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <strong>{ticket.number}</strong>
              </td>
              <td>{ticket.serviceType.name}</td>
              <td>{formatRoomName(ticket.room)}</td>
              <td>{priorityLabels[ticket.priority]}</td>
              <td>{formatWaitingTime(getWaitingMinutes(ticket, now))}</td>
              <td>
                <StatusBadge status={ticket.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
