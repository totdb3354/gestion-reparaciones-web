import type { EventoRastro, FichaMovil } from '@/shared/api/client'
import { diaNsys, diasDesdeNsys, textoGrado } from '@/shared/lib/telefonoNsys'

/** Textos y colores del rastro (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.3). El servidor manda el evento
 *  estructurado y aquí se compone lo que se lee. Las horas son de Madrid, sin zona: se cortan del texto sin convertir. */
export type EventoVisible = { fecha: string; titulo: string; detalle: string | null; color: string; revision?: boolean }

const CATEGORIA: Record<string, string> = { GLASS: 'glass', PULIDO: 'pulido', REPARACION: 'reparación' }
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** 0.9.21 (spec «SKU del taller» §2.4): los cambios del taller por encima de NSYS. */
const DATO: Record<string, string> = { COLOR: 'color', GRADO: 'grado' }
const ORIGEN: Record<string, string> = { MANO: 'a mano', REPARACION: 'por una reparación' }
const dato = (e: EventoRastro) => DATO[e.dato ?? ''] ?? 'dato'

/** «(a mano · Imad · «motivo»)»: cómo, quién y por qué; sin motivo, el paréntesis acaba en el nombre. */
function comoTaller(e: EventoRastro): string {
  return `(${[ORIGEN[e.origen ?? ''] ?? 'a mano', e.tecnico ?? '—', e.motivo ? `«${e.motivo}»` : null].filter(Boolean).join(' · ')})`
}

export function fechaRastro(iso: string, soloDia: boolean): string {
  const dia = diaNsys(iso)
  return soloDia ? dia : `${dia} ${iso.slice(11, 16)}`
}

function colorUbicacion(u: string): string {
  if (u === 'Listos') return 'bg-fila-recibido-brd'
  if (u.startsWith('Taller')) return 'bg-tipo-reparacion-text'
  if (u === 'Devolución') return 'bg-fila-solicitud-brd'
  if (u === 'En revisión') return 'bg-ambar'
  return 'bg-gris-borde'
}

