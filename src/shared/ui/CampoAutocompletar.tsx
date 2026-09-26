import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from './popover'

type Opcion = { clave: string; etiqueta: string }
type Props = {
  valor: string | null
  opciones: Opcion[]
  onElegir: (clave: string) => void
  onTextoCambiado?: (texto: string) => void
  placeholder: string
  disabled?: boolean
  'aria-label': string
  /** Abre la lista (todas las opciones, o las que filtre el texto actual) al enfocar o pulsar el campo, como el popup
   *  de "Acción..."/"Técnico..." de LogController. Por defecto `false`: solo se abre al teclear. */
  abrirAlEnfocar?: boolean
  /** Ancho mínimo de la lista en px (puede ser más ancha que el campo, alineada al inicio). Sin él, el ancho del campo. */
  anchoLista?: number
}

const ALTO_FILA = 30
const VISIBLES = 6

/** Buscador en línea del modal "Asignar trabajos" (modelo y cliente): calco de los TextField + Popup del JavaFX. */
export function CampoAutocompletar({
  valor, opciones, onElegir, onTextoCambiado, placeholder, disabled, 'aria-label': ariaLabel, abrirAlEnfocar = false, anchoLista,
}: Props) {
  const etiquetaDe = (clave: string | null) => opciones.find((o) => o.clave === clave)?.etiqueta ?? ''
  const elegida = etiquetaDe(valor)
  const [texto, setTexto] = useState(elegida)
  const [abierto, setAbierto] = useState(false)
  const idLista = useId()

  // Sincronía con `valor` sin useEffect (dispararía react-hooks/set-state-in-effect): patrón de React "ajustar el
  // estado cuando cambia una prop", comparando contra la última `elegida` vista y ajustando durante el propio
  // render en vez de en un efecto tras el commit. Cubre tanto el `elegir()` de aquí abajo (que ya deja `texto`
  // igual a la nueva etiqueta, así que esto no lo pisa) como un cambio de `valor` que llegue desde fuera del campo
  // (una predicción o un lookup lo rellenan, etc.), que es el caso que un efecto también cubriría.
  // Solo se resincroniza hacia una etiqueta NO vacía: si `valor` pasa a null/'' es porque el usuario está escribiendo
  // encima (DetalleEntrada borra el modelo desde `onTextoCambiado`, BORRAR_MODELO) y el JavaFX conserva lo tecleado
  // mientras quita el modelo; pisarlo con '' vaciaría el campo a cada tecla. Los resets a "sin entrada" no pasan por
  // aquí: los padres remontan el campo con `key` (seq de la entrada).
  const [elegidaPrevia, setElegidaPrevia] = useState(elegida)
  if (elegida !== elegidaPrevia) {
    setElegidaPrevia(elegida)
    if (elegida !== '') setTexto(elegida)
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
      <Popover open={abierto && filtradas.length > 0}>
        <PopoverAnchor asChild>
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
            onFocus={abrirAlEnfocar ? () => setAbierto(true) : undefined}
            onClick={abrirAlEnfocar ? () => setAbierto(true) : undefined}
            className="w-full rounded-full bg-azul-noche px-3 py-1 text-[12px] font-bold text-crema placeholder:text-crema/45 disabled:opacity-60"
          />
        </PopoverAnchor>
        {/* Portal (Radix Popover) en vez de `position: absolute` dentro de la celda: la fila puede vivir en una tabla
            con scroll propio (DialogoLineas, C24) y un popup absolute quedaría recortado por ese contenedor en vez
            de traído a la vista por su scroll. El portal escapa a document.body y Radix posiciona el contenido bajo
            el input (Popper), así que nunca queda recortado. Sin autofoco de Radix al abrir/cerrar: el foco se queda
            en el input, igual que con el popup absolute de antes. */}
        <PopoverContent
          align="start"
          sideOffset={2}
          onOpenAutoFocus={(ev) => ev.preventDefault()}
          onCloseAutoFocus={(ev) => ev.preventDefault()}
          // Con `anchoLista` la lista crece hasta su contenido con ese mínimo (el popup de Logs mide ≈250 frente a los
          // 150 del campo y así no recorta los códigos); sin él, el ancho del campo como hasta ahora. El máximo evita
          // que un código largo (o el viewport estrecho) la ensanche sin límite; las opciones se cortan con "…" y el
          // texto completo queda en el `title`.
          style={anchoLista != null ? { minWidth: `${anchoLista}px` } : undefined}
          className={cn(
            anchoLista != null ? 'w-max max-w-[min(480px,calc(100vw-32px))]' : 'w-[var(--radix-popover-trigger-width)]',
            'rounded-lg border border-borde-input bg-white p-0.5 shadow-md',
          )}
        >
          <ul
            id={idLista}
            role="listbox"
            style={{ maxHeight: `${ALTO_FILA * VISIBLES}px` }}
            className="overflow-y-auto"
          >
            {filtradas.map((o) => (
              <li
                key={o.clave}
                role="option"
                aria-selected={o.clave === valor}
                title={o.etiqueta}
                // mousedown en vez de click: se adelanta al blur del input, que si no cerraría la lista antes
                onMouseDown={(ev) => { ev.preventDefault(); elegir(o) }}
                className={cn('mx-1.5 cursor-pointer truncate rounded-lg px-3 text-[12px] font-bold text-azul-noche hover:bg-azul-noche hover:text-white')}
                style={{ lineHeight: `${ALTO_FILA}px` }}
              >
                {o.etiqueta}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
