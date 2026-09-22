import type { Tecnico } from '@/shared/api/client'

/** Un cambio a mandar. El cuerpo del PATCH se llama `habilitado` (TecnicoGlassRequest del contrato), aunque el
 *  campo del técnico que dice su estado actual se llame `esGlass`: se lee `esGlass` y se escribe `habilitado`. */
export type CambioGlass = { idTec: number; habilitado: boolean }

/**
 * Qué hay que mandar al aceptar: solo las diferencias entre lo marcado y lo que dice el servidor (calco del
 * "solo cambios" del JavaFX, que salta los técnicos cuyo check coincide con su estado inicial).
 *
 * `marcados` lleva SOLO los técnicos que el usuario ha tocado; para el resto vale su `esGlass`, que por
 * definición no es un cambio. Así el diálogo no tiene que copiarse la lista entera al abrirse, y un técnico que
 * ya no esté en la lista (dado de baja mientras el diálogo estaba abierto) no genera una petición fantasma.
 */
export function cambiosGlass(tecnicos: Tecnico[], marcados: Record<number, boolean>): CambioGlass[] {
  return tecnicos.flatMap((t) => {
    const habilitado = marcados[t.idTec] ?? t.esGlass
    return habilitado === t.esGlass ? [] : [{ idTec: t.idTec, habilitado }]
  })
}
