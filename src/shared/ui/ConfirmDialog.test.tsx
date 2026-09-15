import { render, screen, waitFor, within } from '@testing-library/react'
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
    // clases que sostienen el calco: sin ellas el diálogo vuelve a los valores de DialogContent/DialogFooter
    // el min() deja el margen de 2rem en móvil; el sm: es lo único que hace que tailwind-merge descarte el
    // sm:max-w-lg de DialogContent, que si no ganaría por orden de cascada a partir de 640 px
    expect(dlg).toHaveClass('max-w-[min(400px,calc(100%-2rem))]', 'sm:max-w-[min(400px,calc(100%-2rem))]')
    expect(dlg).not.toHaveClass('sm:max-w-lg')
    // sin sm:flex-col el footer pasaría a fila a partir de 640 px
    expect(accion.parentElement).toHaveClass('flex-col', 'sm:flex-col')
    // sin h-auto el h-9 del Button fijaría la altura y el py-2.5 (padding 10 del JavaFX) no pintaría nada
    expect(accion).toHaveClass('h-auto', 'py-2.5')
    expect(cancelar).toHaveClass('h-auto', 'py-2.5')
  })

  it('al abrirse el foco va a Cancelar, no al botón destructivo', async () => {
    render(<ConfirmDialog abierto titulo="Borrar cliente" descripcion="¿Seguro?" textoAccion="Borrar" onConfirmar={vi.fn()} onCancelar={vi.fn()} />)
    const dlg = screen.getByRole('dialog', { name: 'Borrar cliente' })
    const accion = within(dlg).getByRole('button', { name: 'Borrar' })
    const cancelar = within(dlg).getByRole('button', { name: 'Cancelar' })
    // la acción va primero en el DOM (orden visual del JavaFX), así que el autofocus de Radix caería en
    // ella y un Enter despistado borraría: el foco inicial se lleva a Cancelar a mano
    expect(accion.compareDocumentPosition(cancelar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(cancelar).toHaveFocus())
  })
})
