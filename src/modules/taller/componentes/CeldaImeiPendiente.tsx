import type { ReparacionResumen } from '@/shared/api/client'
import { TIPO_TRABAJO } from '@/shared/lib/tipoTrabajo'
import { cn } from '@/shared/lib/utils'
import { CREMA_EN_FILA_SELECCIONADA } from '@/shared/ui/DataTable'
import { CLASES_MINI_PILDORA } from '@/shared/ui/pildora'
import { etiquetaGlassPendiente, etiquetaRepAbierta, ocultarContadorAsignados, tooltipGlassPendiente, tooltipRepAbierta } from '../lib/entregaGlass'

type Props = {
  rep: ReparacionResumen
  /**
   * Técnicos distintos con asignación pendiente de este IMEI, para la tercera línea "N asignados". Solo lo pasa la
   * vista de Asignaciones del supertécnico: la spec del indicador (2026-06-29 §3) deja "Mis pendientes" fuera a
   * propósito —su lista no trae el dato global—, y su celda del JavaFX apila solo dos etiquetas. Sin él se cuenta 1,
   * como el `getOrDefault(imei, 1)` del JavaFX, y no hay tercera línea.
   */
  asignados?: number
}

/** IMEI con la mini-píldora "Glass: X" (fila de reparación con glass sin entregar) o "Rep: X" (fila de glass con reparación abierta). */
export function CeldaImeiPendiente({ rep, asignados }: Props) {
  const glassPendiente = etiquetaGlassPendiente(rep)
  const repAbierta = etiquetaRepAbierta(rep)
  // Calco de PendientesSuperTecnicoController:319-322: con 2 la píldora ya cuenta al segundo y el contador sobra;
  // con 3 o más vuelve a aportar y convive con ella.
  const n = asignados ?? 1
  const varios = n >= 2 && !ocultarContadorAsignados(rep, n)
  return (
    <div className="flex flex-col items-start gap-px">
      <span className="text-[12px]">{rep.imei}</span>
      {glassPendiente && <span title={tooltipGlassPendiente(rep) ?? undefined} className={cn(CLASES_MINI_PILDORA, TIPO_TRABAJO.GLASS.clases)}>{glassPendiente}</span>}
      {!glassPendiente && repAbierta && <span title={tooltipRepAbierta(rep) ?? undefined} className={cn(CLASES_MINI_PILDORA, TIPO_TRABAJO.REPARACION.clases)}>{repAbierta}</span>}
      {/* La sub-etiqueta del JavaFX: 10 px, cursiva, #9AA0AA, y en blanco sobre la fila seleccionada (aplicarEstilos).
          Mismo look que el "Reutilizado" del historial, que es su referencia visual en la spec. */}
      {varios && <span className={cn('text-[10px] italic text-texto-fecha-inicio', CREMA_EN_FILA_SELECCIONADA)}>{n} asignados</span>}
    </div>
  )
}
