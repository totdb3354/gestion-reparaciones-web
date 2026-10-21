import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type Props = { nsys: string | null | undefined; enLinea?: boolean; children: ReactNode }

/** Lo del taller por encima de NSYS (0.9.21, spec «SKU del taller» §2.4; variante «"NSYS: Azul" debajo» del prototipo): el
 *  valor que vale con la marca «taller» y, debajo, en pequeño y gris, «NSYS: <valor>». Sin `nsys` (null: el taller no lo
 *  cambia), el valor tal cual, como antes. `enLinea`: «NSYS: …» a la derecha (la ficha del IMEI y el buscador). */
export function MarcaTaller({ nsys, enLinea = false, children }: Props) {
  if (nsys == null) return <>{children}</>
  return (
    <span className={enLinea ? undefined : 'inline-block align-top leading-tight'}>
      {children}{' '}
      <span className="rounded bg-taller px-1 align-[1px] text-[10px] leading-[15px] font-bold text-superficie">taller</span>
      {enLinea && ' '}
      <span title={`NSYS: ${nsys}`} className={cn('text-[11px] font-normal text-azul-gris', !enLinea && 'block')}>{`NSYS: ${nsys}`}</span>
    </span>
  )
}
