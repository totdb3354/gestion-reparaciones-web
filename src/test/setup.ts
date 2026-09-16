import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { reportarExito } from '@/shared/api/conexion'
import { reiniciarStores } from '@/shared/lib/store'
import { rearmarSesionExpirada } from '@/shared/session/expiracion'
import { server } from './server'

// Polyfills que Radix (popover, dropdown, context-menu) necesita y jsdom no trae.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  // Los stores de módulo (filtros del taller) sobreviven entre tests de un mismo fichero: se vuelven a su valor inicial
  // después de desmontar, igual que al cerrar sesión.
  reiniciarStores()
  server.resetHandlers()
  sessionStorage.clear()
  reportarExito()
  // El disparo de sesión expirada es global y de una sola vez: sin rearmar, un test lo dejaría gastado
  // para los siguientes.
  rearmarSesionExpirada()
})
afterAll(() => server.close())
