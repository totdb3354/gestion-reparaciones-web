import type { OpcionCombo } from '@/shared/ui/ComboNavy'
import { PREFIJO_CHASIS, PREFIJOS_CON_COLOR, colorDeSku } from '../lib/colores'
import { claseStock } from '../lib/piezas'
import type { FilaEstado } from './estado'

/** Texto del combo de chasis y tapa sin SKU elegido (spec 0.9.7 §9.1). */
export const TEXTO_SIN_COLOR = '— Elige color —'

/** Opciones del combo de SKU de una fila. Chasis y tapa (spec 0.9.7 §9): círculo de color, nombre oficial en la lista,
 *  SKU completo en el botón y en el title; el chasis en bloques «SIM» y «eSIM» (solo si hay de los dos) y con las
 *  opciones del color de la tapa resaltadas. El resto de filas, como siempre. */
export function opcionesSku(fila: FilaEstado, resaltadas: Set<number>): OpcionCombo[] {
  if (!PREFIJOS_CON_COLOR.includes(fila.prefijo)) {
    return fila.opciones.map((c) => ({ valor: String(c.idCom), etiqueta: c.tipo, clase: claseStock(c) }))
  }
  const conColor = fila.opciones
    .map((c) => ({ c, color: colorDeSku(c.tipo, fila.prefijo) }))
    .sort((a, b) => Number(a.color.esim) - Number(b.color.esim) || a.color.nombre.localeCompare(b.color.nombre, 'es'))
  const conBloques = fila.prefijo === PREFIJO_CHASIS && conColor.some((x) => x.color.esim) && conColor.some((x) => !x.color.esim)
  return conColor.map(({ c, color }) => ({
    valor: String(c.idCom),
    etiqueta: color.nombre,
    etiquetaBoton: c.tipo,
    titulo: c.tipo,
    color: color.tono,
    grupo: conBloques ? (color.esim ? 'eSIM' : 'SIM') : undefined,
    resaltada: resaltadas.has(c.idCom),
    clase: claseStock(c),
  }))
}
