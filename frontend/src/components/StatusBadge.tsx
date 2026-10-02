import type { TicketStatus } from '../types'

const statusLabels: Record<TicketStatus, string> = {
  created: 'Создан',
  waiting: 'Ожидает',
  called: 'Вызван',
  in_service: 'В обслуживании',
  completed: 'Завершён',
  cancelled: 'Отменён',
  no_show: 'Не явился',
  postponed: 'Отложен',
  redirected: 'Перенаправлен',
}

type StatusBadgeProps = {
  status: TicketStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`architecture-status architecture-status-${status}`}>{statusLabels[status]}</span>
}
