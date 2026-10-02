import { useSyncExternalStore } from 'react'
import { en } from './en'
import { kk } from './kk'
import { ru, type Locale } from './ru'
import {
  isSmartQLanguage,
  smartqLanguageStorageKey,
  type SmartQLanguage,
} from './types'

export type { SmartQLanguage } from './types'
export { languageOptions, smartqLanguageStorageKey } from './types'

const dictionaries: Record<SmartQLanguage, Locale> = {
  en,
  kk,
  ru,
}

let currentLanguage: SmartQLanguage = readSavedLanguage()
export let t: Locale = dictionaries[currentLanguage]
const listeners = new Set<() => void>()

function readSavedLanguage(): SmartQLanguage {
  try {
    const savedLanguage = window.localStorage.getItem(smartqLanguageStorageKey)

    return isSmartQLanguage(savedLanguage) ? savedLanguage : 'ru'
  } catch {
    return 'ru'
  }
}

function getLanguageSnapshot(): SmartQLanguage {
  return currentLanguage
}

function notifyLanguageChanged() {
  t = dictionaries[currentLanguage]
  listeners.forEach((listener) => listener())
}

export function getCurrentLanguage(): SmartQLanguage {
  return currentLanguage
}

export function getLocale(language: SmartQLanguage = currentLanguage): Locale {
  return dictionaries[language]
}

export function setLanguage(language: SmartQLanguage): void {
  currentLanguage = language
  window.localStorage.setItem(smartqLanguageStorageKey, language)
  notifyLanguageChanged()
}

export function subscribeLanguageChanged(listener: () => void): () => void {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

export function useLanguage(): SmartQLanguage {
  return useSyncExternalStore(
    subscribeLanguageChanged,
    getLanguageSnapshot,
    getLanguageSnapshot,
  )
}

export function useLocale(): Locale {
  const language = useLanguage()

  return dictionaries[language]
}
