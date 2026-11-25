import type { FilaVista } from '@/shared/api/client'
import { leerSesion } from '@/shared/session/storage'
import { estadoPedidos } from './estado'

/** Por qué no es un IMEI válido: la cifra de control (Luhn) no cuadra, o hay más de 15 cifras. */
export type MotivoNoValido = 'luhn' | 'mas'
/** Una lectura que no era un IMEI válido (spec 2026-11-25 §2): no se guardó y la celda queda en rojo. `imeiFila` es el IMEI que tenía la
 *  fila al leer: en cuanto la fila tenga otro (lo pone quien sea), la marca sobra. `en`: cuándo, en ms (caduca a las 24 h). */
export type NoValido = { imei: string; motivo: MotivoNoValido; imeiFila: string | null; en: number }

export const CADUCIDAD_NO_VALIDO_MS = 24 * 60 * 60 * 1000
const PREFIJO = 'pedidos.imeiNoValidos.'

/** Por usuario: en un PC compartido no salen los rojos de otro. Sin sesión, no se lee ni escribe nada. */
function clave(): string | null {
  const usuario = leerSesion()?.nombreUsuario
  return usuario ? PREFIJO + usuario : null
}

/** Lo guardado en este navegador para el usuario de la sesión, sin lo caducado ni lo mal formado. */
export function leerNoValidos(ahora = Date.now()): Record<number, NoValido> {
  const k = clave()
  if (!k) return {}
  try {
    const crudo = JSON.parse(localStorage.getItem(k) ?? '{}') as Record<string, Partial<NoValido>>
    const vivos: Record<number, NoValido> = {}
    for (const [id, nv] of Object.entries(crudo)) {
      if (!nv || typeof nv.imei !== 'string' || (nv.motivo !== 'luhn' && nv.motivo !== 'mas') || typeof nv.en !== 'number') continue
      if (ahora - nv.en >= CADUCIDAD_NO_VALIDO_MS) continue
      vivos[Number(id)] = { imei: nv.imei, motivo: nv.motivo, imeiFila: typeof nv.imeiFila === 'string' ? nv.imeiFila : null, en: nv.en }
    }
    return vivos
  } catch {
    return {}
  }
}

function escribir(m: Record<number, NoValido>): void {
  const k = clave()
  if (!k) return
  try {
    if (Object.keys(m).length === 0) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(m))
  } catch {
    // localStorage lleno o bloqueado: la marca queda solo en memoria hasta recargar.
  }
}

/** Al entrar en Pedidos: lo guardado pasa al store. */
export function cargarNoValidos(): void {
  estadoPedidos.set((s) => ({ ...s, noValidos: leerNoValidos() }))
}

export function marcarNoValido(idFila: number, nv: Omit<NoValido, 'en'>, ahora = Date.now()): void {
  estadoPedidos.set((s) => {
    const m = { ...s.noValidos, [idFila]: { ...nv, en: ahora } }
    escribir(m)
    return { ...s, noValidos: m }
  })
}

export function quitarNoValido(idFila: number): void {
  estadoPedidos.set((s) => {
    if (!(idFila in s.noValidos)) return s
    const m = { ...s.noValidos }
    delete m[idFila]
    escribir(m)
    return { ...s, noValidos: m }
  })
}

/** Con las filas recibidas: quita las marcas de filas cuyo IMEI ya no es el que tenían al leer (alguien puso uno). Las filas que no
 *  llegan (otro periodo) conservan la marca hasta que caduque. */
export function limpiarNoValidos(filas: FilaVista[]): void {
  const actuales = estadoPedidos.get().noValidos
  if (Object.keys(actuales).length === 0) return
  const porId = new Map(filas.map((f) => [f.idFila, f]))
  const sobran = Object.keys(actuales).map(Number).filter((id) => {
    const f = porId.get(id)
    return f !== undefined && (f.imei ?? null) !== actuales[id].imeiFila
  })
  if (sobran.length === 0) return
  estadoPedidos.set((s) => {
    const m = { ...s.noValidos }
    for (const id of sobran) delete m[id]
    escribir(m)
    return { ...s, noValidos: m }
  })
}

export function textoNoValido(nv: NoValido): { corto: string; largo: string } {
  return nv.motivo === 'mas'
    ? { corto: `IMEI no válido · ${nv.imei.length} cifras`, largo: `IMEI no válido: ${nv.imei.length} cifras (${nv.imei}). No se ha guardado.` }
    : { corto: `IMEI no válido · …${nv.imei.slice(-4)}`, largo: `IMEI no válido: ${nv.imei} (la cifra de control no cuadra). No se ha guardado.` }
}
