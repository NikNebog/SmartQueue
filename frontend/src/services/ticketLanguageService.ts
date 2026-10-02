import type { SmartQLanguage } from '@shared/locales/types'
import { isSmartQLanguage } from '@shared/locales/types'

const ticketLanguageStorageKey = 'smartq_ticket_languages'

function readLanguages(): Record<string, SmartQLanguage> {
  try {
    const saved = window.localStorage.getItem(ticketLanguageStorageKey)
    const record = saved ? JSON.parse(saved) as Record<string, unknown> : {}

    return Object.fromEntries(
      Object.entries(record).filter((entry): entry is [string, SmartQLanguage] => isSmartQLanguage(entry[1])),
    )
  } catch {
    return {}
  }
}

function writeLanguages(languages: Record<string, SmartQLanguage>): void {
  window.localStorage.setItem(ticketLanguageStorageKey, JSON.stringify(languages))
}

export const ticketLanguageService = {
  getTicketLanguage(ticketId?: string | number): SmartQLanguage | undefined {
    if (ticketId === undefined || ticketId === null) {
      return undefined
    }

    return readLanguages()[String(ticketId)]
  },

  saveTicketLanguage(ticketId: string | number, language: SmartQLanguage): void {
    writeLanguages({
      ...readLanguages(),
      [String(ticketId)]: language,
    })
  },
}
