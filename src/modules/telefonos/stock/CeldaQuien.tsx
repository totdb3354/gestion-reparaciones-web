import { Fragment } from 'react'
import { cn } from '@/shared/lib/utils'
import type { Quien } from './quien'

/** La celda «Quién lo tiene» (spec 0.9.18 §4.7): la única de la tabla que puede partirse en dos líneas. El detalle (desde
 *  cuándo y la llegada a la glass), al pasar el ratón. Su texto es el mismo que `quien.texto`. */
export function CeldaQuien({ quien }: { quien: Quien }) {
  const titulo = quien.titulo || undefined
  if (quien.descuadre) return <span title={titulo} className="font-bold whitespace-normal text-fila-urgente-brd">{quien.texto}</span>
  if (quien.enCaja) return <span title={titulo} className="font-bold whitespace-normal text-fila-solicitud-brd">{quien.texto}</span>
  if (quien.partes.length === 0) return <span className="text-texto-suave">—</span>
  return (
    <span title={titulo} className="whitespace-normal">
      {quien.partes.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {p.prefijo && <span className="text-azul-gris">{`${p.prefijo} `}</span>}
          <b className="text-azul-noche">{p.tecnico}</b>
          {p.sufijo && <span className="text-azul-gris">{` ${p.sufijo}`}</span>}
          {p.entrega && (
            <>
              {' '}
              <span className={cn('rounded px-1 text-[10.5px] font-bold', p.entrega.llego ? 'bg-tipo-reparacion-bg text-tipo-reparacion-text' : 'bg-fila-solicitud-bg text-fila-solicitud-brd')}>
                {p.entrega.texto}
              </span>
            </>
          )}
        </Fragment>
      ))}
    </span>
  )
}
