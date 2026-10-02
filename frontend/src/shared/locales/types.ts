export type SmartQLanguage = 'kk' | 'ru' | 'en'

export type LanguageOption = {
  label: string
  value: SmartQLanguage
}

export const smartqLanguageStorageKey = 'smartq_language'

export const languageOptions: LanguageOption[] = [
  { label: 'Қазақша', value: 'kk' },
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
]

export function isSmartQLanguage(value: unknown): value is SmartQLanguage {
  return value === 'kk' || value === 'ru' || value === 'en'
}
