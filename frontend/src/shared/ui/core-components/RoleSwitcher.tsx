import type { Role } from '@shared/types'
import { t } from '@shared/locales/useLocale'
import { useGlobalStore } from '@store/global/useGlobalStore'

const roles: Role[] = ['admin', 'manager', 'specialist']

const roleLabel: Record<Role, string> = {
  admin: t.roles.admin,
  manager: t.roles.manager,
  specialist: t.roles.specialist,
}

export function RoleSwitcher() {
  const loginAsRole = useGlobalStore((state) => state.loginAsRole)
  const user = useGlobalStore((state) => state.user)

  return (
    <div aria-label={t.system.role} className="segmented-control">
      {roles.map((role) => (
        <button
          className={user?.role === role ? 'active' : ''}
          key={role}
          onClick={() => void loginAsRole(role)}
          type="button"
        >
          {roleLabel[role]}
        </button>
      ))}
    </div>
  )
}
