import { useSyncExternalStore } from 'react'

/** Estado que sobrevive al cambio de ruta sin vivir en el árbol de React (calco de los campos de un controller
 *  del JavaFX que persisten al cambiar de panel: el texto del filtro IMEI, los técnicos marcados...). */
export type Store<T> = {
  get: () => T
  set: (valor: T | ((prev: T) => T)) => void
  subscribe: (cb: () => void) => () => void
  reset: () => void
}

export function crearStore<T>(inicial: T): Store<T> {
  let valor = inicial
  const listeners = new Set<() => void>()
  const avisar = () => listeners.forEach((l) => l())
  return {
    get: () => valor,
    set: (v) => {
      valor = typeof v === 'function' ? (v as (prev: T) => T)(valor) : v
      avisar()
    },
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    reset: () => {
      valor = inicial
      avisar()
    },
  }
}

export function useStore<T>(store: Store<T>): [T, Store<T>['set']] {
  const valor = useSyncExternalStore(store.subscribe, store.get)
  return [valor, store.set]
}
