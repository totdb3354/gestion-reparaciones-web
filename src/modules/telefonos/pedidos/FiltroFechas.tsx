import { useId, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import type { Periodo } from './filas'

const OPCIONES: { valor: Periodo; texto: string }[] = [
  { valor: 'mes', texto: 'Último mes' },
  { valor: 'tres-meses', texto: 'Últimos 3 meses' },
  { valor: 'anio', texto: 'Este año' },
  { valor: 'todo', texto: 'Todo' },
  { valor: 'rango', texto: 'Rango…' },
]
const CLASE = 'h-8 rounded-md border border-borde-input bg-superficie px-2 text-[12px] text-azul-medio'

type Props = {
  periodo: Periodo
  rango: { desde: string; hasta: string }
  onPeriodo: (p: Periodo) => void
  onRango: (r: { desde: string; hasta: string }) => void
  /** Con una búsqueda en marcha el periodo no se aplica: se ve atenuado. */
  atenuado?: boolean
}

/** El filtro de fechas de «Pedidos»: el periodo y, con «Rango…», dos fechas. Un rango incompleto o al revés no se aplica: se
 *  queda el último válido. */
export function FiltroFechas({ periodo, rango, onPeriodo, onRango, atenuado }: Props) {
  const id = useId()
  const [desde, setDesde] = useState(rango.desde)
  const [hasta, setHasta] = useState(rango.hasta)
  const cambiar = (d: string, h: string) => {
    setDesde(d)
    setHasta(h)
    if (d && h && d <= h) onRango({ desde: d, hasta: h })
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-2', atenuado && 'opacity-50')} data-atenuado={atenuado || undefined}>
      <label htmlFor={`${id}-periodo`} className="text-[12px] text-azul-medio">Periodo:</label>
      <select id={`${id}-periodo`} value={periodo} className={CLASE}
        onChange={(e) => {
          const p = e.target.value as Periodo
          onPeriodo(p)
          if (p === 'rango') { setDesde(rango.desde); setHasta(rango.hasta) }
        }}>
        {OPCIONES.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
      {periodo === 'rango' && (
        <>
          <label htmlFor={`${id}-desde`} className="text-[12px] text-azul-medio">Desde:</label>
          <input id={`${id}-desde`} type="date" value={desde} onChange={(e) => cambiar(e.target.value, hasta)} className={CLASE} />
          <label htmlFor={`${id}-hasta`} className="text-[12px] text-azul-medio">Hasta:</label>
          <input id={`${id}-hasta`} type="date" value={hasta} onChange={(e) => cambiar(desde, e.target.value)} className={CLASE} />
        </>
      )}
    </div>
  )
}
