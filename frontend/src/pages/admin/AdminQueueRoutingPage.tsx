import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Route, Save } from 'lucide-react'
import { adminService } from '@services/adminService'
import type { TicketSettingsServiceTypeOption } from '@services/api'
import { getServiceOptionLabel } from '@features/tickets/ticketFormOptions'
import { Button } from '@shared/ui/components'
import {
  getAdminErrorMessage,
  getRoomActive,
  getRoomName,
  getRoomServiceTypeIds,
  getRoomTicketIssueEnabled,
  type AdminRoomRecord,
} from './adminPageHelpers'

type QueueRoutingSectionProps = {
  onRoutingChange?: () => void
}

function normalizeId(value?: string | number): string {
  return value == null ? '' : String(value)
}

export function QueueRoutingSection({ onRoutingChange }: QueueRoutingSectionProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState<AdminRoomRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [serviceTypes, setServiceTypes] = useState<TicketSettingsServiceTypeOption[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function loadData() {
    setError(null)
    setLoading(true)

    try {
      const [nextServiceTypes, nextRooms] = await Promise.all([
        adminService.getServiceTypes(),
        adminService.getRooms(),
      ])

      setServiceTypes(nextServiceTypes)
      setRooms(nextRooms as AdminRoomRecord[])
      setServiceTypeId((current) => current || normalizeId(nextServiceTypes[0]?.id))
    } catch (loadError) {
      console.error('Queue routing load failed', loadError)
      setError(getAdminErrorMessage(loadError, 'Не удалось загрузить настройки очередей'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const selectedServiceType = serviceTypes.find((serviceType) => normalizeId(serviceType.id) === serviceTypeId)

  useEffect(() => {
    if (!serviceTypeId) {
      setSelectedRoomIds([])

      return
    }

    setSelectedRoomIds(
      rooms
        .filter((room) => getRoomServiceTypeIds(room).includes(serviceTypeId))
        .map((room) => normalizeId(room.id)),
    )
  }, [rooms, serviceTypeId])

  const sortedRooms = useMemo(
    () => [...rooms].sort((left, right) => getRoomName(left).localeCompare(getRoomName(right), 'ru')),
    [rooms],
  )

  function toggleRoom(roomId: string) {
    setSelectedRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId],
    )
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedServiceType) {
      setError('Выберите тип услуги.')
      return
    }

    setError(null)
    setSaving(true)

    try {
      await adminService.updateQueueRouting(selectedServiceType.id, selectedRoomIds)
      setSuccessMessage('Настройка очереди сохранена')
      await loadData()
      onRoutingChange?.()
    } catch (saveError) {
      console.error('Queue routing save failed', saveError)
      setError(getAdminErrorMessage(saveError, 'Не удалось сохранить настройку очереди'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="admin-page-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                <Route size={14} />
                Маршрутизация
              </span>
              <h2>Настройки очередей</h2>
              <p className="admin-section-description">
                Свяжите одну услугу с несколькими кабинетами. При выдаче талона система выберет доступный кабинет с меньшей очередью.
              </p>
            </div>
          </div>

          {error ? <div className="modal-error">{error}</div> : null}
          {successMessage ? <div className="modal-success">{successMessage}</div> : null}

          {loading ? (
            <div className="empty-state compact-empty">
              <h2>Загружаем настройки очередей</h2>
            </div>
          ) : serviceTypes.length === 0 ? (
            <div className="empty-state compact-empty">
              <h2>Типы услуг не найдены</h2>
              <p>Добавьте типы услуг, чтобы настроить маршрутизацию.</p>
            </div>
          ) : (
            <form className="admin-form queue-routing-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Тип услуги</span>
                <select
                  disabled={saving}
                  onChange={(event) => {
                    setServiceTypeId(event.target.value)
                    setSuccessMessage(null)
                  }}
                  value={serviceTypeId}
                >
                  {serviceTypes.map((serviceType) => (
                    <option key={normalizeId(serviceType.id)} value={normalizeId(serviceType.id)}>
                      {getServiceOptionLabel(serviceType)}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="admin-checkbox-group queue-routing-rooms">
                <legend>Кабинеты</legend>
                {sortedRooms.map((room) => {
                  const roomId = normalizeId(room.id)
                  const active = getRoomActive(room)
                  const issueEnabled = getRoomTicketIssueEnabled(room)

                  return (
                    <label key={roomId}>
                      <input
                        checked={selectedRoomIds.includes(roomId)}
                        disabled={saving}
                        onChange={() => toggleRoom(roomId)}
                        type="checkbox"
                      />
                      <span>{getRoomName(room)}</span>
                      {!active ? <small>Закрыт</small> : null}
                      {active && !issueEnabled ? <small>Выдача отключена</small> : null}
                    </label>
                  )
                })}
              </fieldset>

              <div className="modal-actions">
                <Button
                  disabled={saving || !selectedServiceType}
                  icon={<Save size={16} />}
                  type="submit"
                  variant="primary"
                >
                  {saving ? 'Сохраняем...' : 'Сохранить настройку'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <aside className="widget-panel admin-form-panel">
          <div className="admin-form">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Текущая связка</span>
                <h2>{selectedServiceType?.name ?? 'Услуга не выбрана'}</h2>
              </div>
            </div>
            {selectedRoomIds.length > 0 ? (
              <div className="admin-binding-list">
                {selectedRoomIds.map((roomId) => {
                  const room = rooms.find((item) => normalizeId(item.id) === roomId)

                  return (
                    <article key={roomId}>
                      <strong>{getRoomName(room)}</strong>
                      <span>
                        {room && getRoomActive(room) && getRoomTicketIssueEnabled(room)
                          ? 'Участвует в выдаче при доступной нагрузке'
                          : 'Связан, но сейчас недоступен для выдачи'}
                      </span>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <h2>Кабинеты не выбраны</h2>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
