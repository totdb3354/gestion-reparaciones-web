import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextoExpandible } from './TextoExpandible'

describe('TextoExpandible (calco de labelExpandible + ConfirmDialog.mostrarTexto)', () => {
  it('con texto abre el popup con el texto completo y "Copiar" copia y cierra', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: escribir } })
    render(<TextoExpandible titulo="Observaciones" texto="maquina laser" />)
    await userEvent.click(screen.getByRole('button', { name: 'maquina laser' }))
    const dlg = screen.getByRole('dialog', { name: 'Observaciones' })
    expect(dlg.querySelector('textarea')).toHaveValue('maquina laser')
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(escribir).toHaveBeenCalledWith('maquina laser')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('sin texto no pinta nada', () => {
    const { container } = render(<TextoExpandible titulo="Observaciones" texto={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
