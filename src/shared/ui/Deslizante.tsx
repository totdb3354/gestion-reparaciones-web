import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** Lo que dura la entrada y la salida de un panel lateral (ms). */
export const MS_PANEL = 200

/** «Reducir movimiento» del sistema: sin animación, el panel aparece y desaparece al momento. */
export const sinMovimiento = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Mantiene montado un panel mientras sale. `valor` es lo que enseña (o `null` si está cerrado): al pasar a `null` devuelve todavía
 *  el último valor, con `saliendo` en verdadero, durante `ms`; después, `null`. Con «reducir movimiento» desmonta al momento. */
export function usePresencia<T>(valor: T | null, ms = MS_PANEL): { valor: T | null; saliendo: boolean } {
  const [ultimo, setUltimo] = useState<T | null>(valor)
  if (valor !== null && valor !== ultimo) setUltimo(valor)
  useEffect(() => {
    if (valor !== null || sinMovimiento()) return
    const t = setTimeout(() => setUltimo(null), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  // Con «reducir movimiento» no hay salida: al pasar a `null` se desmonta al momento.
  if (valor === null && sinMovimiento()) return { valor: null, saliendo: false }
  return { valor: valor ?? ultimo, saliendo: valor === null && ultimo !== null }
}

/** `true` cuando el panel debe estar abierto: empieza en `false` al montarse (para que el navegador anime hasta `true`) y vuelve a
 *  `false` en cuanto empieza a salir. Cambia tras un instante, forzando antes el cálculo de estilos para que la transición arranque. */
export function useAbierto(saliendo: boolean, ref: React.RefObject<HTMLElement | null>): boolean {
  const [dentro, setDentro] = useState(sinMovimiento())
  useEffect(() => {
    if (dentro) return
    const t = setTimeout(() => { void ref.current?.offsetWidth; setDentro(true) }, 20)
    return () => clearTimeout(t)
  }, [dentro, ref])
  return dentro && !saliendo
}

/** Hueco de un panel que acompaña a una tabla (en un `flex` en fila). El panel entra deslizándose POR ENCIMA del borde derecho de
 *  la tabla (solo `transform` y opacidad: no recoloca nada) y, cuando ha llegado, el hueco toma su ancho de golpe y la tabla se
 *  estrecha UNA vez, ya con el panel quieto. Al salir, se desliza fuera y la tabla recupera el ancho al desmontarse. Recolocar una
 *  tabla de miles de filas cuesta décimas de segundo: hacerlo durante la animación (o antes de ella) se veía como un tirón.
 *  `saliendo` lo da `usePresencia`. */
export function PanelDeslizante({ saliendo, children }: { saliendo: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const abierto = useAbierto(saliendo, ref)
  const [asentado, setAsentado] = useState(sinMovimiento())
  useEffect(() => {
    if (asentado || !abierto) return
    const t = setTimeout(() => setAsentado(true), MS_PANEL + 20)
    return () => clearTimeout(t)
  }, [asentado, abierto])
  return (
    <div data-asentado={asentado || undefined} className={cn('relative min-h-0 shrink-0', asentado ? 'ml-2.5 w-[min(380px,40vw)]' : 'ml-0 w-0')}>
      <div ref={ref} data-saliendo={saliendo || undefined}
        className={cn('absolute inset-y-0 right-0 z-[3] flex min-h-0 w-[min(380px,40vw)] transition-[transform,opacity] duration-200 ease-out will-change-transform motion-reduce:transition-none',
          abierto ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0')}>
        {children}
      </div>
    </div>
  )
}
