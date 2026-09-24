import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { GraficoEstado } from './GraficoEstado'
import { GraficoSku } from './GraficoSku'

// jsdom no soporta el hover real de Recharts (recharts-tooltip-wrapper), así que Tooltip y Pie se sustituyen por sondas de
// props: la del Tooltip pinta además su `content` con un payload de ejemplo (el que Recharts le pasa al pasar por la barra).
type PropsTooltip = { cursor?: unknown; content?: (p: { active: boolean; payload: { value: number; name: string }[]; label: string }) => ReactNode }
type PropsYAxis = { ticks?: number[]; domain?: unknown }
type PropsPie = { startAngle?: number; endAngle?: number; stroke?: string; strokeWidth?: number }
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    Tooltip: (p: PropsTooltip) => (
      <div data-testid="tooltip-props" data-cursor={String(p.cursor)}>
        {typeof p.content === 'function' ? p.content({ active: true, payload: [{ value: 101, name: 'valor' }], label: 'Stock' }) : null}
      </div>
    ),
    YAxis: (p: PropsYAxis) => <g data-testid="yaxis-props" data-ticks={p.ticks?.join(',')} data-domain={JSON.stringify(p.domain)} />,
    Pie: (p: PropsPie) => <g data-testid="pie-props" data-start-angle={p.startAngle} data-end-angle={p.endAngle} data-stroke={p.stroke} data-stroke-width={p.strokeWidth} />,
  }
})

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
  it('el donut gira en sentido horario desde las 3 (PieChart del JavaFX) con separadores blancos de 1 px', () => {
    render(<GraficoEstado conteos={{ ok: 7, bajo: 2, sinStock: 1, total: 10 }} />)
    const pie = screen.getByTestId('pie-props')
    expect(pie).toHaveAttribute('data-start-angle', '0')
    expect(pie).toHaveAttribute('data-end-angle', '-360')
    expect(pie).toHaveAttribute('data-stroke', '#FFFFFF')
    expect(pie).toHaveAttribute('data-stroke-width', '1')
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
  it('eje Y con las marcas del JavaFX (paso max/5) de 0 al máximo, y el gráfico de 260 px de alto', () => {
    const { container } = render(<GraficoSku componente={{ ...comp, stock: 101 }} enCamino={4} />)
    const eje = screen.getByTestId('yaxis-props')
    expect(eje).toHaveAttribute('data-ticks', '0,20,40,60,80,100,101')
    expect(eje).toHaveAttribute('data-domain', '[0,101]')
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('height', '260')
  })
  it('el tooltip es una caja oscura solo con el número, sin categoría ni banda gris (stock-tooltip-barra.png)', () => {
    render(<GraficoSku componente={comp} enCamino={4} />)
    const sonda = screen.getByTestId('tooltip-props')
    expect(sonda).toHaveAttribute('data-cursor', 'false')
    expect(sonda).toHaveTextContent(/^101$/)
    expect(within(sonda).getByText('101')).toHaveClass('bg-azul-medio', 'text-crema', 'text-[11px]', 'rounded', 'px-2', 'py-1')
  })
})
