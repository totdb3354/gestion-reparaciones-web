import { useLayoutEffect, type RefObject } from 'react'
import { estiloAnclado, huecoVentana, type Ancla } from '@/shared/lib/anclaPanel'

const px = (v: number | undefined) => (v === undefined ? '' : `${v}px`)

/** Pinta la caja `fixed` según el ancla, recortada a la ventana (spec 0.9.20 §2). Se repite en cada render (el alto cambia
 *  con los datos) y al cambiar el tamaño de la ventana. Durante un arrastre (`data-arrastrando`) no la toca: manda el
 *  puntero. */
export function useColocarAnclado(cajaRef: RefObject<HTMLElement | null>, ancla: Ancla) {
  useLayoutEffect(() => {
    function colocar() {
      const caja = cajaRef.current
      if (!caja || caja.dataset.arrastrando !== undefined) return
      const e = estiloAnclado(ancla, caja.offsetWidth, caja.offsetHeight, huecoVentana())
      caja.style.left = px(e.left)
      caja.style.right = px(e.right)
      caja.style.top = px(e.top)
      caja.style.bottom = px(e.bottom)
    }
    colocar()
    window.addEventListener('resize', colocar)
    return () => window.removeEventListener('resize', colocar)
  })
}
