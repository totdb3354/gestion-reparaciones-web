import { cn } from '@/shared/lib/utils'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/shared/ui/context-menu'
import { lineaInfo, type TarjetaDatos } from './solicitudes'

type Props = { datos: TarjetaDatos; alterna: boolean; onRechazar: () => void; onRecuperar: () => void; onQuitar: () => void }

const PILDORA = 'cursor-pointer rounded-[20px] px-3.5 py-1.5 text-[11px]'

/** Tarjeta de una solicitud (urgente o preventiva, pendiente o rechazada). Ninguna acción pide confirmación. El menú
 *  contextual repite la acción principal; la papelera no está en el menú. Las rechazadas nunca muestran la descripción. */
export function TarjetaSolicitud({ datos, alterna, onRechazar, onRecuperar, onQuitar }: Props) {
  const pendiente = datos.grupo === 'pendiente'
  const sku = datos.sol.tipoComponente ?? ''
  const inicial = sku.trim() === '' ? '?' : sku.trim()[0].toUpperCase()
  const descripcion = pendiente ? datos.sol.descripcion : null
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-testid={`tarjeta-solicitud-${datos.clase}-${datos.id}`}
          data-grupo={datos.grupo}
          className={cn(
            'flex items-center gap-2.5 rounded-md',
            pendiente ? 'p-2.5' : 'p-2',
            pendiente ? (alterna ? 'bg-notif-tarjeta-alt' : 'bg-superficie') : alterna ? 'bg-notif-rechazada-alt' : 'bg-notif-rechazada-bg',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
              pendiente ? 'bg-badge-neutro-bg text-azul-gris' : 'bg-notif-avatar-apagado text-notif-texto-apagado',
            )}
          >
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-[13px]', pendiente ? 'font-bold text-azul-medio' : 'font-normal text-texto-fecha-inicio')}>{sku}</span>
              {datos.clase === 'U' && (
                <span
                  className={cn(
                    'rounded px-[5px] py-px text-[10px] font-bold',
                    pendiente ? 'bg-aviso-conflicto-bg text-notif-urgente-text' : 'bg-notif-urgente-apagado-bg text-notif-urgente-apagado-text',
                  )}
                >
                  ⚠
                </span>
              )}
            </div>
            {/* pre-wrap: el separador "  ·  " lleva dobles espacios que HTML colapsaría */}
            <p className={cn('text-[11px] whitespace-pre-wrap', pendiente ? 'text-texto-fecha-inicio' : 'text-notif-texto-apagado')}>{lineaInfo(datos)}</p>
            {descripcion && <p className="text-[11px] whitespace-pre-line text-azul-gris">{descripcion}</p>}
          </div>
          {pendiente ? (
            <button type="button" onClick={onRechazar} className={cn(PILDORA, 'bg-notif-rechazar-bg text-notif-rechazar-text')}>
              Rechazar
            </button>
          ) : (
            <>
              <button type="button" onClick={onRecuperar} className={cn(PILDORA, 'bg-azul-medio text-superficie')}>
                Recuperar
              </button>
              <button type="button" aria-label="Borrar solicitud" onClick={onQuitar} className="cursor-pointer">
                <img src="/borrar.png" alt="" className="h-[18px] w-[18px] opacity-50" />
              </button>
            </>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {pendiente ? (
          <ContextMenuItem onSelect={onRechazar}>Rechazar solicitud</ContextMenuItem>
        ) : (
          <ContextMenuItem onSelect={onRecuperar}>Recuperar solicitud</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
