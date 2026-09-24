import { useEffect } from 'react'
import type { Componente } from '@/shared/api/client'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'

type Props = {
  c: Componente
  rol: 'SUPERTECNICO' | 'TECNICO'
  onPedir: (c: Componente) => void
  onEditarStock: (c: Componente) => void
  onAjustarMinimo: (c: Componente) => void
  onToggleActivo: (c: Componente) => void
  onSolicitar: (c: Componente) => void
  /** Aviso de menú abierto/cerrado: congela el sondeo (D4 del 3a). Estable entre renders. */
  onInteraccion: (abierto: boolean) => void
}

/** Calco del menú contextual de configurarTablaStock (:353-388): supertécnico completo, técnico solo "Solicitar pieza";
 *  el ADMIN no tiene menú (la página no pasa menuFila). "Desactivar"/"Activar" alterna con el estado de la fila. */
export function MenuComponente({ c, rol, onPedir, onEditarStock, onAjustarMinimo, onToggleActivo, onSolicitar, onInteraccion }: Props) {
  // Radix monta el contenido solo mientras el menú está abierto: montar/desmontar = abrir/cerrar.
  useEffect(() => {
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])
  if (rol === 'TECNICO') return <ContextMenuItem onSelect={() => onSolicitar(c)}>Solicitar pieza</ContextMenuItem>
  return (
    <>
      <ContextMenuItem onSelect={() => onPedir(c)}>Pedir</ContextMenuItem>
      <ContextMenuItem onSelect={() => onEditarStock(c)}>Editar stock</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onAjustarMinimo(c)}>Ajustar mínimo</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onToggleActivo(c)}>{c.activo ? 'Desactivar' : 'Activar'}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onSolicitar(c)}>Solicitar pieza</ContextMenuItem>
    </>
  )
}
