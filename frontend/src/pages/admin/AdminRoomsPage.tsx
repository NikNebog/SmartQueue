import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Building2, PlusCircle } from 'lucide-react'
import { adminService } from '@services/adminService'
import { queueService } from '@services/queueService'
import { notifyServiceTypesChanged, subscribeServiceTypesChanged } from '@services/serviceTypeSync'
import type { RoomQueueStat, TicketSettingsServiceTypeOption } from '@services/api'
import { getServiceOptionLabel } from '@features/tickets/ticketFormOptions'
import type { ServicePlaceType } from '@shared/types'
import { Button } from '@shared/ui/components'
import { formatWaitingTime } from '@shared/utils'
import {
  formatRoomName,
  getRoomBoardId,
  getRoomPlaceType,
  isValidRoomNumber,
  normalizeWorkTime,
} from '@shared/utils'
import {
  getRoomActive,
  getAdminErrorMessage,
  getRoomName,
  getRoomServiceTypeIds,
  getServiceTypeNames,
  moveItemToTop,
  type AdminRoomRecord,
} from './adminPageHelpers'

type RoomFormState = {
  active: boolean
  estimatedWaitMinutes: string
  number: string
  placeType: ServicePlaceType
  serviceTypeIds: string[]
  workEndTime: string
  workStartTime: string
}

const emptyForm: RoomFormState = {
  active: true,
  estimatedWaitMinutes: '',
  number: '',
  placeType: 'room',
  serviceTypeIds: [],
  workEndTime: '',
  workStartTime: '',
}

const placeTypeOptions: Array<{ label: string; value: ServicePlaceType }> = [
  { label: 'Кабинет', value: 'room' },
  { label: 'Окно', value: 'window' },
  { label: 'Стол', value: 'desk' },
]

type RoomsSectionProps = {
  onRoomsChange?: () => void
}

function normalizeId(value: string): string | number {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && value.trim() !== '' ? numberValue : value
}

function toRoomNumberInput(room: AdminRoomRecord): string {
  return getRoomBoardId(room)
}

