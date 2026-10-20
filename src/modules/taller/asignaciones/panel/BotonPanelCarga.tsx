import { ChartColumn } from 'lucide-react'
import { alternarPanelCarga, usePanelCarga } from '@/shared/lib/panelCarga'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico } from '@/shared/session/storage'

/** Botón «Carga» de la barra azul (spec 0.9.20): abre y cierra el panel de carga de técnicos. Solo supertécnico y admin.
 *  Resaltado con el panel abierto o minimizado; `aria-pressed` solo con el panel abierto, porque pulsarlo entonces lo cierra
 *  (minimizado, lo abre). */
export function BotonPanelCarga() {
  const { sesion } = useSession()
  const { estado } = usePanelCarga()
  if (!esAdminOSuperTecnico(sesion)) return null
  return (
    <button
      type="button"
      onClick={alternarPanelCarga}
      aria-pressed={estado === 'abierto'}
      title="Carga de técnicos"
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-crema hover:bg-white/8',
        estado !== 'cerrado' && 'bg-white/16',
      )}
    >
      <ChartColumn aria-hidden className="size-[18px]" />
      Carga
    </button>
  )
}
