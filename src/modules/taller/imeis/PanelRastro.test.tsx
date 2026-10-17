import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { eventoRastro } from '../test/fabrica'
import { PanelRastro } from './PanelRastro'

const panel = (onCerrar = vi.fn()) => render(<PanelRastro imei="351900000000041" eventos={[eventoRastro()]} onCerrar={onCerrar} onIrATrabajo={() => {}} />)

describe('PanelRastro: Escape', () => {
  it('con solo el panel abierto, Escape lo cierra', async () => {
    const onCerrar = vi.fn()
    panel(onCerrar)
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('si hay otro dialogo abierto encima, Escape no cierra el rastro', async () => {
    const onCerrar = vi.fn()
    render(<div role="dialog" aria-label="Error">Fallo</div>)
    panel(onCerrar)
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('un Escape ya gestionado (defaultPrevented) no lo cierra', () => {
    const onCerrar = vi.fn()
    panel(onCerrar)
    window.addEventListener('keydown', (e) => e.preventDefault(), { capture: true, once: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Rastro' })).toBeInTheDocument()
  })
})
