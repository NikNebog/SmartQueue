import { Moon, Sun } from 'lucide-react'
import { t } from '@shared/locales/useLocale'
import { useGlobalStore } from '@store/global/useGlobalStore'
import { IconButton } from './IconButton'

export function ThemeToggle() {
  const setTheme = useGlobalStore((state) => state.setTheme)
  const theme = useGlobalStore((state) => state.theme)
  const isDark = theme === 'dark'

  return (
    <IconButton
      active={isDark}
      icon={isDark ? <Moon size={18} /> : <Sun size={18} />}
      label={isDark ? t.system.darkTheme : t.system.lightTheme}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    />
  )
}
