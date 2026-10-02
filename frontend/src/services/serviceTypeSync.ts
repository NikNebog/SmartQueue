const serviceTypesChangedEventName = 'smartq:service-types-changed'

export function notifyServiceTypesChanged(): void {
  window.dispatchEvent(new Event(serviceTypesChangedEventName))
}

export function subscribeServiceTypesChanged(listener: () => void): () => void {
  window.addEventListener(serviceTypesChangedEventName, listener)

  return () => window.removeEventListener(serviceTypesChangedEventName, listener)
}
