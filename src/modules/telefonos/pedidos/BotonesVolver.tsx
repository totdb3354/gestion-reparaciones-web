import type { Donde } from './volver'

const BOTON = 'pointer-events-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-2xl px-3.5 text-[12px] font-bold shadow-[0_4px_14px_rgba(0,18,50,.22)]'

/** Los dos botones flotantes de abajo a la derecha de la tabla de Pedidos. Solo salen cuando hacen falta. */
export function BotonesVolver({ enFinal, donde, nuevos, onFinal, onSeleccionada }: {
  enFinal: boolean; donde: Donde; nuevos: number; onFinal: () => void; onSeleccionada: () => void
}) {
  if (enFinal && !donde) return null
  return (
    <div className="pointer-events-none absolute right-5 bottom-4 z-[4] flex flex-col items-end gap-2">
      {donde && (
        <button type="button" onClick={onSeleccionada} title="Vuelve a la fila seleccionada (la última que tocaste)"
          className={`${BOTON} border border-[#9db8e8] bg-superficie text-[#1d3a78]`}>
          <span aria-hidden className="h-3.5 w-1 rounded-sm bg-[#2f6fe0]" />
          {donde === 'arriba' ? '↑' : '↓'} Fila seleccionada
        </button>
      )}
      {!enFinal && (
        <button type="button" onClick={onFinal} title="Baja a los pedidos más recientes"
          aria-label={nuevos > 0 ? `↓ Al final (${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'})` : '↓ Al final'}
          className={`${BOTON} border border-azul-noche bg-azul-noche text-superficie`}>
          ↓ Al final
          {nuevos > 0 && <span className="rounded-lg bg-[#f1e356] px-1.5 text-[11px] text-azul-noche">{nuevos} {nuevos === 1 ? 'nuevo' : 'nuevos'}</span>}
        </button>
      )}
    </div>
  )
}
