import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { GraficoEstado } from './GraficoEstado'
import { GraficoSku } from './GraficoSku'

// Recharts 3.10.1 pinta el separador " : " en el tooltip por defecto siempre que el nombre sea "" (DataUtils.isNumOrStr
// da true para el string vacío), lo que deja " : 4" en vez de "4". Se comprueba que <Tooltip> recibe separator="" sin
// disparar el hover real (jsdom no soporta el recharts-tooltip-wrapper), sustituyendo Tooltip por una sonda de props.
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return { ...original, Tooltip: (p: { separator?: string }) => <div data-testid="tooltip-props" data-separator={p.separator} /> }
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
  it('el tooltip no lleva separador (evita " : 4" en vez de "4")', () => {
    render(<GraficoSku componente={comp} enCamino={4} />)
    expect(screen.getByTestId('tooltip-props')).toHaveAttribute('data-separator', '')
  })
})
