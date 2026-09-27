import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Retardo antes de mostrar la capa: una carga más rápida no llega a pintarla (sin parpadeo). Al ocultarse no hay retardo. */
export const RETARDO_CAPA_MS = 200

/** Eventos que la capa intercepta mientras se ve. La capa ya tapa la pantalla, pero Radix pone `pointer-events: none` en el
 *  body con un diálogo modal abierto y escucha los clics "fuera" en el document (cerraría el diálogo); y el foco puede
 *  seguir en un campo de debajo. Cortarlos en la fase de captura de `window` los para antes que a cualquier otro. */
const EVENTOS_BLOQUEADOS = ['keydown', 'keypress', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'] as const

function bloquear(ev: Event) {
  ev.preventDefault()
  ev.stopPropagation()
}

/**
 * Overlay de carga (diferencia deliberada con el JavaFX, que no tiene indicador; decisión del usuario 2026-09-27, web 0.8.3):
 * capa fija a pantalla completa por encima de los diálogos (z-60 > z-50 de Radix), fondo de la vista al 60 % y un spinner
 * navy centrado. `activa` la decide quien la monta (el shell); aquí solo el retardo y el bloqueo de clics y teclas.
 * Va en un portal al body, como los diálogos: un diálogo modal abierto marca `aria-hidden` el resto de la app y la capa
 * quedaría oculta a los lectores de pantalla si colgara de ella.
 */
export function CapaCarga({ activa }: { activa: boolean }) {
  const [cumplido, setCumplido] = useState(false)

  useEffect(() => {
    if (!activa) return
    const t = setTimeout(() => setCumplido(true), RETARDO_CAPA_MS)
    return () => {
      clearTimeout(t)
      setCumplido(false)
    }
  }, [activa])

  // `activa &&`: al caer la condición se oculta en ese mismo render, sin esperar al efecto.
  const visible = activa && cumplido

  useEffect(() => {
    if (!visible) return
    for (const tipo of EVENTOS_BLOQUEADOS) window.addEventListener(tipo, bloquear, true)
    return () => {
      for (const tipo of EVENTOS_BLOQUEADOS) window.removeEventListener(tipo, bloquear, true)
    }
  }, [visible])

  if (!visible) return null
  return createPortal(
    <div role="status" data-testid="capa-carga" className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-fondo-vista/60">
      <Loader2 aria-hidden="true" className="size-10 animate-spin text-azul-medio" />
      <span className="sr-only">Cargando…</span>
    </div>,
    document.body,
  )
}
