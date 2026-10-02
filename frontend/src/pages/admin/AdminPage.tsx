import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, CheckCircle2, Stethoscope, UsersRound } from 'lucide-react'
import { adminService } from '@services/adminService'
import { useLocale } from '@shared/locales/useLocale'
import type { Role } from '@shared/types'
import { useGlobalStore } from '@store/global'
import { useQueueStore } from '@store/queue'
import { getRoomActive, type AdminRoomRecord } from './adminPageHelpers'
import { ManagersSection } from './AdminManagersPage'
import { RoomsSection } from './AdminRoomsPage'
import { StaffSection } from './AdminStaffPage'
import { BoardSettingsSection } from './AdminBoardSettingsPage'
import { ServiceTypesSection } from './AdminServiceTypesPage'
import { TerminalsSection } from './AdminTerminalsPage'
import { AppSettingsSection } from './AdminAppSettingsPage'

type AdminSectionId = 'rooms' | 'service-types' | 'terminals' | 'staff' | 'managers' | 'board' | 'app-settings'

type AdminSectionConfig = {
  id: AdminSectionId
  roles: Role[]
}

type AdminSummary = {
  activeRooms: number
  doctors: number
  managers: number
  totalRooms: number
}

const adminSections: AdminSectionConfig[] = [
  { id: 'rooms', roles: ['admin', 'manager'] },
  { id: 'service-types', roles: ['admin', 'manager'] },
  { id: 'terminals', roles: ['admin', 'manager'] },
  { id: 'staff', roles: ['admin', 'manager'] },
  { id: 'managers', roles: ['admin'] },
  { id: 'board', roles: ['admin', 'manager'] },
  { id: 'app-settings', roles: ['admin'] },
]

const emptySummary: AdminSummary = {
  activeRooms: 0,
  doctors: 0,
  managers: 0,
  totalRooms: 0,
}

function isAdminSectionId(value: string | null): value is AdminSectionId {
  return adminSections.some((section) => section.id === value)
}

export function AdminPage() {
  const t = useLocale()
  const user = useGlobalStore((state) => state.user)
  const loadQueue = useQueueStore((state) => state.loadQueue)
  const [searchParams, setSearchParams] = useSearchParams()
  const [roomsVersion, setRoomsVersion] = useState(0)
  const [summary, setSummary] = useState<AdminSummary>(emptySummary)
  const canManageManagers = user?.role === 'admin'

  const visibleSections = useMemo(
    () => adminSections.filter((section) => user && section.roles.includes(user.role)),
    [user],
  )
  const sectionParam = searchParams.get('section')
  const selectedSection = visibleSections.find((section) => (
    isAdminSectionId(sectionParam) && section.id === sectionParam
  )) ?? visibleSections[0]

  const loadSummary = useCallback(async () => {
    try {
      const [rooms, staff, managers] = await Promise.all([
        adminService.getRooms(),
        adminService.getStaff(),
        canManageManagers ? adminService.getManagers() : Promise.resolve([]),
      ])
      const roomRecords = rooms as AdminRoomRecord[]

      setSummary({
        activeRooms: roomRecords.filter(getRoomActive).length,
        doctors: staff.length,
        managers: managers.length,
        totalRooms: roomRecords.length,
      })
    } catch (error) {
      console.error('Admin summary load failed', error)
      setSummary(emptySummary)
    }
  }, [canManageManagers])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  function handleRoomsChange() {
    setRoomsVersion((version) => version + 1)
    void loadSummary()
    void loadQueue({ force: true, successMessage: 'Данные успешно обновлены' })
  }

  function handleAdminDataChange() {
    void loadSummary()
  }

  function handleServiceTypesChange() {
    void loadQueue({ force: true, successMessage: 'Типы услуг обновлены' })
  }

  function selectSection(sectionId: AdminSectionId) {
    const nextSearchParams = new URLSearchParams(searchParams)

    nextSearchParams.set('section', sectionId)
    setSearchParams(nextSearchParams)
  }

  function getSectionLabel(section: AdminSectionConfig): string {
    if (section.id === 'service-types') return t.admin.serviceTypes
    if (section.id === 'terminals') return t.admin.terminals
    if (section.id === 'staff') return t.admin.staff
    if (section.id === 'managers') return t.admin.managers
    if (section.id === 'board') return t.nav.tvBoard
    if (section.id === 'app-settings') return t.admin.appSettings

    return t.admin.rooms
  }

  return (
    <div className="page-stack">
      <p className="admin-page-lead">Настройка кабинетов, персонала и доступов</p>

      <section aria-label="Сводка администрирования" className="admin-summary-grid">
        <article className="admin-summary-card">
          <Building2 size={18} />
          <span>Всего кабинетов</span>
          <strong>{summary.totalRooms}</strong>
        </article>
        <article className="admin-summary-card">
          <CheckCircle2 size={18} />
          <span>Активных кабинетов</span>
          <strong>{summary.activeRooms}</strong>
        </article>
        <article className="admin-summary-card">
          <Stethoscope size={18} />
          <span>Врачей</span>
          <strong>{summary.doctors}</strong>
        </article>
        {canManageManagers ? (
          <article className="admin-summary-card">
            <UsersRound size={18} />
            <span>Менеджеров</span>
            <strong>{summary.managers}</strong>
          </article>
        ) : null}
      </section>

      <nav aria-label="Разделы администрирования" className="admin-section-switcher segmented-control">
        {visibleSections.map((section) => (
          <button
            className={selectedSection?.id === section.id ? 'active' : ''}
            key={section.id}
            onClick={() => selectSection(section.id)}
            type="button"
          >
            {getSectionLabel(section)}
          </button>
        ))}
      </nav>

      {selectedSection?.id === 'rooms' ? <RoomsSection onRoomsChange={handleRoomsChange} /> : null}
      {selectedSection?.id === 'service-types' ? (
        <ServiceTypesSection onServiceTypesChange={handleServiceTypesChange} />
      ) : null}
      {selectedSection?.id === 'terminals' ? <TerminalsSection /> : null}
      {selectedSection?.id === 'staff' ? (
        <StaffSection onStaffChange={handleAdminDataChange} refreshKey={roomsVersion} />
      ) : null}
      {selectedSection?.id === 'managers' && canManageManagers ? (
        <ManagersSection onManagersChange={handleAdminDataChange} />
      ) : null}
      {selectedSection?.id === 'board' ? <BoardSettingsSection /> : null}
      {selectedSection?.id === 'app-settings' && canManageManagers ? <AppSettingsSection /> : null}
    </div>
  )
}
