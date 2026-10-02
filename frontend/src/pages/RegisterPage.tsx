import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useGlobalStore } from '@store/global'
import { Button } from '@shared/ui/components'
import { t } from '@shared/locales/useLocale'
import type { Role } from '@shared/types'

const roles: Role[] = ['manager', 'specialist']

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<Role>('manager')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useGlobalStore((state) => state.register)
  const navigate = useNavigate()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Пожалуйста, заполните все поля.')
      return
    }

    if (password !== confirmPassword) {
      setError(t.auth.passwordsMismatch)
      return
    }

    setIsLoading(true)

    try {
      await register(name.trim(), email.trim(), password, role)
      navigate('/dashboard')
    } catch (err) {
      setError('Не удалось создать аккаунт. Проверьте данные и подключение к серверу.')
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
              {t.auth.registerTitle}
            </span>
            <h1>{t.auth.registerSubtitle}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label>{t.auth.name}</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Иван Иванов"
              required
            />
          </div>

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

          <div>
            <label>{t.auth.password}</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label>{t.auth.confirmPassword}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label>{t.auth.role}</label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3"
            >
              {roles.map((option) => (
                <option key={option} value={option}>
                  {t.roles[option]}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" className="w-full py-3.5 text-base font-medium" disabled={isLoading}>
            {isLoading ? 'Сохраняем...' : t.auth.submitRegister}
          </Button>
        </form>

        <div className="login-help mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>{t.auth.backToLogin}</p>
          <Link to="/login" className="text-sky-600 hover:text-sky-700 font-medium hover:underline">
            {t.auth.loginLink}
          </Link>
        </div>
      </section>
    </main>
  )
}
