ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'postponed';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'ticket_postponed';
