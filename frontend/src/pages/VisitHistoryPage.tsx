import { useCallback, useMemo } from 'react'
import { PageHeader, ResourceBanner } from '@components'
import { visitService, type Visit } from '@services/visitService'
import { useLocale } from '@shared/locales/useLocale'
import type { ServiceType } from '@shared/types'
import { StatusBadge } from '@shared/ui/components'
import { getServiceTypeLabel } from '@shared/utils'
import { useServiceResource } from '@shared/useServiceResource'
import { useGlobalStore } from '@store/global'

const emptyVisits: Visit[] = []
const serviceTypes: ServiceType[] = [
  'registration',
  'consultation',
  'diagnostics',
  'laboratory',
  'pharmacy',
  'billing',
]

function getVisitServiceLabel(service?: string): string {
  if (!service) {
    return '-'
  }

  return serviceTypes.includes(service as ServiceType)
    ? getServiceTypeLabel(service as ServiceType)
    : service
}

function getUserRoomIds(user?: { assignedRoomId?: string; assignedRoomIds?: string[]; roomId?: string; roomIds?: string[] } | null): string[] {
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

export function VisitHistoryPage() {
  const t = useLocale()
  const user = useGlobalStore((state) => state.user)
  const specialistRoomIds = useMemo(() => getUserRoomIds(user), [user])
  const loadVisits = useCallback(async (): Promise<Visit[]> => {
    if (!user) {
      return emptyVisits
    }

    return visitService.getTodayVisits({
      roomIds: specialistRoomIds,
      userId: user.id,
    })
  }, [specialistRoomIds, user])
  const { data: visits, loading, error } = useServiceResource(loadVisits, emptyVisits)

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.visitHistory.eyebrow}
        title={t.visitHistory.title}
        description={t.visitHistory.description}
      />
      <ResourceBanner error={error} loading={loading} />

      <section className="primary-panel">
        {visits.length === 0 && !loading ? (
          <p className="muted-copy">{t.visitHistory.emptyToday}</p>
        ) : (
          <div className="table-shell">
            <table className="queue-table visit-history-table">
              <thead>
                <tr>
                  <th>{t.visitHistory.time}</th>
                  <th>{t.visitHistory.patient}</th>
                  <th>{t.visitHistory.ticket}</th>
                  <th>{t.visitHistory.service}</th>
                  <th>{t.visitHistory.servicePlace}</th>
                  <th>{t.visitHistory.status}</th>
                  <th>{t.visitHistory.priority}</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id}>
                    <td>{visit.time}</td>
                    <td>{visit.patient}</td>
                    <td>{visit.ticket}</td>
                    <td>{getVisitServiceLabel(visit.service)}</td>
                    <td>{visit.room ?? '-'}</td>
                    <td><StatusBadge status={visit.status} /></td>
                    <td><StatusBadge priority={visit.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
