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

describe('PanelRastro: revisado (spec 0.9.18 §5.3)', () => {
  it('el evento de revisión lleva su marca y la leyenda la explica', () => {
    render(<PanelRastro imei="351900000000041" eventos={[eventoRastro({ de: 'En revisión', a: 'Listos', revision: 'ENTRADA' }), eventoRastro()]}
      onCerrar={() => {}} onIrATrabajo={() => {}} />)
    expect(screen.getByText('Revisado → Listos')).toBeInTheDocument()
    expect(screen.getAllByTestId('marca-revision')).toHaveLength(2)
    expect(screen.getByText('Revisado')).toBeInTheDocument()
  })
})

describe('PanelRastro: lo del taller (spec 0.9.21 §2.4)', () => {
  it('el cambio del taller sale con su fuente y la leyenda lo explica', () => {
    render(<PanelRastro imei="351900000000041" eventos={[eventoRastro({ fuente: 'TALLER', tipo: 'TALLER_CAMBIO', lote: null, aNsys: null,
      dato: 'GRADO', de: 'B', a: 'A100', tecnico: 'Supertécnico 1', origen: 'MANO', motivo: 'batería' })]} onCerrar={() => {}} onIrATrabajo={() => {}} />)
    expect(screen.getByText('Taller: grado B → A100 (a mano · Supertécnico 1 · «batería»)')).toBeInTheDocument()
    expect(screen.getByText('TALLER')).toHaveClass('bg-taller-bg')
    expect(screen.getByText('Lo del taller')).toBeInTheDocument()
  })
})
