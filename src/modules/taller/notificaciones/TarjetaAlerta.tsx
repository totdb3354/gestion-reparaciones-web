import { cn } from '@/shared/lib/utils'
import { TOOLTIP_ALMACEN } from '../lib/textos'
import type { AlertaStock } from './alertas'

/** Tarjeta de una alerta de stock. El mínimo no se muestra; sin forma singular ("1 unid. restantes"); sin menú contextual.
 *  "Pedir" queda deshabilitado con tooltip hasta que exista Almacén. */
export function TarjetaAlerta({ alerta, alterna }: { alerta: AlertaStock; alterna: boolean }) {
  const sinStock = alerta.nivel === 'sinStock'
  return (
    <div data-testid={`tarjeta-alerta-${alerta.componente.idCom}`} className={cn('flex items-center gap-3 rounded-md p-3', alterna ? 'bg-notif-tarjeta-alt' : 'bg-superficie')}>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-superficie', sinStock ? 'bg-notif-sin-stock' : 'bg-notif-stock-bajo')}>
        {sinStock ? '✕' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-azul-medio">{alerta.componente.tipo}</p>
        <p className="flex items-center gap-1.5 text-[11px]">
          <span className={cn('font-bold', sinStock ? 'text-notif-sin-stock' : 'text-notif-stock-bajo')}>{sinStock ? 'Sin Stock' : 'Stock Bajo'}</span>
          <span className="text-texto-fecha-inicio">{sinStock ? 'Sin unidades' : `${alerta.componente.stock} unid. restantes`}</span>
        </p>
      </div>
      {/* El title va en el envoltorio: el botón deshabilitado lleva pointer-events-none y no recibiría el hover. */}
      <span title={TOOLTIP_ALMACEN} className="inline-block">
        <button type="button" disabled className="pointer-events-none rounded-[20px] bg-azul-medio px-4 py-1.5 text-[11px] text-superficie disabled:opacity-50">
          Pedir
        </button>
      </span>
    </div>
  )
}
