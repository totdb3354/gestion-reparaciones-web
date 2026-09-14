import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Checkbox } from './checkbox'
import { cn } from '@/shared/lib/utils'

export function textoMultiSelect(seleccion: string[], textoVacio: string, textoPlural: (n: number) => string) {
  if (seleccion.length === 0) return textoVacio
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
  className?: string
}

/** Desplegable con checkboxes, calco de MultiSelectDropdown: la etiqueta del botón resume la selección. */
export function MultiSelect<T>({ opciones, clave, etiqueta, seleccion, onChange, textoVacio, textoPlural, className }: Props<T>) {
  const texto = textoMultiSelect([...seleccion], textoVacio, textoPlural)
  function toggle(k: string, marcado: boolean) {
    const s = new Set(seleccion)
    if (marcado) s.add(k)
    else s.delete(k)
    onChange(s)
  }
  return (
    <Popover>
      <PopoverTrigger
        className={cn('h-8 min-w-36 rounded border border-azul-gris bg-white px-3 text-left text-[12px] text-azul-medio', className)}
      >
        {texto}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-auto p-2">
        {opciones.map((o) => {
          const k = clave(o)
          const id = `ms-${k}`
          return (
            <label key={k} htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[12px] hover:bg-pill-bg">
              <Checkbox id={id} checked={seleccion.has(k)} onCheckedChange={(v) => toggle(k, v === true)} aria-label={etiqueta(o)} />
              {etiqueta(o)}
            </label>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
