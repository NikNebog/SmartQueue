import type { BoardTemplate } from './api'

export type BoardTemplateOption = {
  description: string
  label: string
  value: BoardTemplate
}

export const defaultBoardTemplate: BoardTemplate = 'classic'

export const boardTemplateOptions: BoardTemplateOption[] = [
  { description: 'Текущий вызов + история', label: 'Классический', value: 'classic' },
  { description: 'Несколько вызовов крупными плитками', label: 'Сетка', value: 'grid' },
  { description: 'Компактный список талонов и мест', label: 'Список', value: 'list' },
  { description: 'Только текущий вызов', label: 'Минималистичный', value: 'minimal' },
  { description: 'Большие карточки вызовов', label: 'Крупные карточки', value: 'cards' },
  { description: 'Видео справа, очередь слева', label: 'Видео + очередь', value: 'video_queue' },
  { description: 'Один вызов на весь экран', label: 'Крупное табло', value: 'big_board' },
]
