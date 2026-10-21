import type { FilaPreviaTaller, PeticionPreviaTaller, PreviaTaller } from '@/shared/api/client'
import { PREFIJO_CHASIS, PREFIJO_TAPA } from '../lib/colores'
import { planGuardarCambios, planTerminar, zonaGuardarVisible, type EstadoFormulario } from './estado'

/** La banda del SKU del taller encima de la zona de guardar (0.9.21, spec «SKU del taller», pieza 2, §2.4): qué se pregunta
 *  y qué se dice. La cuenta la hace el servidor, la misma que al guardar. Puro. */

/** Las piezas que cambian el color o el grado del móvil: chasis, tapa trasera y batería. */
export const PREFIJOS_SKU_TALLER: readonly string[] = [PREFIJO_CHASIS, PREFIJO_TAPA, 'bat']

const cuenta = (prefijo: string | null) => prefijo !== null && PREFIJOS_SKU_TALLER.includes(prefijo)

/** Lo que se pide a POST /api/reparaciones/sku-taller/previsualizar: las filas que va a mandar «Terminar asignación» o
 *  «Guardar cambios» y cambian el móvil (las ya guardadas con «✓ Guardar fila» ya se aplicaron). En edición, la fila editada
 *  va con el idRep de su reparación (el servidor deshace lo suyo y aplica la nueva, como al guardar) y las nuevas detrás.
 *  null: nada que preguntar (zona de guardar oculta, glass o ninguna pieza que cuente). */
export function peticionPreviaTaller(e: EstadoFormulario): PeticionPreviaTaller | null {
  if (e.categoria === 'G' || !zonaGuardarVisible(e)) return null
  const filas: FilaPreviaTaller[] = []
  if (e.modo === 'editar') {
    const plan = planGuardarCambios(e)
    const editada = e.filas.find((f) => f.rol === 'editada')
    if (plan.editarFila !== null && e.edicion !== null && editada !== undefined && cuenta(editada.prefijo)) {
      filas.push({ idRep: e.edicion.idRep, idCom: plan.editarFila.idComNuevo, reutilizada: plan.editarFila.esReutilizadoNuevo })
    }
    for (const f of plan.completaFilas?.filas ?? []) if (cuenta(f.prefijo)) filas.push({ idRep: null, idCom: f.idCom, reutilizada: f.reutilizado })
  } else {
    // El técnico (0) no cuenta para las filas: solo rellena el cuerpo de «completa».
    for (const f of planTerminar(e, 0).completa?.filas ?? []) if (cuenta(f.prefijo)) filas.push({ idRep: null, idCom: f.idCom, reutilizada: f.reutilizado })
  }
  return filas.length === 0 ? null : { imei: e.imei, filas }
}

/** «Al guardar, este móvil pasará a: Rojo · A100 (ahora: Azul · B)», solo con los datos que cambian, y los avisos del color
 *  y del grado, unidos con «; ». null si no hay nada que decir (IMEI fuera de NSYS, nada cambia o la previa falló). */
export function textoBandaTaller(p: PreviaTaller | null): string | null {
  if (p === null || !p.enNsys) return null
  const despues: string[] = []
  const ahora: string[] = []
  if (p.despues.color !== p.antes.color) {
    despues.push(p.despues.color ?? '—')
    ahora.push(p.antes.color ?? '—')
  }
  if (p.despues.grado !== p.antes.grado) {
    despues.push(p.despues.grado ?? '—')
    ahora.push(p.antes.grado ?? '—')
  }
  const partes: string[] = []
  if (despues.length > 0) partes.push(`este móvil pasará a: ${despues.join(' · ')} (ahora: ${ahora.join(' · ')})`)
  if (p.colorSinDeducir) partes.push('el color del chasis no se puede deducir: lo corregirá un supertécnico')
  if (p.gradoSinCalcular) partes.push(`el grado (${p.antes.grado ?? '—'}) no se puede calcular: lo corregirá un supertécnico`)
  return partes.length === 0 ? null : `Al guardar, ${partes.join('; ')}`
}
