import { useEffect, useRef } from 'react'
import { useQueueStore } from '@store/queue'

type QueueBootstrapOptions = {
  force?: boolean
}

export function useQueueBootstrap(options: QueueBootstrapOptions = {}) {
  const hydrated = useQueueStore((state) => state.hydrated)
  const loadQueue = useQueueStore((state) => state.loadQueue)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) {
      return
    }

    if (options.force || !hydrated) {
      loadedRef.current = true
      void loadQueue({ force: options.force })
    }
  }, [hydrated, loadQueue, options.force])
}
