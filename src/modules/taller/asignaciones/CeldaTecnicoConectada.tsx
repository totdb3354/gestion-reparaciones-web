import { useQueryClient } from '@tanstack/react-query'
import type { ReparacionResumen, Tecnico } from '@/shared/api/client'
import { useAlerta } from '@/shared/ui/AlertaProvider'
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
  const { mostrarError } = useAlerta()

  /**
   * La fila que debe llevar la escritura inversa, releída de la caché de la lista, y SOLO si confirma que la
   * escritura que se va a deshacer es la mía: exige `idTec === idTecNuevo`, el valor que yo mismo acabo de
   * escribir. `fila` es la de ANTES de reasignar y su `updatedAt` muere con la primera escritura (UPDATED_AT es
   * ON UPDATE CURRENT_TIMESTAMP en Reparacion), así que deshacer con ella daría 409 "Dato modificado por otro
   * usuario" siempre: un "Deshacer" que falla cada vez es peor que no tenerlo.
   *
   * `onSettled` de la mutación ya invalida la lista; si la recarga aún no ha llegado —la caché sigue sin
   * `idTec === idTecNuevo`— se espera UNA recarga (`refetchQueries` trae `cancelRefetch: true` por defecto: sin
   * eso se engancharía a un GET lanzado ANTES del PATCH y devolvería datos rancios igual). Si tras esperar la
   * caché sigue sin confirmar mi escritura —la fila no está (lista sin montar, o ha salido del listado), el
   * refetch ha fallado (servidor caído: `retry: false` en queryClient.ts, así que `refetchQueries` resuelve
   * igual sin lanzar) o OTRO supertécnico ha movido la fila dentro de los 8 s del aviso— no se manda una
   * escritura condenada al 409, ni se pisa el cambio ajeno: se devuelve `undefined` y quien llama avisa en vez
   * de deshacer.
   */
  async function filaParaDeshacer(idTecNuevo: number): Promise<ReparacionResumen | undefined> {
    const enCache = () => qc.getQueryData<ReparacionResumen[]>(CLAVE_ASIGNACIONES_TODAS)?.find((f) => f.idRep === fila.idRep)
    if (enCache()?.idTec !== idTecNuevo) await qc.refetchQueries({ queryKey: CLAVE_ASIGNACIONES_TODAS })
    const confirmada = enCache()
    return confirmada?.idTec === idTecNuevo ? confirmada : undefined
  }

  function alElegir(idTecNuevo: number) {
    // El técnico de antes se captura AQUÍ: en cuanto la escritura vuelve, la recarga trae la fila ya con el nuevo.
    const idTecAnterior = fila.idTec
    const nombreNuevo = tecnicos.find((t) => t.idTec === idTecNuevo)?.nombre ?? ''
    ejecutar({
      texto: `${fila.idRep} reasignada a ${nombreNuevo}`,
      hacer: () => reasignar.mutateAsync({ fila, idTec: idTecNuevo }),
      deshacer: async () => {
        const filaConfirmada = await filaParaDeshacer(idTecNuevo)
        if (!filaConfirmada) {
          mostrarError(`No se ha podido deshacer la reasignación de ${fila.idRep}: no se ha confirmado el cambio en el servidor. Recarga la tabla y revísalo a mano.`)
          return
        }
        await reasignar.mutateAsync({ fila: filaConfirmada, idTec: idTecAnterior })
      },
    })
  }

  return <CeldaTecnico fila={fila} tecnicos={tecnicos} onReasignar={alElegir} onOpenChange={onInteraccion} />
}
