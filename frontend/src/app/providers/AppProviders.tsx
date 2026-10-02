import { useEffect, type ReactNode } from 'react'
import { appSettingsService, useAppSettings } from '@services/appSettingsService'
import { StaticTextLocalizer } from '@shared/locales/StaticTextLocalizer'
import { useLanguage } from '@shared/locales/useLocale'
import { useGlobalStore } from '@store/global'
import { useQueueStore } from '@store/queue'

type AppProvidersProps = {
  children: ReactNode
}

function shouldSkipAppSettingsLoad(pathname?: string): boolean {
  if (!pathname) {
    return false
  }

  return pathname === '/board' || pathname.startsWith('/board/')
}

export function AppProviders({ children }: AppProvidersProps) {
  const appSettings = useAppSettings()
  const language = useLanguage()
  const theme = useGlobalStore((state) => state.theme)
  const user = useGlobalStore((state) => state.user)
  const startRealtime = useQueueStore((state) => state.startRealtime)
  const stopRealtime = useQueueStore((state) => state.stopRealtime)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('smartq-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    document.title = appSettings.appName
  }, [appSettings.appName])

  useEffect(() => {
    if (typeof window !== 'undefined' && shouldSkipAppSettingsLoad(window.location.pathname)) {
      return
    }

    void appSettingsService.loadSettings()
  }, [])

  useEffect(() => {
    if (!user) {
      stopRealtime()
      return
    }

    startRealtime()

    return () => {
      stopRealtime()
    }
  }, [startRealtime, stopRealtime, user])

  return (
    <>
      <StaticTextLocalizer />
      {children}
    </>
  )
}
