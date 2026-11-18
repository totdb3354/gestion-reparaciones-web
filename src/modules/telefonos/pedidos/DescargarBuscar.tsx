import { useState } from 'react'
import { elegirDestino } from '@/shared/lib/descargas'
import { hoyMadrid } from '@/shared/lib/fechas'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { TIPO_XLSX, useDescargarBuscar, type PlataformaBuscar } from '../api'

const OPCIONES: { plataforma: PlataformaBuscar; texto: string }[] = [
  { plataforma: 'AMZ', texto: 'AMZ' },
  { plataforma: 'FNSK', texto: 'FNSK' },
  { plataforma: 'WEBS', texto: 'Webs' },
]

/** «Descargar para buscar» (cabecera de Pedidos): menú con la plataforma (AMZ, FNSK o Webs) y el Excel de lo que hay que buscar para
 *  ella. Como las plantillas de NSYS, «Guardar como» va en el mismo clic, antes de pedir el fichero al servidor. Mientras baja, el botón
 *  queda deshabilitado; un error sale en el diálogo de siempre. */
export function DescargarBuscar() {
  const [abierto, setAbierto] = useState(false)
  const descargar = useDescargarBuscar()
  const bajar = async (plataforma: PlataformaBuscar) => {
    setAbierto(false)
    const [, mes, dia] = hoyMadrid().split('-')
    const destino = await elegirDestino(`Buscar ${plataforma} ${dia}-${mes}.xlsx`, TIPO_XLSX)
    if (destino === 'cancelado') return
    descargar.mutate({ plataforma, destino })
  }
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button type="button" disabled={descargar.isPending}
          className="h-7 cursor-pointer rounded-xl border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold text-azul-medio disabled:cursor-default disabled:opacity-60">Descargar para buscar</button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Plataforma que buscar" className="w-auto min-w-32 rounded-lg border-azul-medio bg-superficie p-1 shadow-[0_8px_24px_rgba(0,18,50,.25)]">
        {OPCIONES.map((o) => (
          <button key={o.plataforma} type="button" onClick={() => void bajar(o.plataforma)}
            className="block w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-[12.5px] font-semibold hover:bg-seleccion-suave">{o.texto}</button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
