import { useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Info, Siren } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { QueueRecommendation, Room } from '@shared/types'
import {
  formatTime,
  formatRoomName,
  formatWaitingTime,
  getPriorityMeta,
  getServiceTypeLabel,
  getTicketStatusMeta,
  getWaitingMinutes,
  useCurrentTime,
} from '@shared/utils'
import { useQueueStore } from '@store/queue'

type RecommendationPanelProps = {
  recommendations: QueueRecommendation[]
  rooms: Room[]
}
const recommendationExitMs = 180

function iconForSeverity(severity: QueueRecommendation['severity']) {
  if (severity === 'critical') {
    return <Siren size={20} />
  }

  if (severity === 'warning') {
    return <AlertTriangle size={20} />
  }

  return <Info size={20} />
}

function getRecommendationTitle(recommendation: QueueRecommendation, now: number): string {
  if (!recommendation.ticket) {
    return recommendation.title
  }

  const priority = getPriorityMeta(recommendation.ticket.priority).label.toLowerCase()
  const waitingTime = formatWaitingTime(getWaitingMinutes(recommendation.ticket, now))

  return `Талон ${recommendation.ticket.number} — ${priority} приоритет, ожидает ${waitingTime}`
}

function waitForRecommendationExit() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, recommendationExitMs)
  })
}

export function RecommendationPanel({ recommendations, rooms }: RecommendationPanelProps) {
  const navigate = useNavigate()
  const [closingRecommendationIds, setClosingRecommendationIds] = useState<string[]>([])
  const resolveRecommendation = useQueueStore((state) => state.resolveRecommendation)
  const selectTicket = useQueueStore((state) => state.selectTicket)
  const now = useCurrentTime()
  const activeRecommendations = recommendations.filter((recommendation) => recommendation.isResolved !== true)
  const closingRecommendationIdSet = new Set(closingRecommendationIds)

  const handleOpenTicket = (recommendation: QueueRecommendation) => {
    if (!recommendation.ticketId) {
      return
    }

    selectTicket(recommendation.ticketId)
    navigate('/dashboard')
  }

  const handleOpenRoom = () => {
    navigate('/admin')
  }

  const handleResolveRecommendation = async (recommendation: QueueRecommendation) => {
    if (closingRecommendationIdSet.has(recommendation.id)) {
      return
    }

    setClosingRecommendationIds((ids) => (
      ids.includes(recommendation.id) ? ids : [...ids, recommendation.id]
    ))
    await waitForRecommendationExit()
    setClosingRecommendationIds((ids) => ids.filter((id) => id !== recommendation.id))
    await resolveRecommendation(recommendation.id)
  }

  return (
    <div className="recommendation-list">
      {activeRecommendations.length === 0 ? (
        <div className="empty-state">
          <h2>Активных уведомлений нет</h2>
          <p>Новые рекомендации появятся здесь после обновления очереди.</p>
        </div>
      ) : null}

      {activeRecommendations.map((recommendation) => {
        const room = rooms.find((item) => item.id === recommendation.relatedRoomId)
        const roomName = formatRoomName(room ?? {
          id: recommendation.relatedRoomId,
          name: recommendation.relatedRoomName,
        })

        return (
          <article
            className={`recommendation-card recommendation-${recommendation.severity} ${closingRecommendationIdSet.has(recommendation.id) ? 'recommendation-card-closing' : ''}`}
            key={recommendation.id}
          >
            <div className="recommendation-icon">{iconForSeverity(recommendation.severity)}</div>
            <div>
              <header>
                <div>
                  <span className="eyebrow">
                    {roomName} / {formatTime(recommendation.createdAt)}
                  </span>
                  <h2>{getRecommendationTitle(recommendation, now)}</h2>
                </div>
              </header>
              <p>{recommendation.description}</p>
              {recommendation.ticket ? (
                <dl className="recommendation-details">
                  <div>
                    <dt>Услуга</dt>
                    <dd>{getServiceTypeLabel(recommendation.ticket.serviceType)}</dd>
                  </div>
                  <div>
                    <dt>Место обслуживания</dt>
                    <dd>{roomName}</dd>
                  </div>
                  <div>
                    <dt>Приоритет</dt>
                    <dd>{getPriorityMeta(recommendation.ticket.priority).label}</dd>
                  </div>
                  <div>
                    <dt>Ожидание</dt>
                    <dd>{formatWaitingTime(getWaitingMinutes(recommendation.ticket, now))}</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>{getTicketStatusMeta(recommendation.ticket.status).label}</dd>
                  </div>
                </dl>
              ) : roomName ? (
                <dl className="recommendation-details">
                  <div>
                    <dt>Место обслуживания</dt>
                    <dd>{roomName}</dd>
                  </div>
                </dl>
              ) : null}
              <strong>{recommendation.action}</strong>
              <div className="recommendation-actions">
                {recommendation.ticketId ? (
                  <button onClick={() => handleOpenTicket(recommendation)} type="button">
                    <ExternalLink size={14} />
                    Открыть талон
                  </button>
                ) : null}
                {recommendation.relatedRoomId ? (
                  <button onClick={handleOpenRoom} type="button">
                    <ExternalLink size={14} />
                    Открыть кабинет
                  </button>
                ) : null}
                <button
                  disabled={closingRecommendationIdSet.has(recommendation.id)}
                  onClick={() => void handleResolveRecommendation(recommendation)}
                  type="button"
                >
                  <Check size={14} />
                  Закрыть
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
