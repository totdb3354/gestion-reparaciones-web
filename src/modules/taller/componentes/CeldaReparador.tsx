import type { ReparacionResumen } from '@/shared/api/client'
import { subEtiquetaHistorial, tooltipEntrega } from '../lib/entregaGlass'

/** Calco de CeldaReparador: nombre y, en glass con entrega, "Llegó dd/MM HH:mm" debajo. */
export function CeldaReparador({ rep }: { rep: ReparacionResumen }) {
  const sub = subEtiquetaHistorial(rep)
  return (
    <div className="flex flex-col leading-tight">
      <span>{rep.nombreTecnico ?? ''}</span>
      {sub && <span title={tooltipEntrega(rep) ?? undefined} className="text-[10px] text-texto-sub">{sub}</span>}
    </div>
  )
}
