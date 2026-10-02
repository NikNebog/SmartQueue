import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, Check, ExternalLink, Info, LogOut, ShieldCheck, Siren, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AppRoute } from '@shared/types'
import { useLocale } from '@shared/locales/useLocale'
import type { QueueRecommendation } from '@shared/types'
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
import { useGlobalStore } from '@store/global'
import { useQueueStore } from '@store/queue'
import { LanguageSelect, ThemeToggle } from '@shared/ui/core-components'

type TopNavbarProps = {
  routes: AppRoute[]
}

const notificationExitMs = 180

function severityIcon(severity: QueueRecommendation['severity']) {
  if (severity === 'critical') {
    return <Siren size={16} />
  }

  if (severity === 'warning') {
    return <AlertTriangle size={16} />
  }

  return <Info size={16} />
}

function getNotificationTitle(recommendation: QueueRecommendation, now: number, t: ReturnType<typeof useLocale>): string {
  if (!recommendation.ticket) {
    return getRecommendationMessage(recommendation, t)
  }

  const priority = getPriorityMeta(recommendation.ticket.priority).label.toLowerCase()
  const waitingTime = formatWaitingTime(getWaitingMinutes(recommendation.ticket, now))

  return t.notifications.ticketWaiting
    .replace('{{ticket}}', recommendation.ticket.number)
    .replace('{{priority}}', priority)
    .replace('{{waiting}}', waitingTime)
}

function getRecommendationMessage(recommendation: QueueRecommendation, t: ReturnType<typeof useLocale>): string {
  if (recommendation.id === 'rec-queue-101') return t.notifications.mockQueueRiskMessage
  if (recommendation.id === 'rec-lab-305') return t.notifications.mockLabCapacityMessage
  if (recommendation.id === 'rec-flow') return t.notifications.mockFlowStableMessage
  if (recommendation.id.includes('worktime-risk')) return t.notifications.worktimeRiskTitle

  return recommendation.message || recommendation.title || t.notifications.newNotification
}

function getRecommendationDescription(recommendation: QueueRecommendation, t: ReturnType<typeof useLocale>): string {
  if (recommendation.id === 'rec-queue-101') return t.notifications.mockQueueRiskDescription
  if (recommendation.id === 'rec-lab-305') return t.notifications.mockLabCapacityDescription
  if (recommendation.id === 'rec-flow') return t.notifications.mockFlowStableDescription
  if (recommendation.id.includes('worktime-risk')) return t.notifications.worktimeRiskDescription

  return recommendation.description
}

function waitForNotificationExit() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, notificationExitMs)
  })
}

