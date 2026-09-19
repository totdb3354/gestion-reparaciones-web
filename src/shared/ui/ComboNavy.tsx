import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export type OpcionCombo = { valor: string; etiqueta: string; clase?: string }

type Props = {
  valor: string | null
  opciones: OpcionCombo[]
  onChange: (valor: string) => void
  textoVacio: string
  ancho: number
  tamanoTexto?: 11 | 12
  /** Filas visibles de la lista antes de desplazar (8 en el combo de SKU). */
  visibles?: number
  disabled?: boolean
  'aria-label': string
}

const ALTO_OPCION_PX = 28
const RELLENO_LISTA_PX = 8
const CLASE_TEXTO: Record<11 | 12, string> = { 11: 'text-[11px]', 12: 'text-[12px]' }

/** Combo navy de selección única (modelo y SKU del formulario): píldora navy con la etiqueta de la opción elegida y lista
 *  blanca con la opción activa en navy. `clase` colorea el texto de una opción (SKU por stock) en la lista y en el botón. El
 *  color no se mezcla con `cn`: se elige una clase u otra, para no depender de cómo resuelva tailwind-merge dos `text-*`. */
export function ComboNavy({ valor, opciones, onChange, textoVacio, ancho, tamanoTexto = 12, visibles, disabled = false, 'aria-label': etiquetaAccesible }: Props) {
  const [abierto, setAbierto] = useState(false)
  const actual = opciones.find((o) => o.valor === valor) ?? null
  const tamano = CLASE_TEXTO[tamanoTexto]
  return (
    <Popover open={abierto} onOpenChange={(o) => setAbierto(o && !disabled)}>
      <PopoverTrigger
        role="combobox"
        aria-haspopup="listbox"
        aria-label={etiquetaAccesible}
        disabled={disabled}
        style={{ width: ancho }}
        className={cn(
          'flex h-[27px] shrink-0 items-center justify-between gap-1 rounded-3xl bg-azul-noche px-3 font-bold hover:bg-azul-noche-hover disabled:cursor-default disabled:opacity-60 disabled:hover:bg-azul-noche',
          tamano,
          actual?.clase || 'text-texto-nav-activo',
        )}
      >
        <span className="truncate">{actual ? actual.etiqueta : textoVacio}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-texto-nav-activo" />
      </PopoverTrigger>
      <PopoverContent align="start" style={{ minWidth: ancho }} className="w-auto rounded-lg border border-fila-sep bg-superficie p-0 shadow-md">
        <ul
          role="listbox"
          aria-label={etiquetaAccesible}
          style={visibles !== undefined ? { maxHeight: visibles * ALTO_OPCION_PX + RELLENO_LISTA_PX } : undefined}
          className={cn('overflow-auto py-1', visibles === undefined && 'max-h-72')}
        >
          {opciones.map((o) => {
            const activa = o.valor === valor
            return (
              <li key={o.valor} role="option" aria-selected={activa}>
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(false)
                    if (!activa) onChange(o.valor)
                  }}
                  className={cn(
                    'mx-1 block h-7 w-[calc(100%-8px)] truncate rounded-lg px-3 text-left font-bold',
                    tamano,
                    activa ? 'bg-azul-noche text-superficie' : cn('hover:bg-seleccion-suave', o.clase || 'text-azul-noche'),
                  )}
                >
                  {o.etiqueta}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
