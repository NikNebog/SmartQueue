type ShellPageProps = {
  eyebrow: string
  title: string
  description: string
}

export function ShellPage({ description, eyebrow, title }: ShellPageProps) {
  return (
    <section className="shell-placeholder">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
