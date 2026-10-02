import type { TicketPriority, TicketStatus } from '@shared/types'
import { t } from '@shared/locales/useLocale'
import { getPriorityMeta, getTicketStatusMeta } from '@shared/utils'

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

type StatusBadgeProps = {
  label?: string
  tone?: BadgeTone
  status?: TicketStatus
  priority?: TicketPriority
}

export function StatusBadge({
  label,
  priority,
  status,
  tone = 'neutral',
}: StatusBadgeProps) {
  const meta = status
    ? getTicketStatusMeta(status)
    : priority
      ? getPriorityMeta(priority)
      : { label: label ?? t.status.default, tone }

  return (
    <span className={`status-badge status-${meta.tone} ${status ? `ticket-status-${status}` : ''}`}>
      {label ?? meta.label}
    </span>
  )
}
