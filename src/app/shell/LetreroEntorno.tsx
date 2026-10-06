import { useEffect } from 'react'
import { conEntorno, esPreproduccion } from '@/shared/lib/entorno'

export const TEXTO_LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

/** Aviso de preprod: una línea amarilla en el borde superior y una etiqueta centrada, en todas las pantallas (también la
 *  de entrada). Es fijo, va por encima de todo (también de la capa de carga, z-60) y no recibe clics ni ocupa sitio: la
 *  maqueta es la misma que en producción. Además pone "[PRE] " delante del título de la pestaña. En cualquier otro
 *  entorno no pinta nada ni toca el título. */
export function LetreroEntorno() {
  const pre = esPreproduccion()
  useEffect(() => {
    if (pre) document.title = conEntorno(document.title)
  }, [pre])
  if (!pre) return null
  return (
    <div
      role="note"
      aria-label="Entorno de preproducción"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-amarillo" />
      <span className="rounded-b-md bg-amarillo px-3 py-0.5 text-[11px] font-bold tracking-wide text-azul-noche shadow">
        {TEXTO_LETRERO_PRE}
      </span>
    </div>
  )
}
