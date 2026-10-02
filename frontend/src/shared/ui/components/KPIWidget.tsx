import type { ReactNode } from 'react'

type KPIWidgetProps = {
  title: string
  value: string | number
  helper?: string
  delta?: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  icon?: ReactNode
}

export function KPIWidget({
  delta,
  helper,
  icon,
  title,
  tone = 'neutral',
  value,
}: KPIWidgetProps) {
  return (
    <article className={`kpi-widget kpi-${tone}`}>
      <div className="kpi-topline">
        <span>{title}</span>
        {icon ? <span className="kpi-icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      <div className="kpi-footer">
        {helper ? <span>{helper}</span> : null}
        {delta ? <b>{delta}</b> : null}
      </div>
    </article>
  )
}
