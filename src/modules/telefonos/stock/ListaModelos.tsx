import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import type { Grupo } from './modelo'

const MINI = 'inline-block min-w-5 rounded-lg px-1.5 text-center text-[10.5px] font-bold'
const VERDE = 'bg-fila-recibido-bg text-fila-recibido-brd'
const AZUL = 'bg-tipo-reparacion-bg text-tipo-reparacion-text'
const AMBAR = 'bg-fila-solicitud-bg text-fila-solicitud-brd'

function Mini({ clase, titulo, children }: { clase: string; titulo?: string; children: ReactNode }) {
  return <span title={titulo} className={cn(MINI, clase)}>{children}</span>
}

type Props = {
  grupos: Grupo[]
  elegido: string | null
  texto: string
  verNoCuenta: boolean
  onTexto: (texto: string) => void
  onElegir: (clave: string) => void
}

/** La columna de la izquierda: modelo + capacidad con el total en stock y tres números (listos, taller y revisión) más los libres (opción C del prototipo, con los totales de la B). */
export function ListaModelos({ grupos, elegido, texto, verNoCuenta, onTexto, onElegir }: Props) {
  return (
    <nav aria-label="Modelos" className="max-h-[calc(100vh-300px)] overflow-auto rounded-md bg-superficie max-[1500px]:max-h-[calc(100vh-260px)]">
      <input aria-label="Buscar modelo" placeholder="Buscar modelo…" value={texto} onChange={(e) => onTexto(e.target.value)}
        className="m-2 h-[34px] w-[calc(100%-16px)] rounded border border-borde-input px-2.5 text-[12px]" />
      <div aria-hidden className="flex flex-wrap gap-1.5 border-b border-fila-sep px-3 pb-2">
        <Mini clase={VERDE}>listos</Mini><Mini clase={AZUL}>taller</Mini><Mini clase={AMBAR}>revisión</Mini>
      </div>
      {grupos.length === 0 && <p className="p-4 text-[12px] text-azul-gris">Ningún modelo</p>}
      {grupos.map((g) => {
        const t = g.totales
        const activo = g.clave === elegido
        return (
          <button key={g.clave} type="button" aria-pressed={activo} onClick={() => onElegir(g.clave)}
            className={cn('flex w-full cursor-pointer items-center gap-2 border-b border-fila-sep px-3 py-2 text-left',
              activo ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-seleccion-suave')}>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">{g.clave}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1">
                <Mini clase={VERDE} titulo="Listos">{t.listos}</Mini>
                <Mini clase={AZUL} titulo="En el taller">{t.taller}</Mini>
                <Mini clase={AMBAR} titulo="En revisión">{t.revision}</Mini>
                <span className={cn('text-[11px]', activo ? 'text-[#c9d3e6]' : 'text-azul-gris')}>
                  · {t.libres} libres{verNoCuenta && t.noCuentan > 0 ? ` · ${t.noCuentan} no cuentan` : ''}
                </span>
              </span>
            </span>
            <span className="text-[15px] font-extrabold">{t.total}</span>
          </button>
        )
      })}
    </nav>
  )
}
