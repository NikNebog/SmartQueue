type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
}

export function PageHeader({ description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="architecture-page-header">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  )
}
