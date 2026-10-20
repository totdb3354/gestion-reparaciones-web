import { useRef, type MouseEvent as EventoRaton, type PointerEvent as EventoPuntero, type RefObject } from 'react'
import { anclaAlSoltar, dentroDelHueco, huecoVentana, type Ancla } from '@/shared/lib/anclaPanel'

/** Por debajo de este movimiento (px) no es un arrastre: es un clic. */
export const UMBRAL_ARRASTRE_PX = 4

type EnCurso = { id: number; x0: number; y0: number; dx: number; dy: number; ancho: number; alto: number; izq: number; arriba: number; movido: boolean }

/**
 * Arrastre con pointer events (spec 0.9.20 §2, «Posición»). Los manejadores van en el asa (la cabecera del panel o la
 * pastilla entera) y mueven `cajaRef`, que es `fixed`.
 * - Mientras se mueve, la caja se pinta con `left/top`, sin salir de la ventana ni meterse bajo la barra azul, y lleva
 *   `data-arrastrando` (useColocarAnclado no la toca entonces).
 * - Al soltar, `onSoltar` recibe el ancla (esquina más cercana + distancias); colocarla según el ancla es cosa de
 *   useColocarAnclado.
 * - Un elemento con `data-no-arrastre` (los botones de la cabecera, la × de la pastilla) no empieza arrastre.
 * - Si hubo arrastre, el clic que el navegador manda al soltar se anula (`onClickCapture`): soltar la pastilla no la abre.
 */
export function useArrastre(cajaRef: RefObject<HTMLElement | null>, onSoltar: (ancla: Ancla) => void) {
  const enCurso = useRef<EnCurso | null>(null)
  const anularClic = useRef(false)

  function onPointerDown(e: EventoPuntero<HTMLElement>) {
    if (e.button !== 0) return
    if (e.target instanceof Element && e.target.closest('[data-no-arrastre]')) return
    const caja = cajaRef.current
    if (!caja) return
    const r = caja.getBoundingClientRect()
    enCurso.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top,
      ancho: r.width, alto: r.height, izq: r.left, arriba: r.top, movido: false,
    }
    anularClic.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: EventoPuntero<HTMLElement>) {
    const a = enCurso.current
    const caja = cajaRef.current
    if (!a || !caja || e.pointerId !== a.id) return
    if (!a.movido && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < UMBRAL_ARRASTRE_PX) return
    a.movido = true
    caja.dataset.arrastrando = ''
    const p = dentroDelHueco(e.clientX - a.dx, e.clientY - a.dy, a.ancho, a.alto, huecoVentana())
    a.izq = p.izq
    a.arriba = p.arriba
    caja.style.left = `${p.izq}px`
    caja.style.top = `${p.arriba}px`
    caja.style.right = ''
    caja.style.bottom = ''
  }

  function terminar(e: EventoPuntero<HTMLElement>) {
    const a = enCurso.current
    if (!a || e.pointerId !== a.id) return
    enCurso.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!a.movido) return
    if (cajaRef.current) delete cajaRef.current.dataset.arrastrando
    anularClic.current = true
    onSoltar(anclaAlSoltar({ izq: a.izq, arriba: a.arriba, ancho: a.ancho, alto: a.alto }, huecoVentana()))
  }

  function onClickCapture(e: EventoRaton<HTMLElement>) {
    if (!anularClic.current) return
    anularClic.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return { onPointerDown, onPointerMove, onPointerUp: terminar, onPointerCancel: terminar, onClickCapture }
}
