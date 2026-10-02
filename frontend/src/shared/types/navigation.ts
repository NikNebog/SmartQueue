import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './user'

export type AppRoute = {
  path: string
  label: string
  element: ReactNode
  icon?: LucideIcon
  allowedRoles?: Role[]
  fullscreen?: boolean
  groupLabel?: string
  hideFromSidebar?: boolean
  standalone?: boolean
  public?: boolean
}
