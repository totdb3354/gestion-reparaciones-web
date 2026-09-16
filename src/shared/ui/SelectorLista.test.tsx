import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectorLista } from './SelectorLista'

const OPCIONES = [{ clave: 'sin', etiqueta: '— Sin cliente —' }, { clave: '1', etiqueta: 'AMAZON' }, { clave: '2', etiqueta: 'CLIENTE A' }]

describe('SelectorLista (calco de SelectorClienteDialog)', () => {
  it('filtra, resalta el actual, muestra "Nada seleccionado" y deshabilita Seleccionar hasta elegir', async () => {
    const onSeleccionar = vi.fn()
    render(<SelectorLista abierto titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={OPCIONES} claveActual="1" textoNada="Nada seleccionado" textoSeleccionar="Seleccionar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />)
    const dlg = screen.getByRole('dialog', { name: 'Seleccionar cliente' })
    expect(within(dlg).getByText('Nada seleccionado')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Seleccionar' })).toBeDisabled()
    expect(within(dlg).getByRole('button', { name: 'AMAZON' })).toHaveClass('bg-seleccion-suave')
    await userEvent.type(within(dlg).getByPlaceholderText('Buscar cliente...'), 'cliente a')
    expect(within(dlg).queryByRole('button', { name: 'AMAZON' })).not.toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'CLIENTE A' }))
    expect(within(dlg).getByText('CLIENTE A', { selector: 'p' })).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
    expect(onSeleccionar).toHaveBeenCalledWith('2')
  })
  it('Cancelar y la ✕ avisan', async () => {
    const onCancelar = vi.fn()
    render(<SelectorLista abierto titulo="Editar modelo" etiquetaLista="Selecciona el modelo:" placeholderBuscar="Filtrar modelo…" opciones={OPCIONES} textoSeleccionar="Guardar" onSeleccionar={() => {}} onCancelar={onCancelar} />)
    expect(screen.getByText('Selecciona el modelo:')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
  })
})
