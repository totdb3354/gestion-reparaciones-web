import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/** Rueda o arrastre táctil nativos sobre un elemento; devuelve si alguien canceló el desplazamiento. */
function desplazar(el: HTMLElement, tipo: 'wheel' | 'touchmove'): boolean {
  const evento = tipo === 'wheel'
    ? new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    : new Event('touchmove', { bubbles: true, cancelable: true })
  el.dispatchEvent(evento)
  return evento.defaultPrevented
}

describe('PopoverContent', () => {
  // Un desplegable dentro de un modal se pinta en un portal (fuera del DOM del modal) pero sigue en su árbol de React:
  // el bloqueo de scroll del modal (react-remove-scroll) veía la rueda y la cancelaba, y la lista no se movía con la
  // rueda ni, en Mac (barra que se oculta), de ninguna forma.
  it('dentro de un modal, la rueda y el arrastre táctil sobre el desplegable no se cancelan', () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Ventana</DialogTitle>
          <Popover open>
            <PopoverTrigger>Abrir</PopoverTrigger>
            <PopoverContent><ul aria-label="lista">{Array.from({ length: 30 }, (_, i) => <li key={i}>opción {i}</li>)}</ul></PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    )
    const lista = screen.getByRole('list', { name: 'lista' })
    expect(desplazar(lista, 'wheel')).toBe(false)
    expect(desplazar(lista, 'touchmove')).toBe(false)
  })
})
