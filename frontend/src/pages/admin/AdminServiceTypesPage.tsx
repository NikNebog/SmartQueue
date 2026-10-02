import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ClipboardList, PlusCircle } from 'lucide-react'
import { adminService, type AdminServiceTypePayload } from '@services/adminService'
import type { TicketSettingsServiceTypeOption } from '@services/api'
import type { ServiceType } from '@shared/types'
import { Button, StatusBadge } from '@shared/ui/components'
import { getServiceOptionLabel } from '@features/tickets/ticketFormOptions'
import { getAdminErrorMessage, moveItemToTop } from './adminPageHelpers'

type ServiceTypeFormState = {
  active: boolean
  code: ServiceType
  name: string
  nameEn: string
  nameKk: string
  ticketPrefix: string
}

type ServiceTypesSectionProps = {
  onServiceTypesChange?: () => void
}

const emptyForm: ServiceTypeFormState = {
  active: true,
  code: 'consultation',
  name: '',
  nameEn: '',
  nameKk: '',
  ticketPrefix: '',
}

function toForm(serviceType: TicketSettingsServiceTypeOption): ServiceTypeFormState {
  return {
    active: serviceType.active !== false,
    code: serviceType.code,
    name: serviceType.name,
    nameEn: serviceType.translations?.en ?? '',
    nameKk: serviceType.translations?.kk ?? '',
    ticketPrefix: serviceType.ticketPrefix ?? '',
  }
}

function toPayload(form: ServiceTypeFormState): AdminServiceTypePayload {
  return {
    active: form.active,
    code: form.code,
    name: form.name.trim(),
    priorityWeight: 1,
    ticketPrefix: form.ticketPrefix.trim().toUpperCase(),
    translations: {
      ...(form.nameKk.trim() ? { kk: form.nameKk.trim() } : {}),
      ...(form.nameEn.trim() ? { en: form.nameEn.trim() } : {}),
    },
  }
}

export function ServiceTypesSection({ onServiceTypesChange }: ServiceTypesSectionProps) {
  const [editingServiceTypeId, setEditingServiceTypeId] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ServiceTypeFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serviceTypes, setServiceTypes] = useState<TicketSettingsServiceTypeOption[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastSavedServiceTypeIdRef = useRef<string | number | null>(null)

  async function loadData(prioritizedId: string | number | null = lastSavedServiceTypeIdRef.current) {
    setLoading(true)
    setError(null)

    try {
      setServiceTypes(moveItemToTop(await adminService.getServiceTypes(), prioritizedId))
    } catch (loadError) {
      console.error('Admin service types load failed', loadError)
      setError(getAdminErrorMessage(loadError, 'Не удалось загрузить типы услуг'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function resetForm() {
    setEditingServiceTypeId(null)
    setForm(emptyForm)
    setError(null)
  }

  function handleEdit(serviceType: TicketSettingsServiceTypeOption) {
    setEditingServiceTypeId(serviceType.id)
    setForm(toForm(serviceType))
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Введите название услуги.')
      return
    }

    if (!form.ticketPrefix.trim()) {
      setError('Введите уникальный префикс талона.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = toPayload(form)
      const savedServiceType = editingServiceTypeId
        ? await adminService.updateServiceType(editingServiceTypeId, payload)
        : await adminService.createServiceType(payload)

      lastSavedServiceTypeIdRef.current = savedServiceType.id
      setServiceTypes((current) => moveItemToTop(current, savedServiceType))
      setSuccessMessage('Типы услуг обновлены')
      resetForm()
      await loadData(savedServiceType.id)
      onServiceTypesChange?.()
    } catch (saveError) {
      console.error('Admin service type save failed', saveError)
      setError(getAdminErrorMessage(
        saveError,
        editingServiceTypeId ? 'Не удалось сохранить тип услуги' : 'Не удалось создать тип услуги',
      ))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(serviceType: TicketSettingsServiceTypeOption) {
    if (!window.confirm(`Удалить или деактивировать тип услуги "${serviceType.name}"?`)) {
      return
    }

    setError(null)

    try {
      await adminService.deleteServiceType(serviceType.id)
      setSuccessMessage('Тип услуги деактивирован')
      await loadData()
      onServiceTypesChange?.()
    } catch (deleteError) {
      console.error('Admin service type delete failed', deleteError)
      setError(getAdminErrorMessage(deleteError, 'Не удалось удалить тип услуги'))
    }
  }

  return (
    <div className="page-stack">
      <section className="admin-page-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                <ClipboardList size={14} />
                Справочник
              </span>
              <h2>Типы услуг</h2>
              <p className="admin-section-description">
                Управляйте услугами, их доступностью и уникальными префиксами талонов.
              </p>
            </div>
            <Button icon={<PlusCircle size={17} />} onClick={resetForm} variant="secondary">
              Добавить тип услуги
            </Button>
          </div>

          {error ? <div className="modal-error">{error}</div> : null}
          {successMessage ? <div className="modal-success">{successMessage}</div> : null}

          {loading ? (
            <div className="empty-state compact-empty">
              <h2>Загружаем типы услуг</h2>
            </div>
          ) : serviceTypes.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Название услуги</th>
                    <th>Префикс</th>
                    <th>Активна</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceTypes.map((serviceType) => (
                    <tr key={String(serviceType.id)}>
                      <td>{getServiceOptionLabel(serviceType)}</td>
                      <td>{serviceType.ticketPrefix ?? '-'}</td>
                      <td>
                        <StatusBadge
                          label={serviceType.active === false ? 'Неактивна' : 'Активна'}
                          tone={serviceType.active === false ? 'warning' : 'success'}
                        />
                      </td>
                      <td>
                        <div className="button-row">
                          <Button onClick={() => handleEdit(serviceType)} size="sm" variant="secondary">
                            Редактировать
                          </Button>
                          <Button onClick={() => void handleDelete(serviceType)} size="sm" variant="danger">
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
              <h2>Типы услуг не найдены</h2>
              <p>Добавьте первый тип услуги для маршрутизации очереди.</p>
            </div>
          )}
        </div>

        <aside className="widget-panel admin-form-panel">
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="panel-header">
              <div>
                <span className="eyebrow">Тип услуги</span>
                <h2>{editingServiceTypeId ? 'Редактировать тип услуги' : 'Добавить тип услуги'}</h2>
              </div>
            </div>

            <label className="field">
              <span>Название услуги на русском</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Консультация терапевта"
                value={form.name}
              />
            </label>

            <label className="field">
              <span>Название услуги на казахском</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, nameKk: event.target.value }))}
                placeholder="Терапевт кеңесі"
                value={form.nameKk}
              />
            </label>

            <label className="field">
              <span>Название услуги на английском</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))}
                placeholder="Therapist consultation"
                value={form.nameEn}
              />
            </label>

            <label className="field">
              <span>Префикс талона</span>
              <input
                maxLength={4}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  ticketPrefix: event.target.value.toUpperCase().replace(/\s+/g, ''),
                }))}
                placeholder="К"
                value={form.ticketPrefix}
              />
            </label>

            <label className="admin-toggle-row">
              <input
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                type="checkbox"
              />
              <span>Активна</span>
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
