import type {
  ServiceType,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '@shared/types'
import { getLocale } from '@shared/locales/useLocale'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

type Meta = {
  label: string
  tone: Tone
}

const statusTones: Record<TicketStatus, Tone> = {
  called: 'info',
  cancelled: 'danger',
  completed: 'success',
  created: 'neutral',
  in_service: 'success',
  no_show: 'danger',
  postponed: 'warning',
  redirected: 'warning',
  waiting: 'neutral',
}

const priorityTones: Record<TicketPriority, Tone> = {
  above_normal: 'warning',
  critical: 'danger',
  high: 'warning',
  low: 'neutral',
  normal: 'info',
}

export const ticketStatusMeta: Record<TicketStatus, Meta> = {
  called: { label: getLocale().status.called, tone: statusTones.called },
  cancelled: { label: getLocale().status.cancelled, tone: statusTones.cancelled },
  completed: { label: getLocale().status.completed, tone: statusTones.completed },
  created: { label: getLocale().status.created, tone: statusTones.created },
  in_service: { label: getLocale().status.in_service, tone: statusTones.in_service },
  no_show: { label: getLocale().status.no_show, tone: statusTones.no_show },
  postponed: { label: getLocale().status.postponed, tone: statusTones.postponed },
  redirected: { label: getLocale().status.redirected, tone: statusTones.redirected },
  waiting: { label: getLocale().status.waiting, tone: statusTones.waiting },
}

export const priorityMeta: Record<TicketPriority, Meta> = {
  above_normal: { label: getLocale().priority.above_normal, tone: priorityTones.above_normal },
  critical: { label: getLocale().priority.critical, tone: priorityTones.critical },
  high: { label: getLocale().priority.high, tone: priorityTones.high },
  low: { label: getLocale().priority.low, tone: priorityTones.low },
  normal: { label: getLocale().priority.normal, tone: priorityTones.normal },
}

export const serviceTypeLabel: Record<ServiceType, string> = {
  billing: getLocale().serviceType.billing,
  consultation: getLocale().serviceType.consultation,
  diagnostics: getLocale().serviceType.diagnostics,
  laboratory: getLocale().serviceType.laboratory,
  pharmacy: getLocale().serviceType.pharmacy,
  registration: getLocale().serviceType.registration,
}

export function getTicketStatusMeta(status: TicketStatus): Meta {
  return {
    label: getLocale().status[status],
    tone: statusTones[status],
  }
}

export function getPriorityMeta(priority: TicketPriority): Meta {
  return {
    label: getLocale().priority[priority],
    tone: priorityTones[priority],
  }
}

export function getServiceTypeLabel(serviceType: ServiceType): string {
  return getLocale().serviceType[serviceType]
}

export function isActiveTicket(ticket: Ticket): boolean {
  return ['created', 'waiting', 'called', 'in_service'].includes(ticket.status)
}

export function getWaitSeverity(minutes: number): Tone {
  if (minutes >= 45) {
    return 'danger'
  }

  if (minutes >= 25) {
    return 'warning'
  }

  return 'success'
}
