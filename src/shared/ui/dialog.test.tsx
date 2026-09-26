import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from './dialog'

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
