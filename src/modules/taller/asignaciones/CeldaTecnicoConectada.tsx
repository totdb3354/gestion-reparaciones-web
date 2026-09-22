import { useQueryClient } from '@tanstack/react-query'
import type { ReparacionResumen, Tecnico } from '@/shared/api/client'
import { CeldaTecnico } from '../componentes/CeldaTecnico'
import { CLAVE_ASIGNACIONES_TODAS, useReasignar } from './api'
import type { AccionReversible } from './useAccionConDeshacer'

/**
 * La celda Técnico con su escritura. Vive aquí y no en CeldaTecnico porque la celda es de `componentes/`, común a
 * varias vistas, y no conoce los endpoints de esta; y no en la página porque `crearColumnas` no es un componente y
 * no puede usar hooks.
 *
 * Calca el gesto del ComboBox del JavaFX —elegir otro técnico reasigna al instante, sin diálogo— y le añade el
 * aviso con "Deshacer" (D2): en un navegador un clic o una tecla de más cambian un desplegable sin querer, y eso
 * mueve trabajo de un técnico a otro en silencio.
 */
export function CeldaTecnicoConectada({ fila, tecnicos, ejecutar, onInteraccion }: {
  fila: ReparacionResumen
  tecnicos: Tecnico[]
  ejecutar: (accion: AccionReversible) => void
  onInteraccion: (abierto: boolean) => void
}) {
  const reasignar = useReasignar()
  const qc = useQueryClient()

  /**
   * La fila que debe llevar la escritura inversa, releída de la caché de la lista. `fila` es la de ANTES de
   * reasignar y su `updatedAt` muere con la primera escritura (UPDATED_AT es ON UPDATE CURRENT_TIMESTAMP en
   * Reparacion), así que deshacer con ella daría 409 "Dato modificado por otro usuario" siempre: un "Deshacer"
   * que falla cada vez es peor que no tenerlo. `onSettled` de la mutación ya invalida la lista; si la recarga aún
   * no ha llegado —la caché sigue diciendo el técnico de antes— se la espera, en vez de mandar a sabiendas un
   * `updatedAt` caducado. Sin fila en la caché (lista sin montar) se manda la capturada: peor es no intentarlo.
   */
  async function filaParaDeshacer(): Promise<ReparacionResumen> {
    const enCache = () => qc.getQueryData<ReparacionResumen[]>(CLAVE_ASIGNACIONES_TODAS)?.find((f) => f.idRep === fila.idRep)
    if (enCache()?.idTec === fila.idTec) await qc.refetchQueries({ queryKey: CLAVE_ASIGNACIONES_TODAS })
    return enCache() ?? fila
  }

  function alElegir(idTecNuevo: number) {
    // El técnico de antes se captura AQUÍ: en cuanto la escritura vuelve, la recarga trae la fila ya con el nuevo.
    const idTecAnterior = fila.idTec
    const nombreNuevo = tecnicos.find((t) => t.idTec === idTecNuevo)?.nombre ?? ''
    ejecutar({
      texto: `${fila.idRep} reasignada a ${nombreNuevo}`,
      hacer: () => reasignar.mutateAsync({ fila, idTec: idTecNuevo }),
      deshacer: async () => reasignar.mutateAsync({ fila: await filaParaDeshacer(), idTec: idTecAnterior }),
    })
  }

  return <CeldaTecnico fila={fila} tecnicos={tecnicos} onReasignar={alElegir} onOpenChange={onInteraccion} />
}
