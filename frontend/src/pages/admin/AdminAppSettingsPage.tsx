import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus, Settings } from 'lucide-react'
import {
  appSettingsService,
  defaultAppSettings,
  getAppInitials,
  type AppSettings,
} from '@services/appSettingsService'
import { useLocale } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'
import { AdminFileInput } from './AdminFileInput'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

export function AppSettingsSection() {
  const t = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AppSettings>(() => appSettingsService.getSettings())
  const [saving, setSaving] = useState(false)
  const [selectedLogoFileName, setSelectedLogoFileName] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    appSettingsService.loadSettings()
      .then(setForm)
      .catch((loadError) => {
        console.error('App settings load failed', loadError)
        setError(t.admin.settingsLoadError)
      })
  }, [t.admin.settingsLoadError])

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const logoDataUrl = await readFileAsDataUrl(file)

      setForm((current) => ({ ...current, logoDataUrl }))
      setSelectedLogoFileName(file.name)
      setSuccessMessage(null)
    } catch (fileError) {
      console.error('Logo read failed', fileError)
      setError(t.admin.settingsSaveError)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const savedSettings = await appSettingsService.updateSettings({
        appName: form.appName.trim() || defaultAppSettings.appName,
        logoDataUrl: form.logoDataUrl,
      })

      setForm(savedSettings)
      setSuccessMessage(t.admin.settingsSaved)
    } catch (saveError) {
      console.error('App settings save failed', saveError)
      setError(t.admin.settingsSaveError)
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
                <Settings size={14} />
                {t.admin.appSettings}
              </span>
              <h2>{t.admin.appSettings}</h2>
              <p className="admin-section-description">
                {t.system.controlSystem}
              </p>
            </div>
          </div>

          {error ? <div className="modal-error">{error}</div> : null}
          {successMessage ? <div className="modal-success">{successMessage}</div> : null}

          <div className="app-settings-preview">
            {form.logoDataUrl ? (
              <img alt={t.admin.logoPreview} src={form.logoDataUrl} />
            ) : (
              <div className="brand-mark">{getAppInitials(form.appName)}</div>
            )}
            <div>
              <span>{t.admin.logoPreview}</span>
              <strong>{form.appName || defaultAppSettings.appName}</strong>
            </div>
          </div>
        </div>

        <aside className="widget-panel admin-form-panel">
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="panel-header">
              <div>
                <span className="eyebrow">{t.admin.appSettings}</span>
                <h2>{t.admin.saveSettings}</h2>
              </div>
            </div>

            <label className="field">
              <span>{t.admin.appName}</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, appName: event.target.value }))}
                placeholder={t.admin.appNamePlaceholder}
                value={form.appName}
              />
            </label>

            <div className="field">
              <span>{t.admin.appIcon}</span>
              <AdminFileInput
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                fileName={selectedLogoFileName}
                hint={t.file.imageHint}
                id="app-logo-file"
                onChange={(event) => void handleLogoChange(event)}
                onClear={form.logoDataUrl
                  ? () => {
                      setForm((current) => ({ ...current, logoDataUrl: '' }))
                      setSelectedLogoFileName('')
                    }
                  : undefined}
              />
            </div>

            {form.logoDataUrl ? (
              <Button
                icon={<ImagePlus size={16} />}
                onClick={() => {
                  setForm((current) => ({ ...current, logoDataUrl: '' }))
                  setSelectedLogoFileName('')
                }}
                type="button"
                variant="secondary"
              >
                {t.admin.removeLogo}
              </Button>
            ) : null}

            <div className="modal-actions">
              <Button disabled={saving} type="submit" variant="primary">
                {t.admin.saveSettings}
              </Button>
            </div>
          </form>
        </aside>
      </section>
    </div>
  )
}
