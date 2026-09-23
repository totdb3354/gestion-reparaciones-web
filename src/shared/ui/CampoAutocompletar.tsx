import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '@/shared/lib/utils'

type Opcion = { clave: string; etiqueta: string }
type Props = {
  valor: string | null
  opciones: Opcion[]
  onElegir: (clave: string) => void
  onTextoCambiado?: (texto: string) => void
  placeholder: string
  disabled?: boolean
  'aria-label': string
}

const ALTO_FILA = 30
const VISIBLES = 6

/** Buscador en línea del modal "Asignar trabajos" (modelo y cliente): calco de los TextField + Popup del JavaFX. */
export function CampoAutocompletar({ valor, opciones, onElegir, onTextoCambiado, placeholder, disabled, 'aria-label': ariaLabel }: Props) {
  const etiquetaDe = (clave: string | null) => opciones.find((o) => o.clave === clave)?.etiqueta ?? ''
  const elegida = etiquetaDe(valor)
  const [texto, setTexto] = useState(elegida)
  const [abierto, setAbierto] = useState(false)
  const idLista = useId()

  // Sincronía con `valor` sin useEffect (dispararía react-hooks/set-state-in-effect): patrón de React "ajustar el
  // estado cuando cambia una prop", comparando contra la última `elegida` vista y ajustando durante el propio
  // render en vez de en un efecto tras el commit. Cubre tanto el `elegir()` de aquí abajo (que ya deja `texto`
  // igual a la nueva etiqueta, así que esto no lo pisa) como un cambio de `valor` que llegue desde fuera del campo
  // (el padre resetea el modal, una predicción lo rellena, etc.), que es el caso que un efecto también cubriría.
  const [elegidaPrevia, setElegidaPrevia] = useState(elegida)
  if (elegida !== elegidaPrevia) {
    setElegidaPrevia(elegida)
    setTexto(elegida)
  }

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase()
    return t === '' ? opciones : opciones.filter((o) => o.etiqueta.toLowerCase().includes(t))
  }, [texto, opciones])

  const elegir = (o: Opcion) => {
    setTexto(o.etiqueta)
    setAbierto(false)
    onElegir(o.clave)
  }

  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Escape') { setAbierto(false); return }
    if (ev.key !== 'Enter') return
    ev.preventDefault()
    const t = texto.trim()
    if (t === '' || (valor != null && t === elegida)) return
    if (filtradas.length > 0) elegir(filtradas[0])
  }

  const onBlur = () => {
    setAbierto(false)
    const t = texto.trim()
    if (valor != null && t === elegida) return
    const exacta = opciones.find((o) => o.etiqueta.toLowerCase() === t.toLowerCase())
    if (exacta && t !== '') elegir(exacta)
    else setTexto(elegida)
  }

  return (
    <div className="relative w-full">
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        value={texto}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(ev) => {
          setTexto(ev.target.value)
          setAbierto(true)
          if (ev.target.value !== elegida) onTextoCambiado?.(ev.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="w-full rounded-full bg-azul-noche px-3 py-1 text-[12px] font-bold text-crema placeholder:text-crema/45 disabled:opacity-60"
      />
      {abierto && filtradas.length > 0 && (
        <ul
          id={idLista}
          role="listbox"
          style={{ maxHeight: `${ALTO_FILA * VISIBLES}px` }}
          className="absolute z-50 mt-px w-full overflow-y-auto rounded-lg border border-borde-input bg-white py-0.5 shadow-md"
        >
          {filtradas.map((o) => (
            <li
              key={o.clave}
              role="option"
              aria-selected={o.clave === valor}
              // mousedown en vez de click: se adelanta al blur del input, que si no cerraría la lista antes
              onMouseDown={(ev) => { ev.preventDefault(); elegir(o) }}
              className={cn('mx-1.5 cursor-pointer rounded-lg px-3 text-[12px] font-bold text-azul-noche hover:bg-azul-noche hover:text-white')}
              style={{ lineHeight: `${ALTO_FILA}px` }}
            >
              {o.etiqueta}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
