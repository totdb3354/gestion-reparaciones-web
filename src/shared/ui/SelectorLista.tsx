import { useLayoutEffect, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Input } from './input'

export type OpcionLista = { clave: string; etiqueta: string }

type Props = {
  abierto: boolean
  titulo: string
  etiquetaLista?: string
  placeholderBuscar: string
  opciones: OpcionLista[]
  claveActual?: string | null
  /** Si se da, debajo de la lista se muestra este texto o la etiqueta elegida (SelectorClienteDialog). */
  textoNada?: string
  textoSeleccionar: string
  onSeleccionar: (clave: string) => void
  onCancelar: () => void
}

/** Calco de SelectorClienteDialog y del selector "Editar modelo": buscador que filtra por etiqueta, lista con la opción
 *  actual resaltada y la elegida en navy, botón principal deshabilitado hasta elegir; doble clic elige directamente. */
export function SelectorLista({ abierto, titulo, etiquetaLista, placeholderBuscar, opciones, claveActual = null, textoNada, textoSeleccionar, onSeleccionar, onCancelar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el buscador y la selección al reabrir (patrón "Adjusting state", como ClienteDialog)
    if (abierto) { setBusqueda(''); setSeleccion(null) }
  }, [abierto])
  const filtro = busqueda.trim().toLowerCase()
  const visibles = filtro === '' ? opciones : opciones.filter((o) => o.etiqueta.toLowerCase().includes(filtro))
  const elegida = opciones.find((o) => o.clave === seleccion)
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[440px] gap-3 bg-crema p-6">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-bold text-azul-medio">{titulo}</DialogTitle>
        </DialogHeader>
        {etiquetaLista && <p className="text-[12px] text-azul-medio">{etiquetaLista}</p>}
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={placeholderBuscar} aria-label={placeholderBuscar} className="bg-superficie text-[13px]" />
        <ul role="listbox" aria-label={titulo} className="max-h-[300px] overflow-auto rounded border border-fila-sep bg-superficie py-1">
          {visibles.map((o) => (
            <li key={o.clave} role="option" aria-selected={seleccion === o.clave}>
              <button
                type="button"
                onClick={() => setSeleccion(o.clave)}
                onDoubleClick={() => onSeleccionar(o.clave)}
                className={cn(
                  'mx-1 my-0.5 block w-[calc(100%-8px)] rounded px-3 py-1 text-left text-[12px] text-azul-noche hover:bg-seleccion-suave',
                  seleccion === o.clave ? 'bg-azul-noche font-bold text-superficie hover:bg-azul-noche' : claveActual === o.clave && 'bg-seleccion-suave font-bold',
                )}
              >
                {o.etiqueta}
              </button>
            </li>
          ))}
        </ul>
        {textoNada !== undefined && <p className="text-[12px] text-azul-gris">{elegida ? elegida.etiqueta : textoNada}</p>}
        <Button disabled={!seleccion} onClick={() => seleccion && onSeleccionar(seleccion)} className="h-auto w-full rounded bg-azul-medio py-2.5 text-[12px] text-crema hover:bg-azul-medio/90">
          {textoSeleccionar}
        </Button>
        <Button variant="outline" onClick={onCancelar} className="h-auto w-full rounded border-azul-gris bg-crema py-2.5 text-[12px] text-azul-gris shadow-none hover:bg-crema hover:text-azul-gris">
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
