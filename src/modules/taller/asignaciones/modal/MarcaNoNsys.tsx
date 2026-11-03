import { textoAyudaNoNsys, textoLineaNoNsys } from './textoNsys'

type Props = { ultimoItems?: string | null }

/** 0.9.23 (spec 2026-11-03 §2.2): el IMEI no está en NSYS, en la segunda línea de la fila de la cola. Solo informa. */
export function MarcaNoNsys({ ultimoItems }: Props) {
  return (
    <span title={textoAyudaNoNsys(ultimoItems)} className="shrink-0 whitespace-nowrap text-[10.5px] font-semibold text-texto-error">
      no está en NSYS
    </span>
  )
}

/** 0.9.23: la misma indicación en el detalle, justo bajo «IMEI en curso», con la hora del último Items. */
export function LineaNoNsys({ ultimoItems }: Props) {
  return <span title={textoAyudaNoNsys(ultimoItems)} className="-mt-1 text-[11px] text-texto-error">{textoLineaNoNsys(ultimoItems)}</span>
}
