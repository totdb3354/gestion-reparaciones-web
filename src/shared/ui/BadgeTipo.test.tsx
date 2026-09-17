import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BadgeTipo } from './BadgeTipo'

describe('BadgeTipo (calco de celdaTipoConChasis)', () => {
  it('píldora del tipo por prefijo y "Chasis" solo en reparaciones con chasis', () => {
    const { rerender } = render(<BadgeTipo idRep="A20260916_12" esChasis />)
    expect(screen.getByText('Reparación')).toHaveClass('bg-tipo-reparacion-bg', 'text-tipo-reparacion-text', 'rounded-[10px]', 'text-[11px]', 'font-bold')
    expect(screen.getByText('Chasis')).toHaveClass('text-[10px]', 'text-texto-sub')
    rerender(<BadgeTipo idRep="AG20260916_1" esChasis />)
    expect(screen.getByText('Glass')).toHaveClass('bg-tipo-glass-bg')
    expect(screen.queryByText('Chasis')).not.toBeInTheDocument()
    rerender(<BadgeTipo idRep="P20260916_1" />)
    expect(screen.getByText('Pulido')).toHaveClass('bg-tipo-pulido-bg')
  })
})
