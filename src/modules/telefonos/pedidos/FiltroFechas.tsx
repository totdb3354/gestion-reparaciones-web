import { useId, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { rangoValido, type Periodo } from './filas'

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
  // Los campos enseñan lo aplicado (`rango`); el borrador solo existe mientras lo tecleado está incompleto o al revés, y vale solo
  // para el periodo y el rango con los que se tecleó: si cambian, se descarta.
  const base = `${periodo}|${rango.desde}|${rango.hasta}`
  const [borrador, setBorrador] = useState<{ desde: string; hasta: string; base: string } | null>(null)
  const enseñado = borrador?.base === base ? borrador : rango
  const cambiar = (d: string, h: string) => {
    if (rangoValido({ desde: d, hasta: h })) { setBorrador(null); onRango({ desde: d, hasta: h }) }
    else setBorrador({ desde: d, hasta: h, base })
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-2', atenuado && 'opacity-50')} data-atenuado={atenuado || undefined}>
      <label htmlFor={`${id}-periodo`} className="text-[12px] text-azul-medio">Periodo:</label>
      <select id={`${id}-periodo`} value={periodo} className={CLASE}
        onChange={(e) => onPeriodo(e.target.value as Periodo)}>
        {OPCIONES.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
      {periodo === 'rango' && (
        <>
          <label htmlFor={`${id}-desde`} className="text-[12px] text-azul-medio">Desde:</label>
          <input id={`${id}-desde`} type="date" value={enseñado.desde} onChange={(e) => cambiar(e.target.value, enseñado.hasta)} className={CLASE} />
          <label htmlFor={`${id}-hasta`} className="text-[12px] text-azul-medio">Hasta:</label>
          <input id={`${id}-hasta`} type="date" value={enseñado.hasta} onChange={(e) => cambiar(enseñado.desde, e.target.value)} className={CLASE} />
        </>
      )}
    </div>
  )
}
