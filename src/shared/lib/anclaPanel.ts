/**
 * Dónde va el panel flotante de la carga de técnicos (spec 0.9.20 §2, «Posición»): pegado a una esquina de la pantalla, a
 * una distancia de sus dos bordes. Panel y pastilla comparten el ancla: la pastilla sale en la esquina del panel más cercana
 * al borde y el panel, al abrirse, crece desde ahí. Todo en píxeles de la ventana y sin DOM (salvo `huecoVentana`), para
 * probarlo solo.
 */

/** Esquina: `b`/`t` (abajo/arriba) + `r`/`l` (derecha/izquierda). */
export type Esquina = 'br' | 'bl' | 'tr' | 'tl'

/** `x`: distancia al borde izquierdo o derecho. `y`: al borde de abajo de la ventana, o al de abajo de la barra azul si la
 *  esquina es de arriba. */
export type Ancla = { esq: Esquina; x: number; y: number }

/** Donde puede estar la caja: la ventana, menos la barra azul de arriba (`arriba` = su alto). */
export type Hueco = { ancho: number; alto: number; arriba: number }

/** Una caja ya pintada: esquina superior izquierda y tamaño. */
export type Caja = { izq: number; arriba: number; ancho: number; alto: number }

/** Posición `fixed`: solo los dos lados que tocan (`right` o `left`, `bottom` o `top`). */
export type EstiloAnclado = { left?: number; right?: number; top?: number; bottom?: number }

/** De fábrica: arriba a la derecha, bajo la barra azul, a 16 px. */
export const ANCLA_DE_FABRICA: Ancla = { esq: 'tr', x: 16, y: 16 }

/** Alto de la barra azul (`--spacing-navbar` de tokens.css): la caja nunca se mete debajo. */
export const ALTO_BARRA_PX = 64

const ESQUINAS: readonly Esquina[] = ['br', 'bl', 'tr', 'tl']

/** `v` entre `min` y `max`; si no cabe (`max < min`), `min`. */
const recortar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

/** Al soltar: la esquina más cercana al CENTRO de la caja y la distancia de la caja a esos dos bordes. */
export function anclaAlSoltar(caja: Caja, hueco: Hueco): Ancla {
  const derecha = caja.izq + caja.ancho / 2 > hueco.ancho / 2
  const abajo = caja.arriba + caja.alto / 2 > (hueco.arriba + hueco.alto) / 2
  const esq: Esquina = abajo ? (derecha ? 'br' : 'bl') : derecha ? 'tr' : 'tl'
  const x = derecha ? hueco.ancho - (caja.izq + caja.ancho) : caja.izq
  const y = abajo ? hueco.alto - (caja.arriba + caja.alto) : caja.arriba - hueco.arriba
  return { esq, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
}

/** Posición de una caja de `ancho × alto` con ese ancla. Las distancias se recortan para que quepa entera entre la barra
 *  azul y los bordes de la ventana; el ancla guardada no cambia, así que si la ventana vuelve a crecer la caja vuelve a su
 *  sitio. */
export function estiloAnclado(ancla: Ancla, ancho: number, alto: number, hueco: Hueco): EstiloAnclado {
  const x = recortar(ancla.x, 0, hueco.ancho - ancho)
  const y = recortar(ancla.y, 0, hueco.alto - hueco.arriba - alto)
  return {
    ...(ancla.esq[1] === 'r' ? { right: x } : { left: x }),
    ...(ancla.esq[0] === 'b' ? { bottom: y } : { top: hueco.arriba + y }),
  }
}

/** Durante el arrastre: la esquina superior izquierda, sin salir de la ventana ni meterse bajo la barra azul. */
export function dentroDelHueco(izq: number, arriba: number, ancho: number, alto: number, hueco: Hueco): { izq: number; arriba: number } {
  return { izq: recortar(izq, 0, hueco.ancho - ancho), arriba: recortar(arriba, hueco.arriba, hueco.alto - alto) }
}

/** Lo leído del navegador, si es un ancla de verdad (esquina conocida y distancias finitas y no negativas); si no, null. */
export function anclaValida(v: unknown): Ancla | null {
  if (typeof v !== 'object' || v === null) return null
  const { esq, x, y } = v as Record<string, unknown>
  if (typeof esq !== 'string' || !ESQUINAS.includes(esq as Esquina)) return null
  if (typeof x !== 'number' || typeof y !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null
  return { esq: esq as Esquina, x, y }
}

/** El hueco de esta ventana. `clientWidth` y no `innerWidth`: sin la barra de scroll, que el `right` de un `fixed` no cuenta.
 *  jsdom da 0 en `clientWidth` y `clientHeight`; de ahí la vuelta a `innerWidth` e `innerHeight`. */
export function huecoVentana(): Hueco {
  return {
    ancho: document.documentElement.clientWidth || window.innerWidth,
    alto: document.documentElement.clientHeight || window.innerHeight,
    arriba: ALTO_BARRA_PX,
  }
}
