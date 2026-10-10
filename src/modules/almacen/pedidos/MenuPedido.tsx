import { useEffect } from 'react'
import { ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/shared/ui/context-menu'
import type { DestinoMover } from './bloques/reglas'
import { entradasMenu, type AccionMenu, type Pedido } from './reglas'

type Props = {
  pedido: Pedido
  onAccion: (accion: AccionMenu, pedido: Pedido) => void
  /** Aviso de menú abierto/cerrado para congelar el sondeo (D4 del 3a), como MenuComponente. Estable entre renders. */
  onInteraccion?: (abierto: boolean) => void
  /** 0.9.9: «Mover a bloque ▸» (solo componentes). `sola`: la línea es la única de su bloque (sin «Bloque nuevo»). */
  mover?: { destinos: DestinoMover[]; sola: boolean; onMover: (idBloque: number | null) => void }
}

/** Contenido del menú contextual de una fila de Pedidos (solo SUPERTECNICO; la página no pasa menuFila a ADMIN ni TECNICO).
 *  Entradas y separadores por estado de `entradasMenu`; cancelado no tiene ninguna salvo «Mover a bloque» (0.9.9). */
export function MenuPedido({ pedido, onAccion, onInteraccion, mover }: Props) {
  // Radix monta el contenido solo mientras el menú está abierto: montar/desmontar = abrir/cerrar.
  useEffect(() => {
    if (!onInteraccion) return
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])
  const entradas = entradasMenu(pedido.estado)
  if (entradas.length === 0 && !mover) return null
  return (
    <>
      {entradas.map((e, i) =>
        e === 'separador' ? (
          <ContextMenuSeparator key={`sep-${i}`} />
        ) : (
          <ContextMenuItem key={e.accion} onSelect={() => onAccion(e.accion, pedido)}>{e.texto}</ContextMenuItem>
        ),
      )}
      {mover && (
        <>
          {entradas.length > 0 && <ContextMenuSeparator />}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Mover a bloque</ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-[280px]">
              {mover.destinos.map((d) => (
                <ContextMenuItem key={d.idBloque} onSelect={() => mover.onMover(d.idBloque)} className="flex w-full gap-4">
                  <span>{d.texto}</span>
                  <span className="ml-auto text-[11px] text-texto-sub">{d.detalle}</span>
                </ContextMenuItem>
              ))}
              {mover.destinos.length > 0 && <ContextMenuSeparator />}
              <ContextMenuItem disabled={mover.sola} onSelect={() => mover.onMover(null)} className="flex w-full gap-4">
                <span>Bloque nuevo</span>
                {mover.sola && <span className="ml-auto text-[11px] text-texto-sub">ya está sola en su bloque</span>}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </>
      )}
    </>
  )
}
