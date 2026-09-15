import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog (calco de ConfirmDialog.mostrar)', () => {
  it('muestra título, descripción y botones; confirma y cancela', async () => {
    const ok = vi.fn()
    const no = vi.fn()
    render(
      <ConfirmDialog abierto titulo="Borrar cliente" descripcion='¿Seguro que quieres borrar el cliente "WEB"? Esta acción no se puede deshacer.' textoAccion="Borrar" onConfirmar={ok} onCancelar={no} />,
    )
    expect(screen.getByRole('dialog', { name: 'Borrar cliente' })).toBeInTheDocument()
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(no).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('título rojo y botones apilados a ancho completo, con la acción encima de Cancelar', () => {
    render(<ConfirmDialog abierto titulo="Borrar cliente" descripcion="¿Seguro?" textoAccion="Borrar" onConfirmar={vi.fn()} onCancelar={vi.fn()} />)
    const dlg = screen.getByRole('dialog', { name: 'Borrar cliente' })
    expect(within(dlg).getByText('Borrar cliente')).toHaveClass('text-[18px]', 'font-bold', 'text-texto-error')
    expect(within(dlg).getByText('¿Seguro?')).toHaveClass('text-[13px]', 'text-azul-medio')
    const accion = within(dlg).getByRole('button', { name: 'Borrar' })
    const cancelar = within(dlg).getByRole('button', { name: 'Cancelar' })
    expect(accion).toHaveClass('w-full', 'bg-rojo-accion', 'text-crema')
    expect(cancelar).toHaveClass('w-full', 'border-azul-gris', 'bg-crema', 'text-azul-gris')
    // el JavaFX apila acción y luego Cancelar: el orden del DOM es el orden visual y el de tabulación
    expect(accion.compareDocumentPosition(cancelar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