export function verEvento(e: EventoRastro): EventoVisible {
  const fecha = fechaRastro(e.fecha, e.soloDia)
  const desde = e.de ? `Desde: ${e.de}` : null
  switch (e.tipo) {
    case 'ENTRADA':
      return { fecha, titulo: `Entra en el lote ${e.lote ?? '—'}`, detalle: e.a ? `En ${e.a}` : null, color: 'bg-texto-suave' }
    case 'REENTRADA':
      return { fecha, titulo: `Vuelve a entrar (lote ${e.a ?? e.lote ?? '—'})`, detalle: null, color: 'bg-fila-solicitud-brd' }
    case 'UBICACION':
      // 0.9.18 (spec §5.3): el paso de «sin caja» a una caja es la revisión del lote; salir de «Devolución», la de una devolución.
      if (e.revision) {
        const titulo = `${e.revision === 'DEVOLUCION' ? 'Revisado (devolución)' : 'Revisado'} → ${e.a || e.aNsys || 'sin caja'}`
        return { fecha, titulo, detalle: desde, color: 'bg-verde-ok', revision: true }
      }
      if (e.a) return { fecha, titulo: `Pasa a ${e.a}`, detalle: desde, color: colorUbicacion(e.a) }
      if (e.aNsys === 'Pedidos realizados') return { fecha, titulo: 'De pedido (vendido, pendiente de envío)', detalle: desde, color: 'bg-fila-urgente-brd' }
      return { fecha, titulo: `Pasa a ${e.aNsys || 'sin caja'} · sale del stock`, detalle: desde, color: 'bg-gris-borde' }
    case 'GRADO':
      return { fecha, titulo: `Se le pone el grado ${textoGrado(e.a)}`, detalle: e.de ? `Antes: ${textoGrado(e.de)}` : null, color: 'bg-ambar' }
    case 'PRODUCTO':
      return { fecha, titulo: 'Cambia el producto en NSYS', detalle: `${e.de ?? '—'} → ${e.a ?? '—'}`, color: 'bg-ambar' }
    case 'ESTADO':
      return { fecha, titulo: `Estado en NSYS: ${e.a ?? '—'}`, detalle: e.de ? `Antes: ${e.de}` : null, color: 'bg-gris-borde' }
    case 'VENTA':
      return { fecha, titulo: 'Vendido (Released)', detalle: e.soloDia ? 'Del fichero de NSYS: solo se sabe el día' : null, color: 'bg-azul-noche' }
    case 'VENTA_DESHECHA':
      return { fecha, titulo: 'Venta deshecha en NSYS', detalle: e.a ? `Vuelve a ${e.a}` : null, color: 'bg-fila-solicitud-brd' }
    case 'CORRECCION':
      // 0.9.21: NSYS da de baja el lote y da de alta el IMEI en otro para corregir el móvil (spec «corrección en NSYS» §3).
      return { fecha, titulo: `Corrección en NSYS (lote ${e.loteAnterior ?? '—'} → ${e.lote ?? '—'})`, detalle: `${e.de ?? '—'} → ${e.a ?? '—'}`, color: 'bg-ambar' }
    case 'TRABAJO_ASIGNADO':
      return { fecha, titulo: `Trabajo de ${CATEGORIA[e.categoria ?? ''] ?? 'taller'} asignado a ${e.tecnico ?? '—'}`, detalle: null, color: 'bg-tipo-reparacion-text' }
    case 'TRABAJO_TERMINADO':
      return { fecha, titulo: `${mayuscula(CATEGORIA[e.categoria ?? ''] ?? 'trabajo')} terminado`, detalle: e.tecnico, color: 'bg-tipo-reparacion-text' }
    case 'TALLER_CAMBIO':
      return { fecha, titulo: `Taller: ${dato(e)} ${e.de ?? '—'} → ${e.a ?? '—'} ${comoTaller(e)}`, detalle: null, color: 'bg-taller' }
    case 'TALLER_VUELTA':
      return { fecha, titulo: `Vuelve a lo de NSYS: ${dato(e)} ${e.de ?? '—'} → ${e.a ?? '—'} ${comoTaller(e)}`, detalle: null, color: 'bg-taller' }
    case 'TALLER_PASADO':
      return { fecha, titulo: `Pasado a NSYS: ${dato(e)} ${e.a ?? e.de ?? '—'}`, detalle: null, color: 'bg-fila-recibido-brd' }
    case 'TALLER_MANDA_NSYS':
      return { fecha, titulo: `Manda NSYS: ${dato(e)} ${e.a ?? '—'} (el del taller, ${e.de ?? '—'}, deja de valer)`, detalle: null, color: 'bg-ambar' }
    default:
      return { fecha, titulo: e.tipo, detalle: null, color: 'bg-gris-borde' }
  }
}

/** Las exportaciones de Drive empiezan en dic. 2023: antes solo hay el esqueleto (entrada y venta, con solo el día). */
const INICIO_HISTORICO = '2023-12-01'
export const NOTA_ANTES_DEL_HISTORICO = 'Antes de dic. 2023 solo se conoce la entrada y la venta.'

export function hayAntesDelHistorico(eventos: EventoRastro[]): boolean {
  return eventos.some((e) => e.fecha < INICIO_HISTORICO)
}

/** «Revisado» en la ficha (0.9.18, spec §5.2): si ahora está en «En revisión», desde cuándo espera; si no, la última
 *  revisión del lote (la hora es la de la exportación, ± 30 min); sin datos (antes de dic. 2023 o vendido sin revisar),
 *  nada. */
export function textoRevision(
  f: Pick<FichaMovil, 'revisadoEl' | 'revisadoDevolucion' | 'pendienteRevisionDesde'>, ahora: Date = new Date(),
): string | null {
  if (f.pendienteRevisionDesde) {
    const n = diasDesdeNsys(f.pendienteRevisionDesde, ahora)
    return n === 0 ? 'Pendiente de revisar desde hoy' : `Pendiente de revisar desde hace ${n} ${n === 1 ? 'día' : 'días'}`
  }
  if (f.revisadoEl) return `${f.revisadoDevolucion ? 'Revisado (devolución)' : 'Revisado'} el ${diaNsys(f.revisadoEl)}, hacia las ${f.revisadoEl.slice(11, 16)}`
  return null
}
