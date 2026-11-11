import { vi } from 'vitest'

/** Solo para pruebas: jsdom no tiene maquetación (todo mide 0), y con `hideWhenDetached` Radix da por «desanclado» al
 *  desplegable cuya celda mide 0 y lo oculta. Esto da una celda y una ventana con tamaño para que se vea. Cada prueba que lo usa lo deshace con
 *  `vi.restoreAllMocks()` en su `afterEach`. */
export function maquetarJsdom() {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}) }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768)
}