function normalizeRoomNumberInput(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

function getRoomWorkTimeLabel(room: AdminRoomRecord): string {
  const workStartTime = normalizeWorkTime(room.workStartTime ?? room.workingStartTime ?? room.work_start_time)
  const workEndTime = normalizeWorkTime(room.workEndTime ?? room.workingEndTime ?? room.work_end_time)

  if (workStartTime && workEndTime) {
    return `с ${workStartTime} до ${workEndTime}`
  }

  if (workStartTime) {
    return `с ${workStartTime}`
  }

  if (workEndTime) {
    return `до ${workEndTime}`
  }

  return 'Весь день'
}

export function RoomsSection({ onRoomsChange }: RoomsSectionProps) {
  const [editingRoomId, setEditingRoomId] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<RoomFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState<AdminRoomRecord[]>([])
  const [roomStatsByRoomId, setRoomStatsByRoomId] = useState<Map<string, RoomQueueStat>>(new Map())
  const [saving, setSaving] = useState(false)
  const [serviceTypes, setServiceTypes] = useState<TicketSettingsServiceTypeOption[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastSavedRoomIdRef = useRef<string | number | null>(null)

  async function loadData(prioritizedId: string | number | null = lastSavedRoomIdRef.current) {
    setLoading(true)
    setError(null)

    try {
      const [nextRooms, nextServiceTypes, nextRoomStats] = await Promise.all([
        adminService.getRooms(),
        adminService.getServiceTypes(),
        queueService.getRoomStats().catch(() => []),
      ])

      setRooms(moveItemToTop(nextRooms as AdminRoomRecord[], prioritizedId))
      setRoomStatsByRoomId(new Map(nextRoomStats.map((item) => [String(item.roomId), item])))
      setServiceTypes(nextServiceTypes)
    } catch (loadError) {
      console.error('Admin rooms load failed', loadError)
      setError(getAdminErrorMessage(loadError, 'Не удалось загрузить кабинеты'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => subscribeServiceTypesChanged(() => {
    void loadData()
  }), [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadData()
    }, 15_000)

    return () => window.clearInterval(intervalId)
  }, [])

  function resetForm() {
    setEditingRoomId(null)
    setForm(emptyForm)
    setError(null)
  }

  function handleEdit(room: AdminRoomRecord) {
    setEditingRoomId(room.id)
    setForm({
      active: getRoomActive(room),
      estimatedWaitMinutes: room.estimatedWaitMinutes == null ? '' : String(room.estimatedWaitMinutes),
      number: toRoomNumberInput(room),
      placeType: getRoomPlaceType(room),
      serviceTypeIds: getRoomServiceTypeIds(room),
      workEndTime: room.workEndTime ?? room.workingEndTime ?? room.work_end_time ?? '',
      workStartTime: room.workStartTime ?? room.workingStartTime ?? room.work_start_time ?? '',
    })
    setSuccessMessage(null)
  }

  function toggleServiceType(id: string) {
    setForm((current) => ({
      ...current,
      serviceTypeIds: current.serviceTypeIds.includes(id)
        ? current.serviceTypeIds.filter((item) => item !== id)
        : [...current.serviceTypeIds, id],
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const roomNumber = normalizeRoomNumberInput(form.number)

    if (!isValidRoomNumber(roomNumber)) {
      setError('Введите номер, например 12 или 12А')
      return
    }

    setSaving(true)
    setError(null)

    const roomName = formatRoomName({
      number: roomNumber,
      placeType: form.placeType,
    })
    const payload = {
      active: form.active,
      estimatedWaitMinutes: form.estimatedWaitMinutes.trim() === '' ? null : Number(form.estimatedWaitMinutes),
      isActive: form.active,
      name: roomName,
      number: roomNumber,
      placeType: form.placeType,
      serviceTypeIds: form.serviceTypeIds.map(normalizeId),
      workEndTime: form.workEndTime || undefined,
      workStartTime: form.workStartTime || undefined,
      workingEndTime: form.workEndTime || undefined,
      workingStartTime: form.workStartTime || undefined,
    }

    try {
      const savedRoom = editingRoomId
        ? await adminService.updateRoom(editingRoomId, payload)
        : await adminService.createRoom(payload)

      lastSavedRoomIdRef.current = savedRoom.id
      setRooms((current) => moveItemToTop(current, savedRoom as AdminRoomRecord))

      setSuccessMessage('Место обслуживания успешно сохранено')
      resetForm()
      await loadData(savedRoom.id)
      notifyServiceTypesChanged()
      onRoomsChange?.()
    } catch (saveError) {
      console.error('Admin room save failed', saveError)
      setError(getAdminErrorMessage(
        saveError,
        editingRoomId ? 'Не удалось сохранить место обслуживания' : 'Не удалось создать место обслуживания',
      ))
    } finally {
      setSaving(false)
    }
  }

  const currentAverageWaitByRoomId = useMemo(() => roomStatsByRoomId, [roomStatsByRoomId])

  function getRoomWaitLabel(room: AdminRoomRecord): string {
    const currentAverage = currentAverageWaitByRoomId.get(String(room.id))?.etaMinutes

    if (currentAverage !== undefined) {
      return `${formatWaitingTime(currentAverage)} (текущее)`
    }

    if (typeof room.estimatedWaitMinutes === 'number') {
      return `${formatWaitingTime(room.estimatedWaitMinutes)} (базовое)`
    }

    return 'Нет данных'
  }

  async function handleDelete(room: AdminRoomRecord) {
    if (!window.confirm(`Удалить место обслуживания "${getRoomName(room)}"?`)) {
      return
    }

    setError(null)

    try {
      await adminService.deleteRoom(room.id)
      setSuccessMessage('Место обслуживания удалено')
      await loadData()
      onRoomsChange?.()
    } catch (deleteError) {
      console.error('Admin room delete failed', deleteError)
      setError(getAdminErrorMessage(deleteError, 'Не удалось удалить место обслуживания'))
    }
  }

  return (
    <div className="page-stack">
      <section className="admin-page-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                <Building2 size={14} />
                Управление
              </span>
              <h2>Кабинеты</h2>
              <p className="admin-section-description">
                Создание, редактирование и деактивация мест обслуживания учреждения.
              </p>
            </div>
            <Button icon={<PlusCircle size={17} />} onClick={resetForm} variant="secondary">
              Добавить место
            </Button>
          </div>

          {error ? <div className="modal-error">{error}</div> : null}
          {successMessage ? <div className="modal-success">{successMessage}</div> : null}

          {loading ? (
            <div className="empty-state compact-empty">
              <h2>Загружаем кабинеты</h2>
            </div>
          ) : rooms.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Место обслуживания</th>
                    <th>Типы услуг</th>
                    <th>Примерное ожидание</th>
                    <th>Рабочее время</th>
                    <th>Активен</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={String(room.id)}>
                      <td>{getRoomName(room)}</td>
                      <td>{getServiceTypeNames(room, serviceTypes)}</td>
                      <td>{getRoomWaitLabel(room)}</td>
                      <td>{getRoomWorkTimeLabel(room)}</td>
                      <td>{getRoomActive(room) ? 'Да' : 'Нет'}</td>
                      <td>
                        <div className="button-row">
                          <Button onClick={() => handleEdit(room)} size="sm" variant="secondary">
                            Редактировать
                          </Button>
                          <Button onClick={() => void handleDelete(room)} size="sm" variant="danger">
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
              <h2>Кабинеты не найдены</h2>
              <p>Добавьте первое место обслуживания.</p>
            </div>
          )}
        </div>

        <aside className="widget-panel admin-form-panel">
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="panel-header">
              <div>
                <span className="eyebrow">Место обслуживания</span>
                <h2>{editingRoomId ? 'Редактировать место' : 'Добавить место'}</h2>
              </div>
            </div>

            <label className="field">
              <span>Тип места</span>
              <select
                onChange={(event) => setForm((current) => ({
                  ...current,
                  placeType: event.target.value as ServicePlaceType,
                }))}
                value={form.placeType}
              >
                {placeTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Номер</span>
              <input
                inputMode="text"
                onChange={(event) => setForm((current) => ({
                  ...current,
                  number: normalizeRoomNumberInput(event.target.value),
                }))}
                pattern="\d+[A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]?"
                placeholder="12А"
                title="Введите номер, например 12 или 12А"
                value={form.number}
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Время начала работы</span>
                <input
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    workStartTime: event.target.value,
                  }))}
                  type="time"
                  value={form.workStartTime}
                />
              </label>

              <label className="field">
                <span>Время окончания работы</span>
                <input
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    workEndTime: event.target.value,
                  }))}
                  type="time"
                  value={form.workEndTime}
                />
              </label>
            </div>

            <label className="field">
              <span>Базовое ожидание, мин</span>
              <input
                inputMode="numeric"
                min="0"
                onChange={(event) => setForm((current) => ({
                  ...current,
                  estimatedWaitMinutes: event.target.value.replace(/[^\d]/g, ''),
                }))}
                placeholder="Например 15"
                type="number"
                value={form.estimatedWaitMinutes}
              />
            </label>

            <fieldset className="admin-checkbox-group">
              <legend>Типы услуг</legend>
              {serviceTypes.map((serviceType) => (
                <label key={String(serviceType.id)}>
                  <input
                    checked={form.serviceTypeIds.includes(String(serviceType.id))}
                    onChange={() => toggleServiceType(String(serviceType.id))}
                    type="checkbox"
                  />
                  <span>{getServiceOptionLabel(serviceType)}</span>
                </label>
              ))}
            </fieldset>

            <label className="admin-toggle-row">
              <input
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                type="checkbox"
              />
              <span>Активен</span>
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

export function AdminRoomsPage() {
  return <RoomsSection />
}
