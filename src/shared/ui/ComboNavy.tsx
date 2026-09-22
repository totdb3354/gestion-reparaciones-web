import { useEffect, useRef, useState } from 'react'
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
  /** Aviso de apertura/cierre para quien necesite congelar algo mientras el desplegable está abierto (p. ej. el
   *  refresco periódico de una tabla, que al recargar movería la fila bajo el cursor). Opcional: sin ella el combo
   *  se comporta igual que siempre. */
  onOpenChange?: (abierta: boolean) => void
  'aria-label': string
}

const ALTO_OPCION_PX = 28
const RELLENO_LISTA_PX = 8
const CLASE_TEXTO: Record<11 | 12, string> = { 11: 'text-[11px]', 12: 'text-[12px]' }

/** Combo navy de selección única (modelo y SKU del formulario): píldora navy con la etiqueta de la opción elegida y lista
 *  blanca con la opción activa en navy. `clase` colorea el texto de una opción (SKU por stock) en la lista y en el botón. El
 *  color no se mezcla con `cn`: se elige una clase u otra, para no depender de cómo resuelva tailwind-merge dos `text-*`. */
export function ComboNavy({ valor, opciones, onChange, textoVacio, ancho, tamanoTexto = 12, visibles, disabled = false, onOpenChange, 'aria-label': etiquetaAccesible }: Props) {
  const [abierto, setAbierto] = useState(false)
  const actual = opciones.find((o) => o.valor === valor) ?? null
  const tamano = CLASE_TEXTO[tamanoTexto]
  // El aviso no puede colgar del onOpenChange del Popover: la lista va controlada y elegir una opción la cierra a
  // mano, sin pasar por Radix. Aquí pasan los dos caminos, así que es el único sitio donde `abierto` cambia.
  const cambiarAbierto = (abrir: boolean) => {
    const siguiente = abrir && !disabled
    setAbierto(siguiente)
    onOpenChange?.(siguiente)
  }
  // Simetría del aviso: si la celda se desmonta con la lista abierta (la fila sale del sondeo, un cambio de ruta,
  // o `disabled` que pasa a `true` estando abierta), `cambiarAbierto` ya no vuelve a llamarse y quien escucha
  // `onOpenChange` se queda con el `true` sin su `false`. Para quien lo usa para congelar algo mientras el
  // desplegable está abierto (D4), eso lo deja congelado para siempre. Refs para no rearmar el efecto en cada
  // render: solo debe correr al desmontar, con el `abierto` y el `onOpenChange` vigentes en ese momento.
  const abiertoRef = useRef(abierto)
  const onOpenChangeRef = useRef(onOpenChange)
  // Sin deps: se sincronizan tras CADA render (nunca durante), para que el efecto de desmontaje de abajo, que solo
  // debe correr una vez, lea siempre el valor vigente sin tener que rearmarse en cada cambio.
  useEffect(() => {
    abiertoRef.current = abierto
    onOpenChangeRef.current = onOpenChange
  })
  useEffect(() => () => { if (abiertoRef.current) onOpenChangeRef.current?.(false) }, [])
  return (
    <Popover open={abierto} onOpenChange={cambiarAbierto}>
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
                    cambiarAbierto(false)
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
