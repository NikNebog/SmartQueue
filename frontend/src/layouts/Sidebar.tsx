import { Menu } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getAppInitials, useAppSettings } from '@services/appSettingsService'
import type { AppRoute, Room, User } from '@shared/types'
import { t, useLocale } from '@shared/locales/useLocale'
import { IconButton } from '@shared/ui/core-components'
import {
  formatDuration,
  getAverageServiceDurationStats,
  getQueueServiceDurationMinutes,
  getRoomWorkloadRisk,
  normalizeWorkTime,
  useCurrentTime,
} from '@shared/utils'
import { useGlobalStore } from '@store/global'
import { useQueueStore } from '@store/queue'

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
  routes: AppRoute[]
}

const fallbackServiceMinutes = 10
const specialistVisibleStatuses = ['waiting', 'called', 'in_service', 'redirected'] as const

function getUserRoomIds(user?: User | null): string[] {
  if (!user) {
    return []
  }

  return Array.from(new Set([
    user.roomId,
    user.assignedRoomId,
    ...(user.roomIds ?? []),
    ...(user.assignedRoomIds ?? []),
  ].filter((roomId): roomId is string => Boolean(roomId))))
}

function formatWorkDuration(minutes?: number): string {
  if (minutes === undefined) {
    return t.specialist.allDay
  }

  return minutes > 0 ? formatDuration(minutes) : t.specialist.zeroMinutes
}

function getRoomWorkTimeText(room: Room): string {
  const workStartTime = normalizeWorkTime(room.workStartTime)
  const workEndTime = normalizeWorkTime(room.workEndTime)

  if (workStartTime && workEndTime) {
    return t.specialist.workTimeFromTo
      .replace('{{start}}', workStartTime)
      .replace('{{end}}', workEndTime)
  }

  if (workStartTime) {
    return t.specialist.workTimeFrom.replace('{{start}}', workStartTime)
  }

  if (workEndTime) {
    return t.specialist.workTimeTo.replace('{{end}}', workEndTime)
  }

  return t.specialist.worksAllDay
}

