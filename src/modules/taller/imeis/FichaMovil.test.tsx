import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fichaMovil } from '../test/fabrica'
import { FichaMovil } from './FichaMovil'

const ficha = (p: Parameters<typeof fichaMovil>[0] = {}) => render(<FichaMovil ficha={fichaMovil(p)} eventos={3} onVerRastro={() => {}} />)

describe('ficha de NSYS: revisado (spec 0.9.18 §5.2)', () => {
  it('dice cuándo se revisó, junto a la ubicación', () => {
    ficha({ revisadoEl: '2026-10-17T10:31:00' })
    expect(screen.getByRole('region', { name: 'Ficha de NSYS' })).toHaveTextContent('Revisado el 17/10/2026, hacia las 10:31')
  })

  it('o desde cuándo espera la revisión', () => {
    ficha({ ubicacion: 'En revisión', pendienteRevisionDesde: '2026-01-01' })
    expect(screen.getByText(/^Pendiente de revisar desde hace \d+ días$/)).toBeInTheDocument()
  })

  it('sin datos, nada', () => {
    ficha()
    expect(screen.queryByText(/Revisado|Pendiente de revisar/)).not.toBeInTheDocument()
  })
})

describe('ficha de NSYS: lo del taller (spec 0.9.21 §2.4)', () => {
  const region = () => screen.getByRole('region', { name: 'Ficha de NSYS' })

  it('color, grado y SKU del taller con la marca y lo de NSYS al lado, y lo que hay que poner en NSYS', () => {
    ficha({ color: 'Rosa', colorNsys: 'Negro', grado: 'A', bateriaNueva: true, gradoNsys: 'B', gradoAnterior: 'C',
      sku: 'i16128RosaA100', skuNsys: 'i16128NegroB', porPasar: true, ponerProducto: 'Apple iPhone 16 128GB Pink', ponerGrado: 'A100' })
    expect(region()).toHaveTextContent('iPhone 16 128GB Rosa taller NSYS: Negro')
    expect(region()).toHaveTextContent('Grado A · batería nueva taller NSYS: B')
    expect(region()).not.toHaveTextContent('antes')
    expect(region()).toHaveTextContent('SKU i16128RosaA100 taller NSYS: i16128NegroB')
    expect(region()).toHaveTextContent('Por pasar a NSYS: Apple iPhone 16 128GB Pink · grado A100')
  })

  it('sin SKU en el maestro y sin ningún móvil de ese color en NSYS', () => {
    ficha({ color: 'Verde', colorNsys: 'Negro', sku: null, skuNsys: 'i16128NegroA100', porPasar: true, ponerProducto: null, ponerGrado: 'A100' })
    expect(region()).toHaveTextContent('SKU sin SKU en el maestro taller NSYS: i16128NegroA100')
    expect(region()).toHaveTextContent('Por pasar a NSYS: (ningún móvil de ese color en NSYS: búscalo a mano) · grado A100')
  })

  it('sin nada del taller, como antes y sin «Por pasar a NSYS»', () => {
    ficha()
    expect(region()).toHaveTextContent('Grado A (antes C) · batería nueva')
    expect(screen.queryByText('taller')).not.toBeInTheDocument()
    expect(screen.queryByText(/Por pasar a NSYS/)).not.toBeInTheDocument()
  })

  it('«Corregir color, grado o batería…» solo si quien pinta la ficha lo ofrece', async () => {
    const { unmount } = ficha()
    expect(screen.queryByRole('button', { name: 'Corregir color, grado o batería…' })).not.toBeInTheDocument()
    unmount()
    const onCorregir = vi.fn()
    render(<FichaMovil ficha={fichaMovil()} eventos={3} onVerRastro={() => {}} onCorregir={onCorregir} />)
    await userEvent.click(screen.getByRole('button', { name: 'Corregir color, grado o batería…' }))
    expect(onCorregir).toHaveBeenCalledTimes(1)
  })
})
