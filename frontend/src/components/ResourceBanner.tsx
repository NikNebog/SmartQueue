type ResourceBannerProps = {
  error?: string
  loading: boolean
}

export function ResourceBanner({ error, loading }: ResourceBannerProps) {
  if (loading) {
    return <div className="architecture-resource-banner">Загрузка данных через сервисный слой...</div>
  }

  if (error) {
    return <div className="architecture-resource-banner architecture-resource-error">{error}</div>
  }

  return null
}
