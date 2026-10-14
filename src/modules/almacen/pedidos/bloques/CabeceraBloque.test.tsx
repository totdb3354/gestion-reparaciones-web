import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatearImporte } from '@/shared/lib/importes'
import { CabeceraBloque } from './CabeceraBloque'
import { lineaDePrueba as l } from './datosPrueba'
import { agruparEnBloques } from './reglas'

const NOTA = { notaBloque: 'Ped. 123' }
const bloque = (...lineas: ReturnType<typeof l>[]) => [...agruparEnBloques(lineas).values()][0]

describe('CabeceraBloque (spec §6.3)', () => {
  it('número, proveedor, fecha, líneas, total, ⚠, chips del resumen y nota', () => {
    const b = bloque(l({ idCompra: 1, ...NOTA }), l({ idCompra: 2, estado: 'en_camino', esUrgente: true, ...NOTA }), l({ idCompra: 3, estado: 'en_camino', ...NOTA }))
    render(<CabeceraBloque bloque={b} visibles={3} desplegado onAlternar={vi.fn()} />)
    const titulo = screen.getByText('Bloque 41').closest('button') as HTMLElement
    expect(titulo).toHaveTextContent('Bloque 41·Proveedor A·09/10/2026·3 líneas·')
    expect(screen.getByText(formatearImporte(60, '€'))).toBeInTheDocument()
    expect(screen.getByText('⚠')).toBeInTheDocument()
    expect(screen.getByText('1 pendiente')).toBeInTheDocument()
    // En camino, azul aunque una sea urgente: el aviso va en el ⚠ (0.9.9).
    expect(screen.getByText('2 en camino')).toHaveClass('bg-badge-en-camino-bg', 'text-badge-en-camino-text')
    const nota = screen.getByTitle('Ped. 123')
    expect(nota).toHaveTextContent('Ped. 123')
    expect(nota).not.toHaveTextContent('📝')
    expect(nota.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByText(/sin precio/)).not.toBeInTheDocument()
    expect(screen.queryByText(/mostrando/)).not.toBeInTheDocument()
    expect(screen.queryByText('antiguo')).not.toBeInTheDocument()
  })

  it('«mostrando k de n» con filtros y etiqueta «antiguo» en un bloque reconstruido', () => {
    const b = bloque(l({ idCompra: 1, bloqueAntiguo: true }), l({ idCompra: 2, bloqueAntiguo: true }))
    render(<CabeceraBloque bloque={b} visibles={1} desplegado onAlternar={vi.fn()} />)
    expect(screen.getByText('mostrando 1 de 2')).toBeInTheDocument()
    expect(screen.getByText('antiguo')).toHaveAttribute('title', 'Reconstruido al migrar: mismo proveedor y mismo día')
  })

  it('la flecha y el título pliegan; el menú va a la derecha', async () => {
    const onAlternar = vi.fn()
    render(<CabeceraBloque bloque={bloque(l())} visibles={1} desplegado={false} onAlternar={onAlternar} menu={<button type="button">⋮</button>} />)
    const flecha = screen.getByRole('button', { name: 'Desplegar bloque 41' })
    expect(flecha).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(flecha)
    await userEvent.click(screen.getByText('Bloque 41'))
    expect(onAlternar).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: '⋮' })).toBeInTheDocument()
  })

  it('las líneas sin bloque se agrupan bajo «Sin bloque»', () => {
    render(<CabeceraBloque bloque={bloque(l({ idBloque: null, fechaBloque: null }))} visibles={1} desplegado onAlternar={vi.fn()} />)
    expect(screen.getByText('Sin bloque')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plegar líneas sin bloque' })).toBeInTheDocument()
  })

  it('chip «! N sin precio» con líneas recibidas a 0 (2026-10-13)', () => {
    const b = bloque(l({ idCompra: 1, estado: 'recibido', precioUnidadPedido: 0, precioEur: 0 }), l({ idCompra: 2, estado: 'recibido', precioUnidadPedido: 0, precioEur: 0 }))
    render(<CabeceraBloque bloque={b} visibles={2} desplegado={false} onAlternar={vi.fn()} />)
    const chip = screen.getByText('! 2 sin precio')
    expect(chip).toHaveAttribute('title', '2 líneas recibidas sin precio: ponlo con «Editar».')
    expect(chip).toHaveClass('bg-fila-solicitud-bg', 'text-fila-solicitud-brd')
  })
})
