import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { tecnico } from '../test/fabrica'
import { BarraFiltros } from './BarraFiltros'
import { FILTROS_VACIOS, SIN_CLIENTE, type EstadoFiltros } from './filtros'

const TECNICOS = [tecnico({ idTec: 4, nombre: 'Técnico A' }), tecnico({ idTec: 5, nombre: 'Técnico B' })]
const CLIENTES = [SIN_CLIENTE, 'CLIENTE A', 'CLIENTE B']

/** La barra es controlada: el harness guarda el estado, como hace la página, y espía cada cambio. */
function Barra({
  inicial = FILTROS_VACIOS,
  onCambio = vi.fn(),
  onInteraccion = vi.fn(),
  clientes = CLIENTES,
}: {
  inicial?: EstadoFiltros
  onCambio?: (f: EstadoFiltros) => void
  onInteraccion?: (abierta: boolean) => void
  clientes?: string[]
}) {
  const [f, setF] = useState(inicial)
  return (
    <BarraFiltros
      valor={f}
      onCambio={(nuevo) => {
        setF(nuevo)
        onCambio(nuevo)
      }}
      tecnicos={TECNICOS}
      clientes={clientes}
      onInteraccion={onInteraccion}
    />
  )
}

describe('BarraFiltros', () => {
  it('el IMEI incompleto se marca en rojo y sigue llegando al filtro', async () => {
    const onCambio = vi.fn()
    render(<Barra onCambio={onCambio} />)
    const campo = screen.getByRole('textbox', { name: 'Filtrar por IMEI' })
    await userEvent.type(campo, '00000')
    // El borde rojo es el aviso de "token incompleto" del JavaFX; aplicarFiltros ignora ese texto (imeisValidos
    // solo se queda con los tokens de 15 dígitos), así que la tabla no se vacía mientras se teclea.
    expect(campo).toHaveClass('border-fila-incidencia-brd')
    expect(onCambio).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, imei: '00000' })
  })

  it('al completar 15 dígitos se añade una coma', async () => {
    const onCambio = vi.fn()
    render(<Barra onCambio={onCambio} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Filtrar por IMEI' }), '000000000000001')
    expect(onCambio).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, imei: '000000000000001, ' })
  })

  it('el desplegable de cliente arranca con todos marcados y dice Todos', async () => {
    render(<Barra />)
    const boton = screen.getByRole('button', { name: 'Todos' })
    await userEvent.click(boton)
    for (const c of CLIENTES) expect(screen.getByRole('checkbox', { name: c })).toBeChecked()
  })

  it('desmarcar un cliente deja el resto marcados y filtra por ellos', async () => {
    const onCambio = vi.fn()
    render(<Barra onCambio={onCambio} />)
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'CLIENTE B' }))
    expect(onCambio).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, clientes: [SIN_CLIENTE, 'CLIENTE A'] })
    expect(screen.getByRole('checkbox', { name: 'CLIENTE B' })).not.toBeChecked()
  })

  it('Limpiar filtros resetea los cinco', async () => {
    const onCambio = vi.fn()
    const inicial: EstadoFiltros = {
      imei: '000000000000001, ',
      tecnicos: [4],
      clientes: ['CLIENTE A'],
      tipos: ['GLASS'],
      estados: ['INCIDENCIA'],
    }
    render(<Barra inicial={inicial} onCambio={onCambio} />)
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(onCambio).toHaveBeenLastCalledWith(FILTROS_VACIOS)
    // Y la barra vuelve a su aspecto de reposo: técnico sin selección y cliente otra vez con todos marcados.
    expect(screen.getByRole('button', { name: 'Técnico' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Filtrar por IMEI' })).toHaveValue('')
  })

  it('abrir un desplegable avisa de interacción abierta', async () => {
    const onInteraccion = vi.fn()
    render(<Barra onInteraccion={onInteraccion} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tipo' }))
    expect(onInteraccion).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard('{Escape}')
    expect(onInteraccion).toHaveBeenLastCalledWith(false)
  })

  it('los cuatro desplegables avisan de la interacción', async () => {
    const onInteraccion = vi.fn()
    render(<Barra onInteraccion={onInteraccion} />)
    for (const nombre of ['Técnico', 'Todos', 'Tipo', 'Estado']) {
      onInteraccion.mockClear()
      await userEvent.click(screen.getByRole('button', { name: nombre }))
      expect(onInteraccion, nombre).toHaveBeenCalledWith(true)
      await userEvent.keyboard('{Escape}')
      expect(onInteraccion, nombre).toHaveBeenLastCalledWith(false)
    }
  })
})
