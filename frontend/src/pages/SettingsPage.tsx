import { PlugZap, RadioTower, ShieldCheck } from 'lucide-react'
import { t } from '@shared/locales/useLocale'
import { RoleSwitcher, ThemeToggle } from '@shared/ui/core-components'
import { useGlobalStore } from '@store/global'

export function SettingsPage() {
  const user = useGlobalStore((state) => state.user)

  if (!user) {
    return null
  }

  return (
    <div className="page-stack">
      <section className="content-grid settings-grid">
        <div className="primary-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                <ShieldCheck size={14} />
                {t.settings.systemProfile}
              </span>
              <h2>{t.settings.title}</h2>
            </div>
          </div>

          <div className="settings-list">
            <article className="settings-row">
              <div>
                <strong>{t.settings.currentRole}</strong>
                <span>{user.name} / {user.department}</span>
              </div>
              <RoleSwitcher />
            </article>
            <article className="settings-row">
              <div>
                <strong>{t.settings.theme}</strong>
                <span>{t.settings.themeDescription}</span>
              </div>
              <ThemeToggle />
            </article>
          </div>
        </div>

        <aside className="side-column">
          <section className="widget-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  <PlugZap size={14} />
                  {t.settings.rest}
                </span>
                <h2>{t.settings.apiReadiness}</h2>
              </div>
            </div>
            <p className="muted-copy">{t.settings.apiReadinessDescription}</p>
          </section>
          <section className="widget-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  <RadioTower size={14} />
                  {t.settings.websocket}
                </span>
                <h2>{t.settings.realtimeReadiness}</h2>
              </div>
            </div>
            <p className="muted-copy">{t.settings.realtimeReadinessDescription}</p>
          </section>
        </aside>
      </section>
    </div>
  )
}
