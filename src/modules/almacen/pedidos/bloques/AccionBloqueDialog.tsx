import { useState } from 'react'
import { formatear } from '@/shared/lib/fechas'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { DialogoAlmacen } from '../../ui/DialogoAlmacen'
import { useAccionBloque, vistaDe, type AccionBloque } from '../api'
import { tratarFalloBloque } from './fallos'
import { ListaLineas } from './ListaLineas'
import { lineasQueCambian, motivoNoCambia, type Bloque } from './reglas'

const TEXTOS: Record<AccionBloque, { titulo: string; cambian: string; boton: (n: number) => string; peligro: boolean }> = {
  confirmar: { titulo: 'Confirmar bloque', cambian: 'Pasan a en camino', boton: (n) => `Confirmar (${n})`, peligro: false },
  recibir: { titulo: 'Recibir todo', cambian: 'Se reciben (suman al stock)', boton: (n) => `Recibir (${n})`, peligro: false },
  cancelar: { titulo: 'Cancelar bloque', cambian: 'Se cancelan (no se pueden reactivar)', boton: (n) => `Cancelar líneas (${n})`, peligro: true },
  borrar: { titulo: 'Borrar bloque', cambian: 'Se borran el bloque y todas sus líneas', boton: () => 'Borrar bloque', peligro: true },
}

type Props = { bloque: Bloque; accion: AccionBloque; onCerrar: () => void }

/** Confirmación de una acción de bloque (spec §6.5): qué cambia y qué no, con su motivo. Manda la lista exacta de líneas
 *  que cambian; el servidor la comprueba entera (todo o nada). */
export function AccionBloqueDialog({ bloque, accion, onCerrar }: Props) {
  const aplicar = useAccionBloque()
  const { mostrarAviso } = useAlerta()
  const [error, setError] = useState<string | null>(null)
  const t = TEXTOS[accion]
  const cambian = lineasQueCambian(bloque, accion)
  const quedan = bloque.lineas.filter((p) => !cambian.includes(p))

  async function confirmar() {
    setError(null)
    try {
      await aplicar.mutateAsync({ idBloque: bloque.idBloque as number, accion, lineas: cambian.map(vistaDe) })
      onCerrar()
    } catch (e) {
      tratarFalloBloque(e, onCerrar, mostrarAviso, setError)
    }
  }

  return (
    <DialogoAlmacen abierto ancho={520} titulo={`${t.titulo} · Bloque ${bloque.idBloque}`}
      subtitulo={`${bloque.nombreProveedor} · ${formatear(bloque.fecha, 'dd/MM/yyyy')}`} error={error}
      textoAccion={t.boton(cambian.length)} peligro={t.peligro} enviando={aplicar.isPending}
      onConfirmar={() => void confirmar()} onCancelar={onCerrar}>
      <div className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto">
        <ListaLineas titulo={`${t.cambian} (${cambian.length})`} lineas={cambian} />
        {quedan.length > 0 && (
          <ListaLineas titulo={`No cambian (${quedan.length})`} lineas={quedan} motivo={(p) => motivoNoCambia(p, accion)} apagada />
        )}
      </div>
    </DialogoAlmacen>
  )
}
