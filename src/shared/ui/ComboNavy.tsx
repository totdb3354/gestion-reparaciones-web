import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/** `color`: tono del círculo de muestra (null = color desconocido, círculo gris discontinuo; sin el campo, no hay
 *  círculo). `grupo`: título del bloque, que se pinta antes de su primera opción. `resaltada`: anillo verde (p. ej. los
 *  chasis del color de la tapa). `titulo`: `title` de la opción. `etiquetaBoton`: lo que enseña el botón cerrado cuando
 *  esta opción es la elegida (por defecto `etiqueta`). Todos opcionales: sin ellos el combo se pinta como siempre. */
export type OpcionCombo = {
  valor: string
  etiqueta: string
  clase?: string
  color?: string | null
  grupo?: string
  resaltada?: boolean
  titulo?: string
  etiquetaBoton?: string
}

type Props = {
  valor: string | null
  opciones: OpcionCombo[]
  onChange: (valor: string) => void
  textoVacio: string
  /** Ancho en px, o `'full'` para llenar el ancho del contenedor (`w-full`; JavaFX: `setMaxWidth(Double.MAX_VALUE)`). */
  ancho: number | 'full'
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
const ALTO_TITULO_PX = 22
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

/** Círculo de color con borde fino en todos (para que blanco, starlight o plata se vean sobre fondo blanco); el color
 *  desconocido, gris y discontinuo. `sobreOscuro`: el círculo va sobre navy (botón cerrado, opción activa), donde un
 *  borde oscuro no se ve y un negro desaparecería: borde claro. */
function MuestraColor({ color, sobreOscuro = false }: { color: string | null; sobreOscuro?: boolean }) {
  if (color === null) {
    return <span aria-hidden="true" data-testid="muestra-color" data-desconocido="true" className="inline-block size-3 shrink-0 rounded-full border border-dashed border-gris-borde bg-superficie" />
  }
  return <span aria-hidden="true" data-testid="muestra-color" className={cn('inline-block size-3 shrink-0 rounded-full border', sobreOscuro ? 'border-white/70' : 'border-black/25')} style={{ backgroundColor: color }} />
}

/** Combo navy de selección única (modelo y SKU del formulario): píldora navy con la etiqueta de la opción elegida y lista
 *  blanca con la opción activa en navy. `clase` colorea el texto de una opción (SKU por stock) en la lista y en el botón. El
 *  color no se mezcla con `cn`: se elige una clase u otra, para no depender de cómo resuelva tailwind-merge dos `text-*`. */
export function ComboNavy({ valor, opciones, onChange, textoVacio, ancho, tamanoTexto = 12, visibles, disabled = false, onOpenChange, 'aria-label': etiquetaAccesible }: Props) {
  const [abierto, setAbierto] = useState(false)
  const actual = opciones.find((o) => o.valor === valor) ?? null
  const tamano = CLASE_TEXTO[tamanoTexto]
  // Las filas de título de bloque también ocupan alto en la lista: sin contarlas se verían menos opciones de las pedidas.
  const titulos = opciones.filter((o, i) => o.grupo !== undefined && o.grupo !== opciones[i - 1]?.grupo).length
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
        title={actual?.titulo}
        disabled={disabled}
        style={ancho === 'full' ? undefined : { width: ancho }}
        className={cn(
          'flex h-[27px] shrink-0 items-center justify-between gap-1 rounded-3xl bg-azul-noche px-3 font-bold hover:bg-azul-noche-hover disabled:cursor-default disabled:opacity-60 disabled:hover:bg-azul-noche',
          ancho === 'full' && 'w-full',
          tamano,
          actual?.clase || 'text-texto-nav-activo',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {actual?.color !== undefined && <MuestraColor color={actual.color} sobreOscuro />}
          <span className="truncate">{actual ? (actual.etiquetaBoton ?? actual.etiqueta) : textoVacio}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-texto-nav-activo" />
      </PopoverTrigger>
      <PopoverContent align="start" style={ancho === 'full' ? undefined : { minWidth: ancho }} className={cn(ancho === 'full' && 'min-w-(--radix-popover-trigger-width)', 'w-auto rounded-lg border border-fila-sep bg-superficie p-0 shadow-md')}>
        <ul
          role="listbox"
          aria-label={etiquetaAccesible}
          style={visibles !== undefined ? { maxHeight: visibles * ALTO_OPCION_PX + titulos * ALTO_TITULO_PX + RELLENO_LISTA_PX } : undefined}
          className={cn('overflow-auto py-1', visibles === undefined && 'max-h-72')}
        >
          {opciones.map((o, i) => {
            const activa = o.valor === valor
            const tituloBloque = o.grupo !== undefined && o.grupo !== opciones[i - 1]?.grupo ? o.grupo : null
            return (
              <Fragment key={o.valor}>
                {tituloBloque !== null && (
                  <li role="presentation" className="px-3 pt-1.5 pb-0.5 text-[10px] leading-[14px] font-bold tracking-wide text-azul-gris uppercase">
                    {tituloBloque}
                  </li>
                )}
                <li role="option" aria-selected={activa} data-resaltada={o.resaltada ? 'true' : undefined}>
                  <button
                    type="button"
                    title={o.titulo}
                    onClick={() => {
                      cambiarAbierto(false)
                      if (!activa) onChange(o.valor)
                    }}
                    className={cn(
                      'mx-1 flex h-7 w-[calc(100%-8px)] items-center gap-1.5 rounded-lg px-3 text-left font-bold',
                      tamano,
                      activa ? 'bg-azul-noche text-superficie' : cn('hover:bg-seleccion-suave', o.clase || 'text-azul-noche', o.resaltada && 'ring-2 ring-verde-ok ring-inset'),
                    )}
                  >
                    {o.color !== undefined && <MuestraColor color={o.color} sobreOscuro={activa} />}
                    <span className="truncate">{o.etiqueta}</span>
                  </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
