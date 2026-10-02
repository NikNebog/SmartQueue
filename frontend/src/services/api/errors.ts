const defaultMessage = 'Не удалось получить данные'
const technicalMessageParts = [
  'axios',
  'network error',
  'request failed',
  'timeout',
  'econn',
  'stack',
  'cannot ',
]

type ApiErrorResponse = {
  data?: unknown
  status?: number
}

type AxiosErrorLike = {
  isAxiosError?: boolean
  response?: ApiErrorResponse
}

function isAxiosErrorLike(error: unknown): error is AxiosErrorLike {
  return typeof error === 'object'
    && error !== null
    && (error as AxiosErrorLike).isAxiosError === true
}

function looksLikeMojibake(message: string): boolean {
  return /[РСЃ]/.test(message) && /[Ѓ‚„…†‡€‰Љ‹ЊЋЏ]/.test(message)
}

function isUserFacingMessage(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase()

  return /[а-яё]/i.test(message)
    && !looksLikeMojibake(message)
    && !technicalMessageParts.some((part) => normalizedMessage.includes(part))
}

function getBackendMessage(error: unknown): string | undefined {
  if (!isAxiosErrorLike(error)) {
    return undefined
  }

  const data = error.response?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>
    const message = record.message ?? record.error

    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return undefined
}

export function getApiErrorMessage(error: unknown, fallbackMessage = defaultMessage): string {
  if (isAxiosErrorLike(error) && !error.response) {
    return 'Сервис временно недоступен. Проверьте подключение к серверу.'
  }

  if (isAxiosErrorLike(error)) {
    const status = error.response?.status

    if (status === 401) {
      return 'Сессия истекла. Войдите в систему заново.'
    }

    if (status === 403) {
      return 'Недостаточно прав для выполнения действия.'
    }

    if (status === 404) {
      return `${fallbackMessage}. Данные не найдены.`
    }

    if (status && status >= 500) {
      return 'Сервис временно недоступен. Попробуйте позже.'
    }
  }

  const backendMessage = getBackendMessage(error)

  if (backendMessage && isUserFacingMessage(backendMessage)) {
    return backendMessage
  }

  if (error instanceof Error && isUserFacingMessage(error.message)) {
    return error.message
  }

  return fallbackMessage
}

export function toServiceError(error: unknown, fallbackMessage = defaultMessage): Error {
  return new Error(getApiErrorMessage(error, fallbackMessage))
}
