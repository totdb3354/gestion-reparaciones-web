import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectorLista } from './SelectorLista'

const OPCIONES = [{ clave: 'sin', etiqueta: '— Sin cliente —' }, { clave: '1', etiqueta: 'AMAZON' }, { clave: '2', etiqueta: 'CLIENTE A' }]

describe('SelectorLista (calco de SelectorClienteDialog)', () => {
  it('filtra, resalta el actual sin elegirlo, muestra "Nada seleccionado" o "Seleccionado: …" y deshabilita Seleccionar hasta elegir', async () => {
    const onSeleccionar = vi.fn()
    render(<SelectorLista abierto titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={OPCIONES} claveActual="1" textoNada="Nada seleccionado" textoSeleccionar="Seleccionar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />)
    const dlg = screen.getByRole('dialog', { name: 'Seleccionar cliente' })
    expect(within(dlg).getByText('Nada seleccionado')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Seleccionar' })).toBeDisabled()
    expect(within(dlg).getByRole('button', { name: 'AMAZON' })).toHaveClass('bg-seleccion-suave')
    expect(within(dlg).getByRole('option', { name: 'AMAZON' })).toHaveAttribute('aria-selected', 'false')
    await userEvent.type(within(dlg).getByPlaceholderText('Buscar cliente...'), 'cliente a')
    expect(within(dlg).queryByRole('button', { name: 'AMAZON' })).not.toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'CLIENTE A' }))
    expect(within(dlg).getByText('Seleccionado: CLIENTE A')).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
    expect(onSeleccionar).toHaveBeenCalledWith('2')
  })
  it('con preseleccionarActual abre con el actual elegido y el botón habilitado (selector "Editar modelo")', async () => {
    const onSeleccionar = vi.fn()
    render(<SelectorLista abierto preseleccionarActual titulo="Editar modelo" placeholderBuscar="Filtrar modelo…" opciones={OPCIONES} claveActual="1" textoNada="Nada seleccionado" textoSeleccionar="Guardar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />)
    const dlg = screen.getByRole('dialog', { name: 'Editar modelo' })
    expect(within(dlg).getByRole('option', { name: 'AMAZON' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dlg).getByRole('button', { name: 'AMAZON' })).toHaveClass('bg-azul-noche')
    expect(within(dlg).getByText('Seleccionado: AMAZON')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Guardar' })).toBeEnabled()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    expect(onSeleccionar).toHaveBeenLastCalledWith('1')
    await userEvent.click(within(dlg).getByRole('button', { name: 'CLIENTE A' }))
    expect(within(dlg).getByRole('button', { name: 'AMAZON' })).toHaveClass('bg-seleccion-suave')
    expect(within(dlg).getByText('Seleccionado: CLIENTE A')).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    expect(onSeleccionar).toHaveBeenLastCalledWith('2')
  })
  it('con preseleccionarActual y una clave actual que no está entre las opciones, abre sin selección', () => {
    render(<SelectorLista abierto preseleccionarActual titulo="Editar modelo" placeholderBuscar="Filtrar modelo…" opciones={OPCIONES} claveActual="99" textoNada="Nada seleccionado" textoSeleccionar="Guardar" onSeleccionar={() => {}} onCancelar={() => {}} />)
    const dlg = screen.getByRole('dialog', { name: 'Editar modelo' })
    within(dlg).getAllByRole('option').forEach((o) => expect(o).toHaveAttribute('aria-selected', 'false'))
    expect(within(dlg).getByText('Nada seleccionado')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
  it('Cancelar y la ✕ avisan', async () => {
    const onCancelar = vi.fn()
    render(<SelectorLista abierto titulo="Editar modelo" etiquetaLista="Selecciona el modelo:" placeholderBuscar="Filtrar modelo…" opciones={OPCIONES} textoSeleccionar="Guardar" onSeleccionar={() => {}} onCancelar={onCancelar} />)
    expect(screen.getByText('Selecciona el modelo:')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
  })
  it('el doble clic en una opción llama a onSeleccionar directamente con su clave', async () => {
    const onSeleccionar = vi.fn()
    render(<SelectorLista abierto titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={OPCIONES} textoSeleccionar="Seleccionar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />)
    const dlg = screen.getByRole('dialog', { name: 'Seleccionar cliente' })
    await userEvent.dblClick(within(dlg).getByRole('button', { name: 'CLIENTE A' }))
    expect(onSeleccionar).toHaveBeenCalledTimes(1)
    expect(onSeleccionar).toHaveBeenCalledWith('2')
  })
  it('cerrar y reabrir reinicia el buscador y la selección', async () => {
    const onSeleccionar = vi.fn()
    const { rerender } = render(
      <SelectorLista abierto titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={OPCIONES} textoSeleccionar="Seleccionar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />,
    )
    let dlg = screen.getByRole('dialog', { name: 'Seleccionar cliente' })
    await userEvent.type(within(dlg).getByPlaceholderText('Buscar cliente...'), 'cliente a')
    await userEvent.click(within(dlg).getByRole('button', { name: 'CLIENTE A' }))
    expect(within(dlg).getByRole('button', { name: 'Seleccionar' })).toBeEnabled()
    rerender(
      <SelectorLista abierto={false} titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={OPCIONES} textoSeleccionar="Seleccionar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />,
    )
    rerender(
      <SelectorLista abierto titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={OPCIONES} textoSeleccionar="Seleccionar" onSeleccionar={onSeleccionar} onCancelar={() => {}} />,
    )
    dlg = screen.getByRole('dialog', { name: 'Seleccionar cliente' })
    expect(within(dlg).getByPlaceholderText('Buscar cliente...')).toHaveValue('')
    within(dlg).getAllByRole('option').forEach((o) => expect(o).toHaveAttribute('aria-selected', 'false'))
    expect(within(dlg).getByRole('button', { name: 'Seleccionar' })).toBeDisabled()
  })
  it('con preseleccionarActual, reabrir vuelve a elegir el actual aunque antes se eligiera otro', async () => {
    const selector = (abierto: boolean) => (
      <SelectorLista abierto={abierto} preseleccionarActual titulo="Editar modelo" placeholderBuscar="Filtrar modelo…" opciones={OPCIONES} claveActual="1" textoSeleccionar="Guardar" onSeleccionar={() => {}} onCancelar={() => {}} />
    )
    const { rerender } = render(selector(true))
    let dlg = screen.getByRole('dialog', { name: 'Editar modelo' })
    await userEvent.type(within(dlg).getByPlaceholderText('Filtrar modelo…'), 'cliente a')
    await userEvent.click(within(dlg).getByRole('button', { name: 'CLIENTE A' }))
    expect(within(dlg).getByRole('option', { name: 'CLIENTE A' })).toHaveAttribute('aria-selected', 'true')
    rerender(selector(false))
    rerender(selector(true))
    dlg = screen.getByRole('dialog', { name: 'Editar modelo' })
    expect(within(dlg).getByPlaceholderText('Filtrar modelo…')).toHaveValue('')
    expect(within(dlg).getByRole('option', { name: 'AMAZON' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dlg).getByRole('option', { name: 'CLIENTE A' })).toHaveAttribute('aria-selected', 'false')
    expect(within(dlg).getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
})
