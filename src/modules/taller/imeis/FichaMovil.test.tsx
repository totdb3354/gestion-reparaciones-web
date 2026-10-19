import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
