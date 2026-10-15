import { abiertosDe, fechaCorta, situacion, textoLineas, vivosDelProveedor, type Bloque } from '../bloques/reglas'
import type { LineaCompra } from './lineas'

/** Valor de «Bloque nuevo» en los desplegables de bloque (0.9.9). */
export const VALOR_NUEVO = 'nuevo'
export type OpcionDestino = { valor: string; etiqueta: string }

/** Proveedores de las líneas, en el orden en que aparecen, con cuántas líneas lleva cada uno. */
export function proveedoresDeLineas(lineas: LineaCompra[]): { idProv: number; n: number }[] {
  const cuenta = new Map<number, number>()
  for (const l of lineas) if (l.idProv !== null) cuenta.set(l.idProv, (cuenta.get(l.idProv) ?? 0) + 1)
  return [...cuenta].map(([idProv, n]) => ({ idProv, n }))
}

/** Desplegable de un proveedor (spec §6.6): sus bloques abiertos, el más reciente primero, y «Bloque nuevo». Vacío si
 *  no tiene abiertos: entonces va a uno nuevo sin preguntar. */
export function opcionesDestino(bloques: Map<string, Bloque>, idProv: number): OpcionDestino[] {
  const abiertos = abiertosDe(bloques, idProv)
  if (abiertos.length === 0) return []
  return [
    ...abiertos.map((b) => ({ valor: String(b.idBloque), etiqueta: `Añadir a Bloque ${b.idBloque} · ${fechaCorta(b.fecha)} · ${textoLineas(b.lineas.length)}` })),
    { valor: VALOR_NUEVO, etiqueta: 'Bloque nuevo' },
  ]
}

/** Destino de un proveedor: lo elegido a mano mientras siga siendo una opción; si no, su abierto más reciente; sin
 *  abiertos, bloque nuevo (null). */
export function destinoElegido(bloques: Map<string, Bloque>, idProv: number, elegidos: Record<number, number | null>): number | null {
  const abiertos = abiertosDe(bloques, idProv)
  if (idProv in elegidos) {
    const e = elegidos[idProv]
    if (e === null || abiertos.some((b) => b.idBloque === e)) return e
  }
  return abiertos[0]?.idBloque ?? null
}

/** `destinos` del lote: los proveedores con desplegable, con lo que enseña el resumen. Los demás no viajan: el servidor
 *  les crea un bloque nuevo (o los suma a uno que se haya abierto entretanto, su regla por defecto). Ninguno → null. */
export function destinosDelCuerpo(lineas: LineaCompra[], bloques: Map<string, Bloque>,
                                  elegidos: Record<number, number | null>): { idProv: number; idBloque: number | null }[] | null {
  const destinos = proveedoresDeLineas(lineas)
    .filter(({ idProv }) => abiertosDe(bloques, idProv).length > 0)
    .map(({ idProv }) => ({ idProv, idBloque: destinoElegido(bloques, idProv, elegidos) }))
  return destinos.length > 0 ? destinos : null
}

/** Campo «Bloque» de los editores al cambiar el proveedor (0.9.9 en piezas; 0.9.15 también en otros): los bloques vivos
 *  del proveedor nuevo (un terminado está cerrado) y «Bloque nuevo». */
export function opcionesBloqueEdicion(bloques: Map<string, Bloque>, idProv: number): OpcionDestino[] {
  return [
    ...vivosDelProveedor(bloques, idProv).map((b) => ({
      valor: String(b.idBloque), etiqueta: `Bloque ${b.idBloque} · ${fechaCorta(b.fecha)} · ${textoLineas(b.lineas.length)} · ${situacion(b)}`,
    })),
    { valor: VALOR_NUEVO, etiqueta: 'Bloque nuevo' },
  ]
}
