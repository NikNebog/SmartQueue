import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PlusCircle, ShieldCheck } from 'lucide-react'
import { adminService } from '@services/adminService'
import type { User } from '@shared/types'
import { Button } from '@shared/ui/components'
import { getAdminErrorMessage, getUserLogin, moveItemToTop } from './adminPageHelpers'

type ManagerFormState = {
  login: string
  name: string
  password: string
}

const emptyForm: ManagerFormState = {
  login: '',
  name: '',
  password: '',
}

type ManagersSectionProps = {
  onManagersChange?: () => void
}

export function ManagersSection({ onManagersChange }: ManagersSectionProps) {
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ManagerFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastSavedManagerIdRef = useRef<string | number | null>(null)

  async function loadData(prioritizedId: string | number | null = lastSavedManagerIdRef.current) {
    setLoading(true)
    setError(null)

    try {
      setManagers(moveItemToTop(await adminService.getManagers(), prioritizedId))
    } catch (loadError) {
      console.error('Admin managers load failed', loadError)
      setError(getAdminErrorMessage(loadError, 'Не удалось загрузить менеджеров'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function resetForm() {
    setEditingManagerId(null)
    setForm(emptyForm)
    setError(null)
  }

  function handleEdit(manager: User) {
    setEditingManagerId(manager.id)
    setForm({
      login: manager.email ?? '',
      name: manager.name,
      password: '',
    })
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim() || !form.login.trim()) {
      setError('Введите имя и логин.')
      return
    }

    if (!editingManagerId && !form.password.trim()) {
      setError('Введите пароль для нового менеджера.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      email: form.login.trim(),
      name: form.name.trim(),
      password: form.password.trim() || undefined,
    }

    try {
      const savedManager = editingManagerId
        ? await adminService.updateManager(editingManagerId, payload)
        : await adminService.createManager(payload)

      lastSavedManagerIdRef.current = savedManager.id
      setManagers((current) => moveItemToTop(current, savedManager))
      setSuccessMessage('Менеджер успешно сохранён')
      resetForm()
      await loadData(savedManager.id)
      onManagersChange?.()
    } catch (saveError) {
      console.error('Admin manager save failed', saveError)
      setError(getAdminErrorMessage(
        saveError,
        editingManagerId ? 'Не удалось сохранить пользователя' : 'Не удалось создать менеджера',
      ))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(manager: User) {
    if (!window.confirm(`Удалить менеджера "${manager.name}"?`)) {
      return
    }

    setError(null)

    try {
      await adminService.deleteManager(manager.id)
      setSuccessMessage('Менеджер удалён')
      await loadData()
      onManagersChange?.()
    } catch (deleteError) {
      console.error('Admin manager delete failed', deleteError)
      setError(getAdminErrorMessage(deleteError, 'Не удалось удалить менеджера'))
    }
  }

  return (
    <div className="page-stack">
      <section className="admin-page-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                <ShieldCheck size={14} />
                Управление
              </span>
              <h2>Менеджеры</h2>
              <p className="admin-section-description">
                Управление аккаунтами менеджеров.
              </p>
            </div>
            <Button icon={<PlusCircle size={17} />} onClick={resetForm} variant="secondary">
              Добавить менеджера
            </Button>
          </div>

          {error ? <div className="modal-error">{error}</div> : null}
          {successMessage ? <div className="modal-success">{successMessage}</div> : null}

          {loading ? (
            <div className="empty-state compact-empty">
              <h2>Загружаем менеджеров</h2>
            </div>
          ) : managers.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Логин</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map((manager) => (
                    <tr key={manager.id}>
                      <td>{manager.name}</td>
                      <td>{getUserLogin(manager)}</td>
                      <td>
                        <div className="button-row">
                          <Button onClick={() => handleEdit(manager)} size="sm" variant="secondary">
                            Редактировать
                          </Button>
                          <Button onClick={() => void handleDelete(manager)} size="sm" variant="danger">
                            Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h2>Менеджеры не найдены</h2>
              <p>Добавьте менеджера для работы с очередями.</p>
            </div>
          )}
        </div>

        <aside className="widget-panel admin-form-panel">
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="panel-header">
              <div>
                <span className="eyebrow">Менеджер</span>
                <h2>{editingManagerId ? 'Редактировать менеджера' : 'Добавить менеджера'}</h2>
              </div>
            </div>

            <label className="field">
              <span>Имя</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Амина Каримова"
                value={form.name}
              />
            </label>

            <label className="field">
              <span>Логин</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
                placeholder="Введите логин"
                type="text"
                value={form.login}
              />
            </label>

            <label className="field">
              <span>Пароль</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={editingManagerId ? 'Оставьте пустым без изменений' : 'Пароль'}
                type="password"
                value={form.password}
              />
            </label>

            <div className="modal-actions">
              <Button disabled={saving} onClick={resetForm} variant="ghost">
                Отмена
              </Button>
              <Button disabled={saving} type="submit" variant="primary">
                Сохранить
              </Button>
            </div>
          </form>
        </aside>
      </section>
    </div>
  )
}

export function AdminManagersPage() {
  return <ManagersSection />
}
