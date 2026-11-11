import { memo, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { CeldaImei } from './CeldaImei'
import { COLUMNAS } from './filas'

type Columna = (typeof COLUMNAS)[number]

const dia = (iso: string | null) => (iso ? diaNsys(iso) : '')

type PropsFila = { fila: FilaVista; abierta: boolean; onAbrir: (idFila: number, abrir: boolean) => void }

/** Una fila de la hoja. Con ~1.500 filas, abrir una celda o recibir un sondeo no debe repintarlas todas: `memo` la deja quieta si
 *  su `fila` (TanStack conserva los objetos que no cambian) y su `abierta` son los mismos. Las fechas se dan formato aquí dentro. */
export const FilaTabla = memo(function FilaTabla({ fila: f, abierta, onAbrir }: PropsFila) {
  const td = cn('h-8 border-r border-b border-form-fila-brd px-2.5 py-1 whitespace-nowrap', f.enviada && 'bg-[#fafbfc] text-[#8b93a1]')
  return (
    <tr>
      <td className={td}>{dia(f.fecha)}</td>
      <td className={td}>{f.plataforma}</td>
      <td className={cn(td, 'font-mono text-[12px]')}>{f.sku}</td>
      <CeldaImei fila={f} abierta={abierta} onAbrir={onAbrir} />
      <td className={td}>{f.pedido}</td>
      <td className={td}>{dia(f.fechaCompra)}</td>
    </tr>
  )
})

/** La hoja de pedidos (spec «Pedidos como la hoja» §3): una fila por pedido en el orden recibido, cabecera fija y las enviadas en
 *  gris. Al montar baja al final; al llegar filas nuevas baja solo si el usuario ya estaba abajo. Solo una celda de IMEI abierta. */
export function TablaFilas({ filas, recibidas = filas.length, filtros, vacio }: {
  filas: FilaVista[]
  /** Cuántas filas ha recibido la página (sin filtrar por columna): solo llegar filas nuevas baja al final, no filtrar. */
  recibidas?: number
  filtros?: Partial<Record<Columna, ReactNode>>
  /** Lo que se enseña en el cuerpo si no hay filas que pintar (la cabecera y sus filtros siguen). */
  vacio?: ReactNode
}) {
  const [abierta, setAbierta] = useState<number | null>(null)
  // Si la fila abierta ya no se pinta (un filtro la esconde) o ya está enviada, se cierra: así no se reabre sola al quitar el filtro.
  if (abierta !== null && !filas.some((f) => f.idFila === abierta && !f.enviada)) setAbierta(null)
  // Estable (para el `memo` de las filas). Cerrar una celda que ya no es la abierta no hace nada: el cierre tardío de la anterior
  // (foco, clic fuera) no puede cerrar la que acaba de abrirse.
  const cambiar = useCallback((id: number, abrir: boolean) => setAbierta((a) => (abrir ? id : a === id ? null : a)), [])
  const contenedor = useRef<HTMLDivElement>(null)
  // La altura que tenía el contenido tras el último pintado. Añadir filas no cambia `scrollTop` pero sí la altura, así que
  // «estaba abajo» se calcula justo antes de decidir con la altura de entonces, no con un valor guardado en un scroll antiguo.
  const alturaPrevia = useRef<number | null>(null)
  const vistas = useRef(0)

  // En cada pintado: «estaba abajo» se calcula con la altura del pintado anterior (filtrar cambia la altura sin que el usuario se mueva).
  useLayoutEffect(() => {
    const c = contenedor.current
    if (!c) return
    const estabaAbajo = alturaPrevia.current === null || alturaPrevia.current - c.scrollTop - c.clientHeight < 8
    if (recibidas > vistas.current && estabaAbajo) c.scrollTop = c.scrollHeight
    vistas.current = recibidas
    alturaPrevia.current = c.scrollHeight
  })

  return (
    <div ref={contenedor} role="region" aria-label="Tabla de pedidos" className="min-h-0 flex-1 overflow-auto rounded-md border border-borde-input bg-superficie">
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <thead>
          <tr>
            {COLUMNAS.map((c) => (
              <th key={c} scope="col" className="sticky top-0 z-[2] border-r border-b border-fila-sep bg-fila-maestro-bg px-2.5 py-1.5 text-left text-[12px] font-bold has-[[data-activo]]:bg-[#dbe6fb]">{c}{filtros?.[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && vacio && <tr><td colSpan={COLUMNAS.length} className="p-4 text-[12px] text-azul-gris">{vacio}</td></tr>}
          {filas.map((f) => <FilaTabla key={f.idFila} fila={f} abierta={abierta === f.idFila} onAbrir={cambiar} />)}
        </tbody>
      </table>
    </div>
  )
}