function SpecialistSidebarSummary({ collapsed }: { collapsed: boolean }) {
  const now = useCurrentTime()
  const user = useGlobalStore((state) => state.user)
  const activeTickets = useQueueStore((state) => state.activeTickets)
  const rooms = useQueueStore((state) => state.rooms)
  const tickets = useQueueStore((state) => state.tickets)

  if (collapsed || user?.role !== 'specialist') {
    return null
  }

  const roomIds = getUserRoomIds(user)
  const room = rooms.find((item) => roomIds.includes(String(item.id)))

  if (!room) {
    return null
  }

  const roomTickets = activeTickets.filter((ticket) =>
    String(ticket.roomId) === String(room.id) &&
    specialistVisibleStatuses.includes(ticket.status as (typeof specialistVisibleStatuses)[number]),
  )
  const roomCompletedMinutes = tickets
    .filter((ticket) => String(ticket.roomId) === String(room.id) && ticket.status === 'completed')
    .map((ticket) => getAverageServiceDurationStats([ticket], ticket.serviceTypeId, ticket.serviceType))
    .filter((stats) => stats.hasData)
    .map((stats) => stats.averageMinutes)
  const roomCompletedStats = roomCompletedMinutes.length === 0
    ? { averageMinutes: fallbackServiceMinutes, hasData: false }
    : {
        averageMinutes: Math.max(
          1,
          Math.round(roomCompletedMinutes.reduce((sum, minutes) => sum + minutes, 0) / roomCompletedMinutes.length),
        ),
        hasData: true,
      }
  const queueDurationMinutes = getQueueServiceDurationMinutes(roomTickets, tickets)
  const activeWaitingCount = roomTickets.length
  const averageServiceMinutes = activeWaitingCount > 0
    ? Math.max(1, Math.round(queueDurationMinutes / activeWaitingCount))
    : roomCompletedStats.averageMinutes
  const workTimeCalculation = getRoomWorkloadRisk(room, tickets, {
    averageServiceMinutes,
    now,
    queueDurationMinutes,
  })
  const workTimeStatus = workTimeCalculation.isAtRisk
    ? t.specialist.queueAtRisk
    : workTimeCalculation.isWorkingNow
      ? t.analytics.loadNormal
      : t.specialist.notWorkingNow

  return (
    <div className="sidebar-specialist-summary">
      <section className="sidebar-summary-section">
        <span className="eyebrow">{t.specialist.servicePlaceStats}</span>
        <h2>{t.specialist.queueCalculation}</h2>
        <dl className="sidebar-summary-list">
          <div>
            <dt>{t.specialist.patientsInQueue}</dt>
            <dd>{activeWaitingCount}</dd>
          </div>
          <div>
            <dt>{t.specialist.queueWillTakeApproximately}</dt>
            <dd>{queueDurationMinutes > 0 ? formatDuration(queueDurationMinutes) : t.specialist.zeroMinutes}</dd>
          </div>
        </dl>
      </section>

      <section className="sidebar-summary-section">
        <span className="eyebrow">{t.specialist.servicePlaceSchedule}</span>
        <h2>{t.specialist.workingHours}</h2>
        <dl className="sidebar-summary-list">
          <div>
            <dt>{t.specialist.schedule}</dt>
            <dd>{getRoomWorkTimeText(room)}</dd>
          </div>
          <div>
            <dt>{t.specialist.remainingUntilClose}</dt>
            <dd>{formatWorkDuration(workTimeCalculation.remainingWorkMinutes)}</dd>
          </div>
          <div>
            <dt>{t.specialist.queueWillTake}</dt>
            <dd>{formatWorkDuration(workTimeCalculation.queueDurationMinutes)}</dd>
          </div>
          <div>
            <dt>{t.queue.status}</dt>
            <dd>{workTimeStatus}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle, routes }: SidebarProps) {
  const appSettings = useAppSettings()
  const t = useLocale()
  const user = useGlobalStore((state) => state.user)

  const visibleRoutes = routes.filter((route) => {
    if (!route.allowedRoles) return true
    return user ? route.allowedRoles.includes(user.role) : false
  })
  const ungroupedRoutes = visibleRoutes.filter((route) => !route.groupLabel)
  const groupedRoutes = visibleRoutes.reduce<Record<string, AppRoute[]>>((groups, route) => {
    if (!route.groupLabel) {
      return groups
    }

    return {
      ...groups,
      [route.groupLabel]: [...(groups[route.groupLabel] ?? []), route],
    }
  }, {})

  function renderLink(route: AppRoute) {
    const Icon = route.icon

    if (!Icon) {
      return null
    }

    return (
      <NavLink className="sidebar-link" key={route.path} to={route.path}>
        <Icon size={19} strokeWidth={2.1} />
        <span>{getRouteLabel(route)}</span>
      </NavLink>
    )
  }

  function getRouteLabel(route: AppRoute): string {
    if (route.path === '/dashboard') return t.nav.dashboard
    if (route.path === '/analytics') return t.nav.analytics
    if (route.path === '/admin') return t.nav.admin
    if (route.path === '/specialist') return t.nav.specialist
    if (route.path === '/visit-history') return t.nav.visitHistory
    if (route.path === '/board') return t.nav.tvBoard
    if (route.path === '/kiosk') return t.nav.kiosk

    return route.label
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        {appSettings.logoDataUrl ? (
          <img alt={appSettings.appName} className="brand-logo" src={appSettings.logoDataUrl} />
        ) : (
          <div className="brand-mark">{getAppInitials(appSettings.appName)}</div>
        )}
        <div className="brand-copy">
          <strong>{appSettings.appName}</strong>
          <span>{t.system.controlSystem}</span>
        </div>
        <IconButton
          icon={<Menu size={18} />}
          label={t.system.toggleSidebar}
          onClick={onToggle}
        />
      </div>

      <nav className="sidebar-nav">
        {ungroupedRoutes.map(renderLink)}
        {Object.entries(groupedRoutes).map(([groupLabel, groupRoutes]) => (
          <div className="sidebar-group" key={groupLabel}>
            <span className="sidebar-group-label">{groupLabel}</span>
            {groupRoutes.map(renderLink)}
          </div>
        ))}
      </nav>

      <SpecialistSidebarSummary collapsed={collapsed} />
    </aside>
  )
}
