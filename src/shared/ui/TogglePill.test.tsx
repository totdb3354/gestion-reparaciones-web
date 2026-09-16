import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderConProviders } from '@/test/render'
import { TogglePill } from './TogglePill'

const OPCIONES = [
  { to: '/reparaciones/pendientes', etiqueta: 'Reparaciones (10)' },
  { to: '/reparaciones/pendientes/glass', etiqueta: 'Glass (0)' },
  { to: '/reparaciones/pendientes/pulidos', etiqueta: 'Pulidos (0)' },
]

describe('TogglePill (calco de toggle-pill-left/mid/right)', () => {
  it('marca activa solo la ruta exacta y redondea los extremos', () => {
    renderConProviders(<TogglePill opciones={OPCIONES} />, { ruta: '/reparaciones/pendientes' })
    const rep = screen.getByRole('link', { name: 'Reparaciones (10)' })
    const glass = screen.getByRole('link', { name: 'Glass (0)' })
    const pul = screen.getByRole('link', { name: 'Pulidos (0)' })
    expect(rep).toHaveAttribute('aria-current', 'page')
    expect(glass).not.toHaveAttribute('aria-current')
    expect(rep).toHaveClass('rounded-l-3xl', 'bg-azul-noche', 'text-superficie')
    expect(glass).toHaveClass('bg-pill-bg', 'text-azul-gris')
    expect(pul).toHaveClass('rounded-r-3xl')
  })
})
