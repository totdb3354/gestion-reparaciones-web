import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ATRIBUTO_ENCIMA_DE_VENTANAS, Dialog, DialogContent, DialogTitle } from './dialog'

describe('DialogContent', () => {
  it('el ancho declarado manda: no trae el sm:max-w-lg (512 px) que lo pisaba en la cascada', () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined} className="max-w-[680px]">
          <DialogTitle>Ventana</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    const dlg = screen.getByRole('dialog', { name: 'Ventana' })
    expect(dlg).toHaveClass('max-w-[680px]')
    expect(dlg).not.toHaveClass('sm:max-w-lg')
    // tailwind-merge descarta el tope base por colisión con el declarado
    expect(dlg).not.toHaveClass('max-w-[calc(100%-2rem)]')
  })
  it('sin ancho declarado conserva el margen de 2rem del base', () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Ventana</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    const dlg = screen.getByRole('dialog', { name: 'Ventana' })
    expect(dlg).toHaveClass('max-w-[calc(100%-2rem)]')
    expect(dlg).not.toHaveClass('sm:max-w-lg')
  })
})

describe('DialogContent: lo que flota por encima de la ventana', () => {
  // Radix registra su escucha de pointerdown con un setTimeout(0) al abrir: hay que dejar pasar un tick. Y esta versión da por
  // «fuera» el pulsado completo (pointerdown + click), así que se pulsa con user-event en vez de disparar solo el pointerdown.
  const tick = () => act(() => new Promise<void>((r) => setTimeout(r, 0)))
  function montar(onInteractOutside?: (e: Event) => void) {
    const onOpenChange = vi.fn()
    render(
      <>
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent aria-describedby={undefined} onInteractOutside={onInteractOutside}>
            <DialogTitle>Ventana</DialogTitle>
          </DialogContent>
        </Dialog>
        <div {...{ [ATRIBUTO_ENCIMA_DE_VENTANAS]: '' }} style={{ pointerEvents: 'auto' }}>
          <button type="button">Marcado</button>
        </div>
        <button type="button" style={{ pointerEvents: 'auto' }}>
          Sin marca
        </button>
      </>,
    )
    return onOpenChange
  }

  it('tocar lo marcado no cierra la ventana; tocar otra cosa de fuera sí', async () => {
    const onOpenChange = montar()
    await tick()
    await userEvent.click(screen.getByRole('button', { name: 'Marcado', hidden: true }))
    expect(onOpenChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Sin marca', hidden: true }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('el onInteractOutside del consumidor también se llama al tocar lo marcado, y la ventana sigue', async () => {
    const propio = vi.fn()
    const onOpenChange = montar(propio)
    await tick()
    await userEvent.click(screen.getByRole('button', { name: 'Marcado', hidden: true }))
    expect(propio).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
