import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CeldaFechas } from './CeldaFechas'

describe('CeldaFechas (calco de la columna Fechas)', () => {
  it('dos líneas: inicio en gris pequeño y "→ fin" en azul medio; "—" si falta', () => {
    render(<CeldaFechas inicio="2026-09-11T07:00:00" fin={null} patron="yyyy/MM/dd" />)
    expect(screen.getByText('2026/09/11')).toHaveClass('text-[10px]', 'text-texto-fecha-inicio')
    expect(screen.getByText('→ —')).toHaveClass('text-[11px]', 'text-azul-medio')
  })
})
