import type { ReactNode } from 'react'
import type { Room, Ticket } from '@shared/types'
import { t } from '@shared/locales/useLocale'
import {
  formatPeopleAhead,
  formatRoomName,
  formatTime,
  formatWaitingTime,
  getServiceTypeLabel,
  getRoomClosedLabel,
  getTicketPeopleAhead,
  getWaitingMinutes,
} from '@shared/utils'
import { StatusBadge } from './StatusBadge'

type TicketCardProps = {
  ticket: Ticket
  room?: Room
  actionSlot?: ReactNode
  compact?: boolean
  serviceLabel?: string
  now?: number
}

export function TicketCard({ actionSlot, compact = false, now, room, serviceLabel, ticket }: TicketCardProps) {
  return (
    <article className={`ticket-card ${compact ? 'ticket-card-compact' : ''}`}>
      <header>
        <div>
          <span className="ticket-number">{ticket.number}</span>
          <h3>{ticket.patientName}</h3>
        </div>
        <StatusBadge status={ticket.status} />
      </header>

      <div className="ticket-card-grid">
        <span>
          <small>{t.tickets.service}</small>
          {serviceLabel ?? getServiceTypeLabel(ticket.serviceType)}
        </span>
        <span>
          <small>{t.tickets.priority}</small>
          <StatusBadge priority={ticket.priority} />
        </span>
        <span>
          <small>{t.tickets.eta}</small>
          {formatWaitingTime(getWaitingMinutes(ticket, now))}
        </span>
        <span>
          <small>{t.tickets.created}</small>
          {formatTime(ticket.createdAt)}
        </span>
        {(ticket.peopleAhead !== undefined || ticket.queuePosition !== undefined) ? (
          <span>
            <small>{t.tickets.queue}</small>
            {formatPeopleAhead(getTicketPeopleAhead(ticket))}
          </span>
        ) : null}
        <span>
          <small>{t.tickets.room}</small>
          {formatRoomName(room ?? { id: ticket.roomId, name: ticket.roomName })}
          {room?.isActive === false || room?.status === 'paused' ? ` · ${getRoomClosedLabel(room)}` : ''}
        </span>
      </div>

      {ticket.notes ? <p className="ticket-note">{ticket.notes}</p> : null}
      {actionSlot ? <footer>{actionSlot}</footer> : null}
    </article>
  )
}
