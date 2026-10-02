export type VoiceAudience = 'patient' | 'client'
export type VoiceAction = 'approach' | 'enter'

export type VoiceSettings = {
  action: VoiceAction
  audience: VoiceAudience
}

export const voiceSettingsStorageKey = 'smartq_voice_settings'

export const defaultVoiceSettings: VoiceSettings = {
  action: 'approach',
  audience: 'patient',
}

const audienceLabels: Record<VoiceAudience, string> = {
  client: 'Клиент',
  patient: 'Пациент',
}

const actionLabels: Record<VoiceAction, string> = {
  approach: 'Подойдите',
  enter: 'Проходите',
}

function isVoiceAudience(value: unknown): value is VoiceAudience {
  return value === 'patient' || value === 'client'
}

function isVoiceAction(value: unknown): value is VoiceAction {
  return value === 'approach' || value === 'enter'
}

function normalizeSettings(value: unknown): VoiceSettings {
  if (!value || typeof value !== 'object') {
    return defaultVoiceSettings
  }

  const record = value as Partial<VoiceSettings>

  return {
    action: isVoiceAction(record.action) ? record.action : defaultVoiceSettings.action,
    audience: isVoiceAudience(record.audience) ? record.audience : defaultVoiceSettings.audience,
  }
}

export function getVoiceAudienceLabel(audience: VoiceAudience): string {
  return audienceLabels[audience]
}

export function getVoiceActionLabel(action: VoiceAction): string {
  return actionLabels[action]
}

export function getVoiceActionText(action: VoiceAction): string {
  return actionLabels[action].toLowerCase()
}

export const voiceSettingsService = {
  getSettings(): VoiceSettings {
    try {
      const saved = window.localStorage.getItem(voiceSettingsStorageKey)

      return saved ? normalizeSettings(JSON.parse(saved)) : defaultVoiceSettings
    } catch {
      return defaultVoiceSettings
    }
  },

  saveSettings(settings: VoiceSettings): VoiceSettings {
    const normalizedSettings = normalizeSettings(settings)

    window.localStorage.setItem(voiceSettingsStorageKey, JSON.stringify(normalizedSettings))

    return normalizedSettings
  },
}
