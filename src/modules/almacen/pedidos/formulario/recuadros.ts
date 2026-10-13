import type { Componente, Proveedor } from '@/shared/api/client'
import type { OpcionCombo } from '@/shared/ui/ComboNavy'
import { abiertosDe, type Bloque } from '../bloques/reglas'
import { MSG_SIN_LINEAS, validarLineasCompra, type LineaCompra } from './lineas'

/** Clave del recuadro «Por repartir» de «Nuevo pedido» (0.9.9, spec 2026-10-13 varios proveedores §3): las líneas aún sin
 *  proveedor. Los demás recuadros se identifican por el id de su proveedor. */
export const POR_REPARTIR = 'repartir'
export type ClaveRecuadro = number | typeof POR_REPARTIR

/** Reparto automático de las líneas precargadas (§3): cada una al único proveedor activo que vende su pieza (`proveedores`
 *  de «Piezas que vende»; un slave trae la lista de su master). Si la venden varios o ninguno, si no se sabe (`proveedores`
 *  nulo) o la línea no tiene pieza, queda sin proveedor: «Por repartir». */
export function repartirLineas(lineas: LineaCompra[], activos: Componente[], idsActivos: ReadonlySet<number>): LineaCompra[] {
  return lineas.map((l) => {
    const venden = l.idCom === null ? [] : (activos.find((c) => c.idCom === l.idCom)?.proveedores ?? []).filter((id) => idsActivos.has(id))
    return { ...l, idProv: venden.length === 1 ? venden[0] : null }
  })
}

/** Recuadros de proveedor del pedido, en el orden en que se añadieron (ajuste del 2026-10-13: el nuevo, al final). Primero
 *  los de `anadidos` (elegidos a mano, los de la precarga en el orden de sus líneas y los de «Pasar a…»); después, por si
 *  acaso, cualquier proveedor con líneas que no esté entre ellos, en el orden de las líneas. */
export function recuadrosDelPedido(lineas: LineaCompra[], anadidos: number[]): number[] {
  const ids = new Set(anadidos)
  for (const l of lineas) if (l.idProv !== null) ids.add(l.idProv)
  return [...ids]
}

/** Líneas de un recuadro en su orden: la n de «línea n» es su posición aquí. */
export function lineasDe(lineas: LineaCompra[], clave: ClaveRecuadro): LineaCompra[] {
  return lineas.filter((l) => (clave === POR_REPARTIR ? l.idProv === null : l.idProv === clave))
}

/** «Pasar a…» de una línea de «Por repartir»: va al final del recuadro de `idProv`. Si ese recuadro ya tenía la pieza, se
 *  queda la que había, la de «Por repartir» se quita y `repetida` es true. */
export function pasarA(lineas: LineaCompra[], id: number, idProv: number): { lineas: LineaCompra[]; repetida: boolean } {
  const linea = lineas.find((l) => l.id === id)
  if (linea === undefined) return { lineas, repetida: false }
  const resto = lineas.filter((l) => l.id !== id)
  if (linea.idCom !== null && resto.some((l) => l.idProv === idProv && l.idCom === linea.idCom)) return { lineas: resto, repetida: true }
  return { lineas: [...resto, { ...linea, idProv }], repetida: false }
}

/** Opciones de «Pasar a…»: primero los proveedores que venden la pieza («Lo vende») y después el resto («Otros
 *  proveedores»), cada grupo en el orden de la lista de proveedores. */
export function opcionesPasarA(idCom: number | null, activos: Componente[], proveedores: Proveedor[]): OpcionCombo[] {
  const venden = new Set(idCom === null ? [] : activos.find((c) => c.idCom === idCom)?.proveedores ?? [])
  const opcion = (p: Proveedor, grupo: string): OpcionCombo => ({ valor: String(p.idProv), etiqueta: p.nombre, grupo })
  return [
    ...proveedores.filter((p) => venden.has(p.idProv)).map((p) => opcion(p, 'Lo vende')),
    ...proveedores.filter((p) => !venden.has(p.idProv)).map((p) => opcion(p, 'Otros proveedores')),
  ]
}

/** Opciones del proveedor por elegir del primer recuadro y de «+ Otro proveedor»: los proveedores sin recuadro, con su
 *  bloque abierto más reciente o «sin bloque abierto». */
export function opcionesOtroProveedor(proveedores: Proveedor[], recuadros: number[], bloques: Map<string, Bloque>): OpcionCombo[] {
  return proveedores.filter((p) => !recuadros.includes(p.idProv)).map((p) => {
    const abierto = abiertosDe(bloques, p.idProv)[0]
    return { valor: String(p.idProv), etiqueta: `${p.nombre} · ${abierto === undefined ? 'sin bloque abierto' : `Bloque ${abierto.idBloque} abierto`}` }
  })
}

/** Avisos «también va a» del recuadro de `idProv` (§5): sus piezas que van también a otros proveedores, con la cantidad
 *  que llevan allí. Las de «Por repartir» no cuentan. */
export function tambienVa(lineas: LineaCompra[], idProv: number, nombrePieza: (idCom: number) => string, nombreProveedor: (idProv: number) => string): string[] {
  return lineasDe(lineas, idProv).flatMap((l) => {
    const idCom = l.idCom
    if (idCom === null) return []
    return lineas.flatMap((o) => (o.idCom === idCom && o.idProv !== null && o.idProv !== idProv
      ? [`${nombrePieza(idCom)} también va a ${nombreProveedor(o.idProv)} (${o.cantidad}).`]
      : []))
  })
}

export function textoConfirmar(nBloques: number): string {
  return nBloques > 1 ? `Confirmar pedido (${nBloques} bloques)` : 'Confirmar pedido'
}

export function avisoYaEstaba(pieza: string, proveedor: string): string {
  return `${pieza} ya estaba en ${proveedor}: se queda la línea que había.`
}

export function textoQuitarRecuadro(proveedor: string, n: number): string {
  return n === 1 ? `¿Quitar ${proveedor} y su línea?` : `¿Quitar ${proveedor} y sus ${n} líneas?`
}

/** «Confirmar» (§6): primero lo que queda por repartir, luego que haya alguna línea y después las líneas de cada recuadro
 *  en el orden en que se ven, con el proveedor delante. Devuelve el primer fallo con el recuadro al que llevar al usuario. */
export function validarPedido(lineas: LineaCompra[], recuadros: number[], nombre: (idProv: number) => string): { error: string; recuadro: ClaveRecuadro | null } | null {
  const sinRepartir = lineasDe(lineas, POR_REPARTIR).length
  if (sinRepartir === 1) return { error: 'Queda 1 línea por repartir: elige a quién se la pides.', recuadro: POR_REPARTIR }
  if (sinRepartir > 1) return { error: `Quedan ${sinRepartir} líneas por repartir: elige a quién se las pides.`, recuadro: POR_REPARTIR }
  if (lineas.length === 0) return { error: MSG_SIN_LINEAS, recuadro: null }
  for (const idProv of recuadros) {
    const suyas = lineasDe(lineas, idProv)
    if (suyas.length === 0) continue
    const error = validarLineasCompra(suyas)
    if (error !== null) return { error: `${nombre(idProv)} · ${error}`, recuadro: idProv }
  }
  return null
}
