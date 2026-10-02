import type { ReactNode } from 'react'

type DataPanelProps = {
  children: ReactNode
  title: string
  description?: string
}

export function DataPanel({ children, description, title }: DataPanelProps) {
  return (
    <section className="architecture-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Сервисный слой</span>
          <h2>{title}</h2>
          {description ? <p className="architecture-panel-copy">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}
