import { useSyncExternalStore } from 'react'

/** Estado que sobrevive al cambio de ruta sin vivir en el árbol de React (calco de los campos de un controller
 *  del JavaFX que persisten al cambiar de panel: el texto del filtro IMEI, los técnicos marcados...). */
export type Store<T> = {
  get: () => T
  set: (valor: T | ((prev: T) => T)) => void
  subscribe: (cb: () => void) => () => void
  reset: () => void
}

/** Todos los stores creados, para reiniciarStores. */
const registrados = new Set<Pick<Store<unknown>, 'reset'>>()

/** Para estado de módulo (se crea una vez, al cargar el fichero): el store queda registrado para reiniciarStores y no se
 *  da de baja, así que no debe crearse dentro de un componente. */
export function crearStore<T>(inicial: T): Store<T> {
  let valor = inicial
  const listeners = new Set<() => void>()
  const avisar = () => listeners.forEach((l) => l())
  const store: Store<T> = {
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
  registrados.add(store)
  return store
}

/** Vuelve todos los stores a su valor inicial. SessionProvider lo llama al cerrar sesión y al entrar: calco del JavaFX,
 *  que al volver al login descarta las vistas y sus controllers, y con ellos los filtros. Sin esto, en la misma pestaña
 *  el siguiente usuario heredaría los filtros del anterior (p. ej. un técnico, el filtro de técnico que él no ve). */
export function reiniciarStores() {
  registrados.forEach((s) => s.reset())
}

export function useStore<T>(store: Store<T>): [T, Store<T>['set']] {
  const valor = useSyncExternalStore(store.subscribe, store.get)
  return [valor, store.set]
}
