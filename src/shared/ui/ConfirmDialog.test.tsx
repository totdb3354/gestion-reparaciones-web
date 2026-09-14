import { render, screen } from '@testing-library/react'
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
})
