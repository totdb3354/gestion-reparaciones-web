import { useEffect } from 'react'
import { cn } from '@/shared/lib/utils'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import type { AccionMenuBloque, EntradaMenuBloque } from './reglas'

type Props = {
  entradas: EntradaMenuBloque[]
  onAccion: (accion: AccionMenuBloque) => void
  /** Aviso de menú abierto/cerrado para congelar el sondeo, como MenuPedido. */
  onInteraccion?: (abierto: boolean) => void
}
type Entrada = Exclude<EntradaMenuBloque, 'separador'>

function Texto({ entrada }: { entrada: Entrada }) {
  return (
    <>
      <span>{entrada.texto}</span>
      {entrada.motivo !== null && <span className="ml-auto pl-4 text-[11px] text-texto-sub">{entrada.motivo}</span>}
    </>
  )
}

const claseEntrada = (e: Entrada) => cn('flex w-full gap-2', e.peligro && 'text-rojo-accion')

/** Menú del bloque con clic derecho en su cabecera (spec §6.4). Radix monta el contenido solo mientras el menú está
 *  abierto: montar/desmontar = abrir/cerrar. */
export function MenuBloqueContextual({ entradas, onAccion, onInteraccion }: Props) {
  useEffect(() => {
    if (!onInteraccion) return
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])
  return (
    <>
      {entradas.map((e, i) =>
        e === 'separador' ? (
          <ContextMenuSeparator key={`sep-${i}`} />
        ) : (
          <ContextMenuItem key={e.accion} disabled={e.deshabilitada} onSelect={() => onAccion(e.accion)} className={claseEntrada(e)}>
            <Texto entrada={e} />
          </ContextMenuItem>
        ),
      )}
    </>
  )
}

/** Avisa de menú abierto mientras está montado: Radix no llama a onOpenChange(false) si el desplegable se desmonta abierto. */
function AvisoAbierto({ onInteraccion }: { onInteraccion?: (abierto: boolean) => void }) {
  useEffect(() => {
    if (!onInteraccion) return
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])
  return null
}

/** Botón ⋮ de la cabecera con el mismo menú (spec §6.3). */
export function BotonMenuBloque({ idBloque, entradas, onAccion, onInteraccion }: Props & { idBloque: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Acciones del bloque ${idBloque}`}
          className="h-[30px] w-[30px] shrink-0 cursor-pointer rounded-full text-[18px] leading-none hover:bg-fondo-vista">⋮</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[230px]">
        <AvisoAbierto onInteraccion={onInteraccion} />
        {entradas.map((e, i) =>
          e === 'separador' ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem key={e.accion} disabled={e.deshabilitada} onSelect={() => onAccion(e.accion)} className={claseEntrada(e)}>
              <Texto entrada={e} />
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