export function TopNavbar({ routes }: TopNavbarProps) {
  const t = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const notificationRef = useRef<HTMLDivElement>(null)
  const notificationsRequested = useRef(false)
  const [closingRecommendationIds, setClosingRecommendationIds] = useState<string[]>([])
  const [confirmCloseAllOpen, setConfirmCloseAllOpen] = useState(false)
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<string[]>([])
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const now = useCurrentTime()

  const user = useGlobalStore((state) => state.user)
  const logout = useGlobalStore((state) => state.logout)
  const hydrated = useQueueStore((state) => state.hydrated)
  const loadQueue = useQueueStore((state) => state.loadQueue)
  const loading = useQueueStore((state) => state.loading)
  const recommendations = useQueueStore((state) => state.recommendations)
  const resolveRecommendation = useQueueStore((state) => state.resolveRecommendation)
  const resolveRecommendations = useQueueStore((state) => state.resolveRecommendations)
  const selectTicket = useQueueStore((state) => state.selectTicket)

  const currentRoute = routes.find((route) => route.path === location.pathname)
  const visibleRecommendations = useMemo(
    () => {
      if (user?.role === 'specialist') {
        return []
      }

      return recommendations.filter(
        (recommendation) =>
          recommendation.isResolved !== true &&
          !dismissedRecommendationIds.includes(recommendation.id),
      )
    },
    [dismissedRecommendationIds, recommendations, user?.role],
  )
  const unreadCount = visibleRecommendations.length
  const closingRecommendationIdSet = useMemo(
    () => new Set(closingRecommendationIds),
    [closingRecommendationIds],
  )

  useEffect(() => {
    if (
      !user ||
      user.role === 'specialist' ||
      hydrated ||
      loading ||
      location.pathname === '/dashboard' ||
      notificationsRequested.current
    ) {
      return
    }

    notificationsRequested.current = true
    void loadQueue()
  }, [hydrated, loadQueue, loading, location.pathname, user])

  useEffect(() => {
    if (!notificationsOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
        setConfirmCloseAllOpen(false)
        setNotificationError(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
        setConfirmCloseAllOpen(false)
        setNotificationError(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleOpenTicket = (recommendation: QueueRecommendation) => {
    if (!recommendation.ticketId) {
      return
    }

    selectTicket(recommendation.ticketId)
    setNotificationsOpen(false)
    navigate('/dashboard')
  }

  const handleOpenRoom = () => {
    setNotificationsOpen(false)
    navigate('/admin')
  }

  const handleResolveRecommendation = async (recommendation: QueueRecommendation) => {
    if (closingRecommendationIdSet.has(recommendation.id)) {
      return
    }

    setNotificationError(null)
    setClosingRecommendationIds((ids) => (
      ids.includes(recommendation.id) ? ids : [...ids, recommendation.id]
    ))
    await waitForNotificationExit()
    setDismissedRecommendationIds((ids) => (
      ids.includes(recommendation.id) ? ids : [...ids, recommendation.id]
    ))
    setClosingRecommendationIds((ids) => ids.filter((id) => id !== recommendation.id))
    await resolveRecommendation(recommendation.id)
  }

  const handleCloseAllRecommendations = async () => {
    const recommendationIds = visibleRecommendations.map((recommendation) => recommendation.id)

    if (recommendationIds.length === 0) {
      setConfirmCloseAllOpen(false)
      return
    }

    setConfirmCloseAllOpen(false)
    setNotificationError(null)
    setClosingRecommendationIds((ids) => Array.from(new Set([...ids, ...recommendationIds])))
    await waitForNotificationExit()

    const result = await resolveRecommendations(recommendationIds)

    if (result.hiddenIds.length > 0) {
      setDismissedRecommendationIds((ids) => Array.from(new Set([...ids, ...result.hiddenIds])))
    }

    setClosingRecommendationIds((ids) => ids.filter((id) => !recommendationIds.includes(id)))

    if (result.failedCount > 0) {
      setNotificationError(t.notifications.closeSomeError)
    }
  }

  function getRouteLabel(route?: AppRoute): string {
    if (!route) return appFallbackTitle()
    if (route.path === '/dashboard') return t.nav.dashboard
    if (route.path === '/analytics') return t.nav.analytics
    if (route.path === '/admin') return t.nav.admin
    if (route.path === '/specialist') return t.nav.specialist
    if (route.path === '/visit-history') return t.nav.visitHistory
    if (route.path === '/board') return t.nav.tvBoard
    if (route.path === '/kiosk') return t.nav.kiosk

    return route.label
  }

  function appFallbackTitle(): string {
    return t.system.smartq
  }

  return (
    <header className="top-navbar">
      <div>
        <h1>{getRouteLabel(currentRoute)}</h1>
      </div>

      <div className="navbar-actions">
        <LanguageSelect />
        <ThemeToggle />

        <div className="notification-menu" ref={notificationRef}>
          <button
            aria-expanded={notificationsOpen}
            aria-label={t.notifications.openNotifications}
            className="notification-button"
            onClick={() => setNotificationsOpen((value) => !value)}
            type="button"
          >
            <Bell size={18} />
            {unreadCount > 0 ? <span>{unreadCount}</span> : null}
          </button>

          {notificationsOpen ? (
            <div className="notification-popover" role="dialog">
              <header className="notification-popover-header">
                <div>
                  <strong>{t.notifications.title}</strong>
                  <span>{t.notifications.newCount.replace('{{count}}', String(unreadCount))}</span>
                </div>
                {visibleRecommendations.length > 0 ? (
                  <button
                    className="notification-close-all"
                    disabled={loading || closingRecommendationIds.length > 0}
                    onClick={() => setConfirmCloseAllOpen(true)}
                    type="button"
                  >
                    <Trash2 size={14} />
                    {t.notifications.closeAll}
                  </button>
                ) : null}
              </header>

              {confirmCloseAllOpen ? (
                <div className="notification-confirm" role="alertdialog">
                  <strong>{t.notifications.closeAllConfirm}</strong>
                  <div>
                    <button
                      disabled={loading}
                      onClick={() => void handleCloseAllRecommendations()}
                      type="button"
                    >
                      <Check size={14} />
                      {t.notifications.yesClose}
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => setConfirmCloseAllOpen(false)}
                      type="button"
                    >
                      <X size={14} />
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              ) : null}

              {notificationError ? (
                <div className="notification-error" role="alert">{notificationError}</div>
              ) : null}

              {visibleRecommendations.length > 0 ? (
                <div className="notification-list">
                  {visibleRecommendations.map((recommendation) => (
                    <article
                      className={`notification-item notification-${recommendation.severity} ${closingRecommendationIdSet.has(recommendation.id) ? 'notification-item-closing' : ''}`}
                      key={recommendation.id}
                    >
                      <span className="notification-icon">
                        {severityIcon(recommendation.severity)}
                      </span>
                      <div>
                        <strong>{getNotificationTitle(recommendation, now, t)}</strong>
                        <p>{getRecommendationDescription(recommendation, t)}</p>
                        {recommendation.ticket ? (
                          <dl className="notification-details">
                            <div>
                              <dt>{t.tickets.service}</dt>
                              <dd>{getServiceTypeLabel(recommendation.ticket.serviceType)}</dd>
                            </div>
                            <div>
                              <dt>{t.tickets.room}</dt>
                              <dd>{formatRoomName({
                                id: recommendation.relatedRoomId,
                                name: recommendation.relatedRoomName,
                              })}</dd>
                            </div>
                            <div>
                              <dt>{t.tickets.priority}</dt>
                              <dd>{getPriorityMeta(recommendation.ticket.priority).label}</dd>
                            </div>
                            <div>
                              <dt>{t.queue.eta}</dt>
                              <dd>
                                {formatWaitingTime(getWaitingMinutes(recommendation.ticket, now))}
                              </dd>
                            </div>
                            <div>
                              <dt>{t.queue.status}</dt>
                              <dd>{getTicketStatusMeta(recommendation.ticket.status).label}</dd>
                            </div>
                          </dl>
                        ) : recommendation.relatedRoomName ? (
                          <dl className="notification-details">
                            <div>
                              <dt>{t.tickets.room}</dt>
                              <dd>{formatRoomName({
                                id: recommendation.relatedRoomId,
                                name: recommendation.relatedRoomName,
                              })}</dd>
                            </div>
                          </dl>
                        ) : null}
                        <footer>
                          <span>{t.notifications.severity[recommendation.severity]}</span>
                          <time>{formatTime(recommendation.createdAt)}</time>
                        </footer>
                      </div>
                      <div className="notification-actions">
                        {recommendation.ticketId ? (
                          <button onClick={() => handleOpenTicket(recommendation)} type="button">
                            <ExternalLink size={14} />
                            {t.notifications.openTicket}
                          </button>
                        ) : null}
                        {recommendation.relatedRoomId ? (
                          <button onClick={handleOpenRoom} type="button">
                            <ExternalLink size={14} />
                            {t.notifications.openRoom}
                          </button>
                        ) : null}
                        <button
                          aria-label={t.notifications.closeNotification}
                          disabled={loading || closingRecommendationIdSet.has(recommendation.id)}
                          onClick={() => void handleResolveRecommendation(recommendation)}
                          type="button"
                        >
                          <Check size={14} />
                          {t.notifications.close}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="notification-empty">{t.notifications.empty}</div>
              )}
            </div>
          ) : null}
        </div>

        {user ? (
          <div className="user-chip">
            <div className="avatar">{user.avatarInitials}</div>
            <div>
              <strong>{user.name}</strong>
              <span>
                <ShieldCheck size={13} />
                {t.roles[user.role]}
              </span>
            </div>
          </div>
        ) : null}

        <button
          onClick={handleLogout}
          className="logout-button"
          title={t.auth.logout}
        >
          <LogOut size={18} strokeWidth={2.5} />
          <span>{t.auth.logout}</span>
        </button>
      </div>
    </header>
  )
}
