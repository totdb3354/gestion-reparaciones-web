import { useSyncExternalStore } from 'react'

/** Equivalente a ConexionEstado del JavaFX: un flag global que alimenta el banner y el ritmo de refresco. */
let conectado = true
const listeners = new Set<() => void>()

function emitir() {
  listeners.forEach((l) => l())
}
export function reportarFallo() {
  if (conectado) {
    conectado = false
    emitir()
  }
}
export function reportarExito() {
  if (!conectado) {
    conectado = true
    emitir()
  }
}
export function estaConectado() {
  return conectado
}
/** 60 s conectado, 5 s mientras el banner está activo (mismos valores que Poller.java); ver refresco.ts. */
export function intervaloRefresco() {
  return conectado ? 60_000 : 5_000
}
export function useConexion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => conectado,
  )
}
