import { useEffect, useRef, useState, type RefObject } from 'react'

/** Dónde queda la fila seleccionada respecto a lo que se ve: encima, debajo o `null` (a la vista, o no hay). */
export type Donde = 'arriba' | 'abajo' | null
/** Posición de una fila en el contenido del contenedor con scroll (en píxeles, la cabecera fija incluida). */
export type Posicion = { top: number; bottom: number }
type Vista = { scrollTop: number; clientHeight: number; cabecera: number }

/** Margen (px) con el que una fila asomando por el borde ya cuenta como «a la vista», y con el que se está «al final». */
const MARGEN = 4
const MARGEN_FINAL = 8

/** La fila queda encima si su borde de abajo no pasa de la cabecera fija, y debajo si su borde de arriba no llega a verse. */
export function dondeQueda(p: Posicion | null, v: Vista): Donde {
  if (!p) return null
  if (p.bottom <= v.scrollTop + v.cabecera + MARGEN) return 'arriba'
  if (p.top >= v.scrollTop + v.clientHeight - MARGEN) return 'abajo'
  return null
}

/** El `scrollTop` que deja la fila en el centro del hueco bajo la cabecera, sin pasarse de los extremos. */
export function scrollParaCentrar(p: Posicion, v: Vista & { scrollHeight: number }): number {
  const hueco = v.clientHeight - v.cabecera
  const objetivo = (p.top + p.bottom) / 2 - v.cabecera - hueco / 2
  return Math.max(0, Math.min(objetivo, v.scrollHeight - v.clientHeight))
}

/** Cerca (menos de dos pantallas) el desplazamiento es suave, para ver hacia dónde se va; lejos, directo (lo suave tardaría segundos). */
export const comoDesplazar = (desde: number, hasta: number, clientHeight: number): ScrollBehavior =>
  Math.abs(hasta - desde) < clientHeight * 2 ? 'smooth' : 'auto'

type Visto = { ids: Set<number>; max: number; recibidas: number }

/** Cuántas filas nuevas han llegado abajo desde la última vez. Solo cuenta si han llegado filas (sube `recibidas`) y las de antes siguen
 *  todas (si falta alguna es otra consulta: otro periodo, una búsqueda); y solo las de id mayor que todas las vistas, que son las
 *  recién creadas desde ShippyPro (ampliar el periodo hacia atrás trae ids menores). `null`: empezar a contar de cero. */
export function filasNuevas(antes: Visto | null, ids: number[], recibidas: number): number | null {
  if (!antes || recibidas <= antes.recibidas) return recibidas < (antes?.recibidas ?? 0) ? null : 0
  const actuales = new Set(ids)
  for (const id of antes.ids) if (!actuales.has(id)) return null
  return ids.filter((id) => id > antes.max).length
}

/** Estado de los botones «↓ Al final» y «Fila seleccionada»: se recalcula en cada scroll y tras cada pintado de la tabla. */
export function useVolver({ contenedor, ids, recibidas, posicionAqui, cabecera }: {
  contenedor: RefObject<HTMLDivElement | null>
  /** Ids de las filas que pinta la tabla, en su orden. */
  ids: number[]
  recibidas: number
  /** Dónde está la fila seleccionada en el contenido, o `null` si no hay o no está entre las que se ven. */
  posicionAqui: () => Posicion | null
  /** Alto de la cabecera fija. */
  cabecera: () => number
}) {
  const [estado, setEstado] = useState<{ enFinal: boolean; donde: Donde }>({ enFinal: true, donde: null })
  const [nuevos, setNuevos] = useState(0)
  const visto = useRef<Visto | null>(null)
  // `leer` cambia en cada pintado (usa las funciones de ahora); el oyente del scroll llama siempre a la última.
  const leer = () => {
    const c = contenedor.current
    if (!c) return
    const enFinal = c.scrollHeight - c.scrollTop - c.clientHeight < MARGEN_FINAL
    const donde = dondeQueda(posicionAqui(), { scrollTop: c.scrollTop, clientHeight: c.clientHeight, cabecera: cabecera() })
    setEstado((s) => (s.enFinal === enFinal && s.donde === donde ? s : { enFinal, donde }))
    if (enFinal) setNuevos(0)
  }
  const ultimoLeer = useRef(leer)
  useEffect(() => {
    const c = contenedor.current
    if (!c) return
    const alDesplazar = () => ultimoLeer.current()
    c.addEventListener('scroll', alDesplazar, { passive: true })
    return () => c.removeEventListener('scroll', alDesplazar)
  }, [contenedor])
  // Las filas nuevas, al cambiar las filas. Va antes que la lectura de abajo, que pone el contador a cero si se está al final.
  useEffect(() => {
    const n = filasNuevas(visto.current, ids, recibidas)
    if (n === null) setNuevos(0)
    else if (n > 0) setNuevos((x) => x + n)
    // Con otra consulta (`null`) el id mayor se vuelve a tomar de las filas de ahora.
    const desde = n === null ? 0 : visto.current?.max ?? 0
    visto.current = { ids: new Set(ids), max: ids.reduce((m, id) => Math.max(m, id), desde), recibidas }
  }, [ids, recibidas])
  // Tras cada pintado (después de que la tabla baje sola al final si tocaba): dónde queda todo.
  useEffect(() => {
    ultimoLeer.current = leer
    ultimoLeer.current()
  })
  return { ...estado, nuevos }
}
