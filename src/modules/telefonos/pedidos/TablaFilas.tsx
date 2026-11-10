import { useLayoutEffect, useRef, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { CeldaImei } from './CeldaImei'
import { COLUMNAS } from './filas'

const dia = (iso: string | null) => (iso ? diaNsys(iso) : '')

/** La hoja de pedidos (spec «Pedidos como la hoja» §3): una fila por pedido en el orden recibido, cabecera fija y las enviadas en
 *  gris. Al montar baja al final; al llegar filas nuevas baja solo si el usuario ya estaba abajo. Solo una celda de IMEI abierta. */
export function TablaFilas({ filas }: { filas: FilaVista[] }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const alFinal = useRef(true)
  const vistas = useRef(0)

  useLayoutEffect(() => {
    const c = contenedor.current
    if (c && filas.length > vistas.current && alFinal.current) c.scrollTop = c.scrollHeight
    vistas.current = filas.length
  }, [filas.length])

  return (
    <div ref={contenedor} role="region" aria-label="Tabla de pedidos"
      onScroll={(e) => { const c = e.currentTarget; alFinal.current = c.scrollHeight - c.scrollTop - c.clientHeight < 8 }}
      className="min-h-0 flex-1 overflow-auto rounded-md border border-borde-input bg-superficie">
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <thead>
          <tr>
            {COLUMNAS.map((c) => (
              <th key={c} scope="col" className="sticky top-0 z-[2] border-r border-b border-fila-sep bg-fila-maestro-bg px-2.5 py-1.5 text-left text-[12px] font-bold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const td = cn('h-8 border-r border-b border-form-fila-brd px-2.5 py-1 whitespace-nowrap', f.enviada && 'bg-[#fafbfc] text-[#8b93a1]')
            return (
              <tr key={f.idFila}>
                <td className={td}>{dia(f.fecha)}</td>
                <td className={td}>{f.plataforma}</td>
                <td className={cn(td, 'font-mono text-[12px]')}>{f.sku}</td>
                <CeldaImei fila={f} abierta={abierta === f.idFila} onAbrir={setAbierta} />
                <td className={td}>{f.pedido}</td>
                <td className={td}>{dia(f.fechaCompra)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
