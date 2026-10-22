import type { FilaPorPasar, PorQueTaller } from '@/shared/api/client'
import { descripcionMovil, diaNsys, nombreModeloNsys, SIN_SKU_MAESTRO, textoPoner } from '@/shared/lib/telefonoNsys'

/** Reglas de la lista «Por pasar a NSYS» (0.9.21, spec «SKU del taller» §2.4). */

const DATO: Record<string, string> = { COLOR: 'Color', GRADO: 'Grado' }

/** «Color: a mano · Técnico 1 · «motivo»»; el de una reparación (pieza 2), «Color: reparación R… · Técnico 2 · chasis chai13red
 *  nuevo» (la pieza, sin comillas). */
export function textoPorQue(p: PorQueTaller): string {
  const reparacion = p.origen === 'REPARACION'
  const como = reparacion ? `reparación ${p.idRep ?? '—'}` : 'a mano'
  const motivo = !p.motivo ? null : reparacion ? p.motivo : `«${p.motivo}»`
  return `${DATO[p.dato] ?? p.dato}: ${[como, p.usuario ?? '—', motivo].filter(Boolean).join(' · ')}`
}

/** «iPhone 13 128GB». */
export const modeloDeFila = (f: FilaPorPasar): string => descripcionMovil(nombreModeloNsys(f.modelo, f.modeloMaestro), f.capacidad)

/** Lo que dice NSYS hoy: «<producto> · grado <grado>». */
export const textoEnNsys = (f: FilaPorPasar): string => `${f.productoNsys || '—'} · grado ${f.gradoNsys || '—'}`

/** «20/10/2026 10:31»: la hora es de Madrid, sin zona; se corta del texto. */
export const textoDesde = (iso: string): string => `${diaNsys(iso)} ${iso.slice(11, 16)}`

const CABECERA = ['IMEI', 'Modelo', 'En NSYS hoy', 'Poner en NSYS', 'SKU nuevo', 'Por qué', 'Desde']
const celda = (t: string) => t.replace(/[\t\r\n]+/g, ' ')

/** La lista separada por tabuladores, para pegarla en Excel (como «Copiar el resultado» de «Pegar varios IMEIs»). */
export function paraExcel(filas: FilaPorPasar[]): string {
  const lineas = filas.map((f) => [f.imeiSn, modeloDeFila(f), textoEnNsys(f), textoPoner(f.ponerProducto, f.ponerGrado),
    f.sku ?? SIN_SKU_MAESTRO, f.porQue.map(textoPorQue).join(' / '), textoDesde(f.desde)])
  return [CABECERA, ...lineas].map((columnas) => columnas.map(celda).join('\t')).join('\n')
}
