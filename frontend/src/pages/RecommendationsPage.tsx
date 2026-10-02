import { RecommendationPanel } from '@features/recommendations/RecommendationPanel'
import { useQueueBootstrap } from '@features/queue/useQueueBootstrap'
import { t } from '@shared/locales/useLocale'
import { RecentCallsWidget, RoomLoadWidget } from '@widgets'
import { useQueueStore } from '@store/queue'

export function RecommendationsPage() {
  useQueueBootstrap()

  const events = useQueueStore((state) => state.events)
  const recommendations = useQueueStore((state) => state.recommendations)
  const rooms = useQueueStore((state) => state.rooms)

  return (
    <div className="page-stack">
      <section className="content-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{t.dashboard.recommendationsTitle}</span>
              <h2>{t.dashboard.recommendationsEyebrow}</h2>
            </div>
          </div>
          <RecommendationPanel recommendations={recommendations} rooms={rooms} />
        </div>
        <aside className="side-column">
          <RoomLoadWidget rooms={rooms} />
          <RecentCallsWidget events={events} />
        </aside>
      </section>
    </div>
  )
}
