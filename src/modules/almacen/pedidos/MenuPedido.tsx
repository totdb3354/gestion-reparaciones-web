import { useEffect } from 'react'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'
import { entradasMenu, type AccionMenu, type Pedido } from './reglas'

type Props = {
  pedido: Pedido
  onAccion: (accion: AccionMenu, pedido: Pedido) => void
  /** Aviso de menú abierto/cerrado para congelar el sondeo (D4 del 3a), como MenuComponente. Estable entre renders. */
  onInteraccion?: (abierto: boolean) => void
}

/** Contenido del menú contextual de una fila de Pedidos (solo SUPERTECNICO; la página no pasa menuFila a ADMIN ni TECNICO).
 *  Entradas y separadores por estado de `entradasMenu`; cancelado no tiene ninguna. */
export function MenuPedido({ pedido, onAccion, onInteraccion }: Props) {
  // Radix monta el contenido solo mientras el menú está abierto: montar/desmontar = abrir/cerrar.
  useEffect(() => {
    if (!onInteraccion) return
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])
  const entradas = entradasMenu(pedido.estado)
  if (entradas.length === 0) return null
  return (
    <>
      {entradas.map((e, i) =>
        e === 'separador' ? (
          <ContextMenuSeparator key={`sep-${i}`} />
        ) : (
          <ContextMenuItem key={e.accion} onSelect={() => onAccion(e.accion, pedido)}>{e.texto}</ContextMenuItem>
        ),
      )}
    </>
  )
}
