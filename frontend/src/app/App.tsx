import { AppProviders } from '@app/providers/AppProviders'
import { AppRouter } from '@routes'
import { useLocale } from '@shared/locales/useLocale'
import type { AppRoute } from '@shared/types'

type AppProps = {
  routes: AppRoute[]
}

export function App({ routes }: AppProps) {
  const t = useLocale()
  const localizedRoutes = routes.map((route) => {
    const labelByPath: Record<string, string> = {
      '/admin': t.nav.admin,
      '/admin/doctor-rooms': t.nav.admin,
      '/admin/managers': t.nav.managers,
      '/admin/queue-routing': t.nav.admin,
      '/admin/rooms': t.nav.rooms,
      '/admin/routing': t.nav.admin,
      '/admin/staff': t.nav.staff,
      '/analytics': t.nav.analytics,
      '/board': t.nav.tvBoard,
      '/dashboard': t.nav.dashboard,
      '/kiosk': t.nav.kiosk,
      '/queue': t.nav.dashboard,
      '/specialist': t.nav.specialist,
      '/tickets': t.nav.createTicket,
      '/visit-history': t.nav.visitHistory,
    }

    return {
      ...route,
      label: labelByPath[route.path] ?? route.label,
    }
  })

  return (
    <AppProviders>
      <AppRouter routes={localizedRoutes} />
    </AppProviders>
  )
}
