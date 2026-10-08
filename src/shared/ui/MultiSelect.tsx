import { Fragment, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Checkbox } from './checkbox'
import { cn } from '@/shared/lib/utils'

export function textoMultiSelect(seleccion: string[], textoVacio: string, textoPlural: (n: number) => string, total?: number, textoTodas?: string) {
  if (seleccion.length === 0) return textoVacio
  if (textoTodas !== undefined && total !== undefined && total > 1 && seleccion.length === total) return textoTodas
  if (seleccion.length === 1) return seleccion[0]
  return textoPlural(seleccion.length)
}

type Props<T> = {
  opciones: T[]
  clave: (o: T) => string
  etiqueta: (o: T) => string
  seleccion: Set<string>
  onChange: (s: Set<string>) => void
  textoVacio: string
  textoPlural: (n: number) => string
  textoTodas?: string
  /** Aviso de apertura/cierre para quien necesite congelar algo mientras el desplegable está abierto (p. ej. el
   *  refresco periódico de una tabla, que al recargar movería las filas bajo el cursor). Opcional: sin ella el
   *  Popover se comporta igual que siempre. */
  onOpenChange?: (abierta: boolean) => void
  /** Clave de la opción antes de la que se pinta una línea horizontal: separa un grupo de opciones de otra naturaleza
   *  (en Stock, Auto / Manual bajo los estados del semáforo). */
  separadorAntes?: string
  className?: string
}

/** Desplegable con checkboxes, calco de MultiSelectDropdown: la etiqueta del botón resume la selección. */
export function MultiSelect<T>({ opciones, clave, etiqueta, seleccion, onChange, textoVacio, textoPlural, textoTodas, onOpenChange, separadorAntes, className }: Props<T>) {
  // La etiqueta de una única selección es el nombre de la opción, no su clave (los técnicos van por id)
  const nombres = [...seleccion].map((k) => { const o = opciones.find((x) => clave(x) === k); return o ? etiqueta(o) : k })
  const texto = textoMultiSelect(nombres, textoVacio, textoPlural, opciones.length, textoTodas)
  // ids únicos aunque haya varios MultiSelect con las mismas claves en la página
  const idBase = useId()
  function toggle(k: string, marcado: boolean) {
    const s = new Set(seleccion)
    if (marcado) s.add(k)
    else s.delete(k)
    onChange(s)
  }
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          'flex h-10 min-w-[200px] items-center justify-between rounded-3xl bg-azul-noche px-4 text-[12px] font-bold text-texto-nav-activo hover:bg-azul-noche-hover',
          className,
        )}
      >
        {texto}
        <ChevronDown aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-auto rounded-lg border border-fila-sep bg-superficie p-2 shadow-md">
        {opciones.map((o, i) => {
          const k = clave(o)
          const id = `${idBase}-${i}`
          return (
            <Fragment key={k}>
              {k === separadorAntes && i > 0 && <div role="separator" className="my-1 border-t border-fila-sep" />}
              <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[12px] hover:bg-pill-bg">
                <Checkbox id={id} checked={seleccion.has(k)} onCheckedChange={(v) => toggle(k, v === true)} aria-label={etiqueta(o)} />
                {etiqueta(o)}
              </label>
            </Fragment>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
