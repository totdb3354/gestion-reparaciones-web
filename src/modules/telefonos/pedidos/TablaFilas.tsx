import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { CeldaImei } from './CeldaImei'
import { COLUMNAS } from './filas'

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
export function TablaFilas({ filas }: { filas: FilaVista[] }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  // Estable (para el `memo` de las filas). Cerrar una celda que ya no es la abierta no hace nada: el cierre tardío de la anterior
  // (foco, clic fuera) no puede cerrar la que acaba de abrirse.
  const cambiar = useCallback((id: number, abrir: boolean) => setAbierta((a) => (abrir ? id : a === id ? null : a)), [])
  const contenedor = useRef<HTMLDivElement>(null)
  // La altura que tenía el contenido tras el último pintado. Añadir filas no cambia `scrollTop` pero sí la altura, así que
  // «estaba abajo» se calcula justo antes de decidir con la altura de entonces, no con un valor guardado en un scroll antiguo.
  const alturaPrevia = useRef<number | null>(null)
  const vistas = useRef(0)

  useLayoutEffect(() => {
    const c = contenedor.current
    if (!c) return
    const estabaAbajo = alturaPrevia.current === null || alturaPrevia.current - c.scrollTop - c.clientHeight < 8
    if (filas.length > vistas.current && estabaAbajo) c.scrollTop = c.scrollHeight
    vistas.current = filas.length
    alturaPrevia.current = c.scrollHeight
  }, [filas.length])

  return (
    <div ref={contenedor} role="region" aria-label="Tabla de pedidos" className="min-h-0 flex-1 overflow-auto rounded-md border border-borde-input bg-superficie">
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <thead>
          <tr>
            {COLUMNAS.map((c) => (
              <th key={c} scope="col" className="sticky top-0 z-[2] border-r border-b border-fila-sep bg-fila-maestro-bg px-2.5 py-1.5 text-left text-[12px] font-bold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => <FilaTabla key={f.idFila} fila={f} abierta={abierta === f.idFila} onAbrir={cambiar} />)}
        </tbody>
      </table>
    </div>
  )
}
