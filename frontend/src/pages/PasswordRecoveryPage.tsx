import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { userService } from '@services/userService'
import { Button } from '@shared/ui/components'
import { t } from '@shared/locales/useLocale'

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email.trim()) {
      setError(t.auth.invalidLogin)
      return
    }

    setIsLoading(true)

    try {
      await userService.resetPassword(email.trim())
      setSuccess(true)
    } catch (err) {
      setError('Не удалось отправить письмо. Проверьте подключение к серверу.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">SQ</div>
          <div>
            <span className="eyebrow">
              <ShieldCheck size={14} />
              {t.auth.forgotTitle}
            </span>
            <h1>{t.auth.forgotSubtitle}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-emerald-700">
              {t.auth.recoveryEmailSent}
            </div>
          )}

          <div>
            <label>{t.auth.email}</label>
            <input
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Введите логин"
              required
            />
          </div>

          <Button type="submit" className="w-full py-3.5 text-base font-medium" disabled={isLoading}>
            {isLoading ? 'Отправляем...' : t.auth.submitReset}
          </Button>
        </form>

        <div className="login-help mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <Link to="/login" className="text-sky-600 hover:text-sky-700 font-medium hover:underline">
            {t.auth.loginLink}
          </Link>
        </div>
      </section>
    </main>
  )
}
