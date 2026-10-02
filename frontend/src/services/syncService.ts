import { useQueueStore } from '@store/queue'

const defaultSyncMessage = 'Данные успешно обновлены'

export async function refreshOperationalData(successMessage = defaultSyncMessage): Promise<void> {
  await useQueueStore.getState().loadQueue({
    force: true,
    successMessage,
  })
}

export async function withOperationalRefresh<T>(
  operation: () => Promise<T>,
  successMessage = defaultSyncMessage,
): Promise<T> {
  const result = await operation()

  await refreshOperationalData(successMessage)

  return result
}
