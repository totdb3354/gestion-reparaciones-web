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

/** El guardia de `cambiarAbierto`, aparte para poder testearlo sin depender de que la UI permita alcanzar cada
 *  combinación (hoy no se puede "abrir" con `disabled` a `true`: el trigger es un `<button disabled>` que no
 *  dispara el click). `null` = no hay cambio real que emitir: ni al pedir lo mismo que ya está, ni al "abrir"
 *  estando `disabled` (que colapsa a "seguir cerrado" si ya estaba cerrado). */
export function siguienteAbiertoOMismo(abrir: boolean, disabled: boolean, actual: boolean): boolean | null {
  const siguiente = abrir && !disabled
  return siguiente === actual ? null : siguiente
}

/** Combo navy de selección única (modelo y SKU del formulario): píldora navy con la etiqueta de la opción elegida y lista
 *  blanca con la opción activa en navy. `clase` colorea el texto de una opción (SKU por stock) en la lista y en el botón. El
 *  color no se mezcla con `cn`: se elige una clase u otra, para no depender de cómo resuelva tailwind-merge dos `text-*`. */
export function ComboNavy({ valor, opciones, onChange, textoVacio, ancho, tamanoTexto = 12, visibles, disabled = false, onOpenChange, 'aria-label': etiquetaAccesible }: Props) {
  const [abierto, setAbierto] = useState(false)
  const actual = opciones.find((o) => o.valor === valor) ?? null
  const tamano = CLASE_TEXTO[tamanoTexto]
  // Simetría del aviso: si la celda se desmonta con la lista abierta (la fila sale del sondeo, un cambio de ruta),
  // `cambiarAbierto` ya no vuelve a llamarse y quien escucha `onOpenChange` se queda con el `true` sin su `false`.
  // Para quien lo usa para congelar algo mientras el desplegable está abierto (D4), eso lo deja congelado para
  // siempre. `abiertoRef` es la fuente de verdad de "¿hay un `true` sin su `false` pendiente?": la muta el propio
  // manejador (permitido por react-hooks/refs, que solo prohíbe mutar una ref en el cuerpo del componente, no
  // dentro de un manejador de eventos), así que nunca va un render por detrás del estado real.
  //
  // NO cubre `disabled` que pasa a `true` con la lista abierta: `open` sigue en `true`, la lista sigue abierta y no
  // se emite ningún `false` (ver el comentario de `disabled` en Props). Ningún llamante de hoy junta un `disabled`
  // que pueda volverse `true` en caliente con un `onOpenChange` (CeldaTecnico no pasa `disabled`; FilaComponente y
  // CabeceraFormulario, que sí lo pasan, no pasan `onOpenChange`), así que queda documentado y no cerrado.
  const abiertoRef = useRef(abierto)
  const onOpenChangeRef = useRef(onOpenChange)
  // Sin deps: se sincroniza tras CADA render (nunca durante), para que el efecto de desmontaje de abajo, que solo
  // debe correr una vez, invoque siempre el `onOpenChange` vigente en ese momento.
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })
  // El aviso no puede colgar del onOpenChange del Popover: la lista va controlada y elegir una opción la cierra a
  // mano, sin pasar por Radix. Aquí pasan los dos caminos, así que es el único sitio donde `abierto` cambia. Solo
  // emite ante un cambio real (comparado con `abiertoRef`, no con el `abierto` del último render, que puede ir un
  // render por detrás): así ni "abrir" con `disabled` a `true` (siguiente es `false` sin que hubiera apertura) ni
  // cerrar-y-desmontar en el mismo commit (el efecto de desmontaje vería `abiertoRef` ya en `false`) duplican o
  // inventan un `false`.
  const cambiarAbierto = (abrir: boolean) => {
    const siguiente = siguienteAbiertoOMismo(abrir, disabled, abiertoRef.current)
    if (siguiente === null) return
    abiertoRef.current = siguiente
    setAbierto(siguiente)
    onOpenChange?.(siguiente)
  }
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
