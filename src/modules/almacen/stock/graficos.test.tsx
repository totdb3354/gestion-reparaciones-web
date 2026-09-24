import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { GraficoEstado } from './GraficoEstado'
import { GraficoSku } from './GraficoSku'

const comp: Componente = { idCom: 1, tipo: 'lcd-x', fechaRegistro: '2026-09-01T10:00:00', stock: 2, stockMinimo: 3, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 4, ultimoPedido: null, idComMaster: 9 }

describe('GraficoEstado', () => {
  it('título, total en el centro y leyenda con los tres nombres y sus números', () => {
    render(<GraficoEstado conteos={{ ok: 7, bajo: 2, sinStock: 1, total: 10 }} />)
    expect(screen.getByText('Estado del stock')).toHaveClass('text-[13px]', 'font-bold', 'text-azul-medio')
    const centro = screen.getByTestId('donut-total')
    expect(within(centro).getByText('10')).toHaveClass('text-[17px]', 'font-bold')
    expect(within(centro).getByText('total')).toHaveClass('text-[9px]')
    const leyenda = screen.getByTestId('donut-leyenda')
    expect(within(leyenda).getByText('OK').nextSibling).toHaveTextContent('7')
    expect(within(leyenda).getByText('Bajo').nextSibling).toHaveTextContent('2')
    expect(within(leyenda).getByText('Sin stock').nextSibling).toHaveTextContent('1')
  })
})

describe('GraficoSku', () => {
  it('sin selección: "Selecciona un componente" y "↑ Haz clic en una fila"', () => {
    render(<GraficoSku componente={null} enCamino={0} />)
    expect(screen.getByText('Selecciona un componente')).toBeInTheDocument()
    expect(screen.getByText('↑ Haz clic en una fila')).toHaveClass('text-[11px]', 'text-gris-borde')
  })
  it('con selección: el tipo sin sufijo como título y las dos barras con sus valores accesibles', () => {
    render(<GraficoSku componente={comp} enCamino={4} />)
    expect(screen.getByText('lcd-x')).toBeInTheDocument()
    expect(screen.queryByText('↑ Haz clic en una fila')).not.toBeInTheDocument()
    const barras = screen.getByRole('img', { name: 'Stock 2, Pedido 4' })
    expect(barras).toBeInTheDocument()
  })
})
