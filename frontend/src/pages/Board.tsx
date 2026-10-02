import { useEffect, useState } from 'react'
import { BoardQueue } from '@components'
import { queueService } from '@services/queueService'
import type { Ticket } from '../types'

export function Board() {
  const [tickets, setTickets] = useState<Ticket[]>([])

  useEffect(() => {
    return queueService.subscribeQueue(setTickets)
  }, [])

  return (
    <main className="board-shell">
      <header>
        <span>SmartQ Табло</span>
        <span className="board-header-note">Будущие вызовы пациентов</span>
      </header>

      <BoardQueue tickets={tickets} />
    </main>
  )
}
