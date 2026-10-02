import {
  languageOptions,
  setLanguage,
  useLanguage,
  useLocale,
  type SmartQLanguage,
} from '@shared/locales/useLocale'

type LanguageSelectProps = {
  className?: string
  variant?: 'compact' | 'large'
}

export function LanguageSelect({ className = '', variant = 'compact' }: LanguageSelectProps) {
  const language = useLanguage()
  const t = useLocale()

  if (variant === 'large') {
    return (
      <div aria-label={t.common.language} className={`language-select language-select-large ${className}`}>
        <span>{t.common.language}</span>
        <div className="language-segmented" role="group">
          {languageOptions.map((option) => (
            <button
              aria-pressed={language === option.value}
              className={language === option.value ? 'active' : ''}
              data-smartq-no-i18n
              key={option.value}
              onClick={() => setLanguage(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <label className={`language-select language-select-${variant} ${className}`}>
      <span>{t.common.language}</span>
      <select
        aria-label={t.common.language}
        onChange={(event) => setLanguage(event.target.value as SmartQLanguage)}
        value={language}
      >
        {languageOptions.map((option) => (
          <option data-smartq-no-i18n key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
