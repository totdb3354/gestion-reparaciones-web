import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CeldaFechas } from './CeldaFechas'
import { CREMA_EN_FILA_SELECCIONADA } from './DataTable'

describe('CeldaFechas (calco de la columna Fechas)', () => {
  it('dos líneas: inicio en gris pequeño y "→ fin" en azul medio; "—" si falta', () => {
    render(<CeldaFechas inicio="2026-09-11T07:00:00" fin={null} patron="yyyy/MM/dd" />)
    expect(screen.getByText('2026/09/11')).toHaveClass('text-[10px]', 'text-texto-fecha-inicio')
    expect(screen.getByText('→ —')).toHaveClass('text-[11px]', 'text-azul-medio')
  })
  it('las dos líneas pasan a crema en la fila seleccionada (actualizarColores: "white" en lblInicio y lblFin)', () => {
    render(<CeldaFechas inicio="2026-01-01T09:00:00" fin="2026-01-01T10:00:00" patron="yyyy/MM/dd" />)
    expect(screen.getByText('2026/01/01')).toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    expect(screen.getByText('→ 2026/01/01')).toHaveClass(CREMA_EN_FILA_SELECCIONADA)
  })
})
