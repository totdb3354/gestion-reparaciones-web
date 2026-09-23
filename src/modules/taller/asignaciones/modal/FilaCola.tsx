import { traducirModelo } from '../../lib/modelos'
import { TIPO_TRABAJO } from '@/shared/lib/tipoTrabajo'
import { cn } from '@/shared/lib/utils'
import type { Entrada } from './estado/tipos'

type Props = { e: Entrada; nombresTecnicos: string; seleccionada: boolean; onCargar: () => void; onQuitar: () => void }

const PILDORA = 'shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold'

/** Fila de las listas roja y verde (crearFilaPila del JavaFX). Fondo de fila seleccionada: #EAF1FF, que ya existe
 *  como --color-seleccion-suave (Task 14, Step 1) — se reutiliza en vez de un token "cola-sel-bg" duplicado. */
export function FilaCola({ e, nombresTecnicos, seleccionada, onCargar, onQuitar }: Props) {
  const esGlass = e.tipo === 'GLASS'
  return (
    <div
      onClick={onCargar}
      className={cn('flex cursor-pointer items-center gap-2 border-b border-pill-buscando-bg py-[7px] pr-[9px]',
        seleccionada ? 'border-l-4 border-l-azul-medio bg-seleccion-suave pl-[5px]' : 'pl-[9px]')}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[12px] font-bold text-azul-medio">{e.imei}</span>
          <span className={cn('shrink-0 rounded-md px-1.5 text-[9.5px] font-bold',
            esGlass ? TIPO_TRABAJO.GLASS.clases : TIPO_TRABAJO.REPARACION.clases)}>{esGlass ? 'Glass' : 'Rep'}</span>
          {e.modelo
            ? <span className={cn(PILDORA, 'bg-pill-modelo-bg text-pill-modelo-text')}>{traducirModelo(e.modelo)}</span>
            : e.buscando
              ? <span className={cn(PILDORA, 'bg-pill-buscando-bg text-azul-gris')}>Buscando…</span>
              : <span className={cn(PILDORA, 'bg-pill-aviso-bg text-pill-aviso-text')}>⚠ falta modelo</span>}
          {e.calculando && <span className={cn(PILDORA, 'bg-pill-buscando-bg text-azul-gris')}>Calculando…</span>}
        </div>
        {e.asignada && e.tecnicos.length > 0 && (
          <div className="flex items-center gap-1.5">
            {e.auto && <span className={cn('rounded-md px-1.5 text-[9.5px] font-bold', TIPO_TRABAJO.GLASS.clases)}>auto</span>}
            <span className="text-[10.5px] text-azul-gris">{nombresTecnicos}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label={`Quitar ${e.imei}`}
        onClick={(ev) => { ev.stopPropagation(); onQuitar() }}
        className="shrink-0 px-1 text-[12px] text-cola-quitar hover:text-cola-roja"
      >
        ✕
      </button>
    </div>
  )
}
