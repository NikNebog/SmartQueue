import type { TicketSettingsServiceTypeOption } from './types'

export const fallbackServiceTypeOptions: TicketSettingsServiceTypeOption[] = [
  { id: 1, code: 'registration', name: 'Регистрация' },
  { id: 2, code: 'consultation', name: 'Консультация терапевта' },
  { id: 3, code: 'consultation', name: 'Консультация педиатра' },
  { id: 4, code: 'consultation', name: 'Консультация кардиолога' },
  { id: 5, code: 'consultation', name: 'Консультация невролога' },
  { id: 6, code: 'consultation', name: 'Консультация хирурга' },
  { id: 7, code: 'laboratory', name: 'Лабораторные анализы' },
  { id: 8, code: 'laboratory', name: 'Забор крови' },
  { id: 9, code: 'diagnostics', name: 'Рентген' },
  { id: 10, code: 'diagnostics', name: 'УЗИ' },
  { id: 11, code: 'diagnostics', name: 'ЭКГ' },
  { id: 12, code: 'diagnostics', name: 'МРТ' },
  { id: 13, code: 'diagnostics', name: 'КТ' },
  { id: 14, code: 'billing', name: 'Оплата услуг' },
  { id: 15, code: 'registration', name: 'Получение справки' },
  { id: 16, code: 'consultation', name: 'Вакцинация' },
  { id: 17, code: 'consultation', name: 'Процедурный кабинет' },
  { id: 18, code: 'registration', name: 'Приём документов' },
  { id: 19, code: 'registration', name: 'Другое' },
]
