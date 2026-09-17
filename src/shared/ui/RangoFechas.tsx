import { useId } from 'react'

type Props = { desde: string; hasta: string; onChange: (desde: string, hasta: string) => void }

const CLASE = 'h-10 w-[130px] rounded-3xl border border-azul-noche bg-superficie px-3 text-[12px] text-azul-medio'

/** Calco de "Desde:" / "Hasta:" con DatePicker: valores 'yyyy-MM-dd' o '' (sin filtro). */
export function RangoFechas({ desde, hasta, onChange }: Props) {
  const id = useId()
  return (
    <>
      <label htmlFor={`${id}-desde`} className="text-[12px] text-azul-medio">Desde:</label>
      <input id={`${id}-desde`} type="date" value={desde} onChange={(e) => onChange(e.target.value, hasta)} className={CLASE} />
      <label htmlFor={`${id}-hasta`} className="text-[12px] text-azul-medio">Hasta:</label>
      <input id={`${id}-hasta`} type="date" value={hasta} onChange={(e) => onChange(desde, e.target.value)} className={CLASE} />
    </>
  )
}
