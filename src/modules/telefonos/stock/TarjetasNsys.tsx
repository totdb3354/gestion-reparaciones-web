import type { ReactNode } from 'react'
import type { TarjetasPorPasar } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { cuentas, EXPLICACION, NOMBRE, palabraMoviles, TARJETAS, textoHechos, type Tarjeta } from './porPasar'

/** El borde de arriba de cada tarjeta (prototipo «plantillas NSYS», diseño C): morado, azul, rojo y ámbar. */
const BORDE: Record<Tarjeta, string> = {
  color: 'border-t-taller', grado: 'border-t-tipo-reparacion-text', altas: 'border-t-fila-urgente-brd', revisar: 'border-t-ambar',
}

type Props = { tarjetas: TarjetasPorPasar; elegida: Tarjeta; onElegir: (t: Tarjeta) => void; boton: (t: Tarjeta) => ReactNode }

/** Las cuatro tarjetas de «Por pasar a NSYS» (spec 0.9.22 §3.1): su nombre (que la elige), su número («3 móviles · 1 hecho»), qué se
 *  hace y su botón. Pulsar en la tarjeta también la elige. */
export function TarjetasNsys({ tarjetas, elegida, onElegir, boton }: Props) {
  return (
    <div className="grid shrink-0 grid-cols-4 gap-2.5">
      {TARJETAS.map((t) => {
        const c = cuentas(tarjetas, t)
        return (
          <article key={t} aria-label={NOMBRE[t]} onClick={() => onElegir(t)}
            className={cn('flex cursor-pointer flex-col gap-1.5 rounded-lg border-[1.5px] border-t-4 bg-superficie px-3 py-2.5', BORDE[t],
              elegida === t ? 'border-x-azul-noche border-b-azul-noche shadow-[0_0_0_2px_rgba(7,26,58,0.12)]' : 'border-x-fila-sep border-b-fila-sep hover:border-x-borde-input hover:border-b-borde-input')}>
            <button type="button" aria-pressed={elegida === t} onClick={() => onElegir(t)}
              className="cursor-pointer self-start text-left text-[13px] font-bold text-azul-medio">{NOMBRE[t]}</button>
            <p className="text-[26px] leading-none font-extrabold text-azul-noche">
              {c.total}{' '}<small className="text-[12px] font-semibold text-azul-gris">{`${palabraMoviles(c.total)}${textoHechos(c.hechos)}`}</small>
            </p>
            <p className="min-h-[46px] text-[11.5px] leading-snug text-azul-gris">{EXPLICACION[t]}</p>
            <div className="flex flex-wrap items-center gap-1.5">{boton(t)}</div>
          </article>
        )
      })}
    </div>
  )
}
