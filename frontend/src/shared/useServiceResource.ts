import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '@services/api'

export type ServiceResource<T> = {
  data: T
  error?: string
  loading: boolean
}

export function useServiceResource<T>(
  loader: () => Promise<T>,
  initialData: T,
): ServiceResource<T> {
  const [resource, setResource] = useState<ServiceResource<T>>({
    data: initialData,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    loader()
      .then((data) => {
        if (mounted) {
          setResource({ data, loading: false })
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setResource({
            data: initialData,
            error: getApiErrorMessage(error, 'Не удалось загрузить данные'),
            loading: false,
          })
        }
      })

    return () => {
      mounted = false
    }
  }, [initialData, loader])

  return resource
}
