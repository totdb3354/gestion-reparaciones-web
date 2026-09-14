const listeners = new Set<(msg: string) => void>()

/** Permite avisar desde fuera de React (p. ej. QueryCache.onError) y lo muestra el AlertaProvider. */
export function emitirError(msg: string) {
  listeners.forEach((l) => l(msg))
}
export function onError(listener: (msg: string) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
