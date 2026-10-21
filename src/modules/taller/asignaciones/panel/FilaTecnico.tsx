import type { FilaCarga } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { anchoBarra, CLASE_BARRA_NIVEL, CLASE_TEXTO_NIVEL, formatearPct, nivelCarga, pctTotal, textoDesglose, type Alcance } from '../carga'

/** Segunda línea del tooltip: la fila es pulsable y no hay otra pista visual que lo diga. */
const PISTA_CLICK = 'Click: ver sus asignaciones'

/**
 * Una fila del panel de carga (spec 3a §11, en el ancho del panel de la 0.9.20): nombre + las dos barras en la misma escala
 * + las cifras, todo dentro de un botón (la fila entera es pulsable y enfocable). Como la de la ventana de antes, con el
 * nombre en 72 px (antes 110) y las cifras en 58 px (antes 140). El porcentaje va en su propio <span>: así se puede leer
 * solo, sin el punto del alcance.
 */
export function FilaTecnico({ fila, alcance, onElegir }: { fila: FilaCarga; alcance: Alcance; onElegir: () => void }) {
  const total = pctTotal(fila)
  const nivel = nivelCarga(total)
  return (
    <button
      type="button"
      onClick={onElegir}
      title={`${textoDesglose(fila, alcance)}\n${PISTA_CLICK}`}
      className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left hover:bg-seleccion-suave"
    >
      <span className="w-[100px] shrink-0 truncate text-[13px] font-bold text-azul-medio">{fila.nombre}</span>
      {/* Las dos barras comparten carril y escala: cuando la verde alcanza a la de arriba, el día está hecho. */}
      <span className="flex flex-1 flex-col gap-[3px]">
        <span className="block h-[10px] rounded bg-carga-pista">
          <span className={cn('block h-full rounded', CLASE_BARRA_NIVEL[nivel])} style={{ width: `${anchoBarra(total, fila.sinJornada)}%` }} />
        </span>
        <span className="block h-[5px] rounded bg-carga-pista">
          <span className="block h-full rounded bg-verde-ok" style={{ width: `${anchoBarra(fila.pctHecho, fila.sinJornada)}%` }} />
        </span>
      </span>
      <span className="flex w-[58px] shrink-0 flex-col items-end">
        <span className={cn('flex items-center gap-1 text-[12px] font-bold', fila.sinJornada ? 'text-azul-medio' : CLASE_TEXTO_NIVEL[nivel])}>
          <span aria-hidden className={cn('text-[10px]', alcance === 'pedidos' ? 'text-carga-pedidos' : 'text-carga-total')}>●</span>
          {fila.sinJornada ? '—' : <span>{formatearPct(total)}</span>}
        </span>
        {fila.sinJornada ? (
          <span className="text-[9px] text-texto-sub">sin jornada hoy</span>
        ) : (
          <span className="text-[10px] font-bold text-recibido-text">✓ {formatearPct(fila.pctHecho)}</span>
        )}
      </span>
    </button>
  )
}
