import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { BarraReparto } from './BarraReparto'
import { capacidadCorta, type ModeloLista } from './modelo'

type Props = {
  modelos: ModeloLista[]
  elegido: string | null
  capacidad: string | null
  /** El buscador de la cabecera de la columna. */
  buscador: ReactNode
  onAbrir: (modelo: string, capacidad: string | null) => void
}

const LEYENDA: [string, string][] = [['bg-fila-recibido-brd', 'listos'], ['bg-tipo-reparacion-text', 'taller'], ['bg-ambar', 'revisión']]

/** La columna de la izquierda (0.9.18, spec «Columna compacta, SKU, Quién lo tiene y Revisado» §4.1): una fila por modelo
 *  con su total en stock, una pastilla por capacidad con stock y la barra listos / taller / revisión en el borde de abajo.
 *  El nombre abre el modelo con «Todas»; una pastilla, con esa capacidad. La fila elegida se resalta y se desplaza a la vista. */
export function ListaModelos({ modelos, elegido, capacidad, buscador, onAbrir }: Props) {
  const filaElegida = useRef<HTMLLIElement>(null)
  useEffect(() => {
    filaElegida.current?.scrollIntoView({ block: 'nearest' })
  }, [elegido])
  return (
    <nav aria-label="Modelos" className="flex max-h-[calc(100vh-300px)] min-h-0 flex-col overflow-hidden rounded-md bg-superficie max-[1500px]:max-h-[calc(100vh-260px)]">
      <div className="border-b border-fila-sep p-2">{buscador}</div>
      <div aria-hidden className="flex gap-3 border-b border-fila-sep px-3 py-1.5 text-[10.5px] text-azul-gris">
        {LEYENDA.map(([color, texto]) => (
          <span key={texto} className="flex items-center gap-1"><i className={cn('h-2 w-2 rounded-sm', color)} />{texto}</span>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {modelos.length === 0 && <li className="p-4 text-[12px] text-azul-gris">Ningún modelo</li>}
        {modelos.map((g) => {
          const activo = g.clave === elegido
          return (
            <li key={g.clave} ref={activo ? filaElegida : undefined} className={cn('relative border-b border-fila-sep px-3 pt-1.5 pb-2.5', activo && 'bg-seleccion-suave')}>
              <button type="button" aria-label={`${g.clave}: ${g.total} en stock`} aria-pressed={activo && capacidad === null} onClick={() => onAbrir(g.clave, null)}
                className="flex w-full cursor-pointer items-baseline text-left">
                <span className="text-[13px] font-bold text-azul-medio">{g.clave}</span>
                <span className="ml-auto text-[15px] font-extrabold text-azul-noche">{g.total}</span>
              </button>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.capacidades.filter((c) => c.stock > 0).map((c) => {
                  const on = activo && capacidad === c.capacidad
                  return (
                    <button key={c.capacidad} type="button" aria-label={`${g.clave} ${c.capacidad}: ${c.stock}`} aria-pressed={on} onClick={() => onAbrir(g.clave, c.capacidad)}
                      className={cn('group cursor-pointer rounded-md border px-1.5 py-px text-[11.5px] font-semibold whitespace-nowrap',
                        on ? 'border-azul-noche bg-azul-noche text-superficie' : 'border-pill-borde bg-pill-bg text-azul-medio hover:border-azul-noche hover:bg-azul-noche hover:text-superficie')}>
                      {capacidadCorta(c.capacidad)}
                      <span className={cn('ml-1', on ? 'text-[#c9d3e6]' : 'text-azul-gris group-hover:text-[#c9d3e6]')}>{c.stock}</span>
                    </button>
                  )
                })}
              </div>
              <BarraReparto reparto={g.reparto} className="absolute inset-x-0 bottom-0 h-1" />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
