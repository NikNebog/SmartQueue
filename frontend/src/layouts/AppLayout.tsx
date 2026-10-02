import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { AppRoute } from '@shared/types'
import { Sidebar } from './Sidebar'
import { TopNavbar } from './TopNavbar'

type AppLayoutProps = {
  routes: AppRoute[]
}

export function AppLayout({ routes }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        routes={routes}
      />
      <main className="app-main">
        <TopNavbar routes={routes} />
        <div className="page-viewport">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
