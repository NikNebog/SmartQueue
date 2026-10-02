import { AlertTriangle, Info, Siren } from 'lucide-react'
import type { QueueRecommendation } from '@shared/types'
import { t } from '@shared/locales/useLocale'
import {
  formatWaitingTime,
  getPriorityMeta,
  getWaitingMinutes,
  useCurrentTime,
} from '@shared/utils'

type RecommendationsWidgetProps = {
  recommendations: QueueRecommendation[]
}

function severityIcon(severity: QueueRecommendation['severity']) {
  if (severity === 'critical') {
    return <Siren size={18} />
  }

  if (severity === 'warning') {
    return <AlertTriangle size={18} />
  }

  return <Info size={18} />
}

function getRecommendationMessage(recommendation: QueueRecommendation, now: number): string {
  if (!recommendation.ticket) {
    return recommendation.message
  }

  const priority = getPriorityMeta(recommendation.ticket.priority).label.toLowerCase()
  const waitingTime = formatWaitingTime(getWaitingMinutes(recommendation.ticket, now))

  return `Талон ${recommendation.ticket.number} — ${priority} приоритет, ожидает ${waitingTime}`
}

export function RecommendationsWidget({ recommendations }: RecommendationsWidgetProps) {
  const now = useCurrentTime()
  const activeRecommendations = recommendations.filter((recommendation) => recommendation.isResolved !== true)

  return (
    <section className="widget-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">{t.dashboard.recommendationsEyebrow}</span>
          <h2>{t.dashboard.recommendationsTitle}</h2>
        </div>
      </div>

      {activeRecommendations.length > 0 ? (
        <div className="recommendation-mini-list">
          {activeRecommendations.slice(0, 4).map((recommendation) => (
            <article
              className={`recommendation-mini recommendation-${recommendation.severity}`}
              key={recommendation.id}
            >
              <span>{severityIcon(recommendation.severity)}</span>
              <div>
                <strong>{getRecommendationMessage(recommendation, now)}</strong>
                <p>{recommendation.action}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-inline">
          <strong>Рекомендаций нет</strong>
          <span>Система не видит перегрузки или критичных предупреждений.</span>
        </div>
      )}
    </section>
  )
}
