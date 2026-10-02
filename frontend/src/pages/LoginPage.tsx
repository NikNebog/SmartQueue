import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { getAppInitials, useAppSettings } from '@services/appSettingsService'
import { appModeService } from '@services/appModeService'
import { useGlobalStore } from '@store/global'
import { Button } from '@shared/ui/components'
import {
  languageOptions,
  setLanguage,
  useLanguage,
  useLocale,
  type SmartQLanguage,
} from '@shared/locales/useLocale'
import type { Role } from '@shared/types'

const defaultPathByRole: Record<Role, string> = {
  admin: '/dashboard',
  manager: '/dashboard',
  specialist: '/specialist',
}

const compactLanguageLabels: Record<SmartQLanguage, string> = {
  en: 'Eng',
  kk: 'Қаз',
  ru: 'Рус',
}

export function LoginPage() {
  const appSettings = useAppSettings()
  const t = useLocale()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const language = useLanguage()

  const login = useGlobalStore((state) => state.login)
  const navigate = useNavigate()
  const showMockAccounts = appModeService.isMockMode()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(loginValue.trim(), password)
      const user = useGlobalStore.getState().user

      navigate(user ? defaultPathByRole[user.role] : '/dashboard', { replace: true })
    } catch (err) {
      setError(t.auth.invalidCredentials)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          {appSettings.logoDataUrl ? (
            <img alt={appSettings.appName} className="brand-logo brand-logo-lg" src={appSettings.logoDataUrl} />
          ) : (
            <div className="brand-mark">{getAppInitials(appSettings.appName)}</div>
          )}
          <div>
            <span className="eyebrow">
              <ShieldCheck size={14} />
              {t.auth.authorization}
            </span>
            <h1>{appSettings.appName}</h1>
            <p>{t.auth.queueSystem}</p>
          </div>
        </div>

        <div className="mt-10">
          <div className="login-form-heading">
            <h2>{t.auth.systemLogin}</h2>
            <div aria-label={t.common.language} className="login-language-segmented">
              {languageOptions.map((option) => (
                <button
                  className={language === option.value ? 'active' : ''}
                  key={option.value}
                  onClick={() => setLanguage(option.value)}
                  type="button"
                >
                  {compactLanguageLabels[option.value]}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
            {error && (
              <div aria-live="assertive" className="login-error-alert" role="alert">
                <AlertTriangle aria-hidden="true" size={20} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.auth.login}
              </label>
              <input
                type="text"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder={t.auth.loginPlaceholder}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.auth.password}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? t.auth.signingIn : t.auth.signIn}
            </Button>
          </form>

          {showMockAccounts ? (
            <div className="login-help mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold mb-2">Тестовые учётные записи</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>admin@smartq.test / admin123</li>
                <li>manager@smartq.test / manager123</li>
                <li>specialist@smartq.test / specialist123</li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
