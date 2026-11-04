import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CeldaImeiPendiente } from './CeldaImeiPendiente'
import { resumen } from '../test/fabrica'

describe('CeldaImeiPendiente · pedido (spec pieza 2 §9.3)', () => {
  it('con pedido dice su número y el SKU en el que tiene que acabar', () => {
    render(<CeldaImeiPendiente rep={resumen({ imei: '350000000000001', pedidoNumero: '402-0000000-0000001', pedidoSku: 'i13128AzulA' })} />)
    expect(screen.getByText('Pedido 402-0000000-0000001 · acabar en i13128AzulA')).toBeInTheDocument()
  })

  it('avisa si el IMEI está en dos pedidos y no dice nada sin pedido', () => {
    const { rerender } = render(<CeldaImeiPendiente rep={resumen({ imei: '350000000000001', pedidoNumero: '6488', pedidoSku: 'i13128AzulA', pedidoRepetido: true })} />)
    expect(screen.getByText('IMEI en dos pedidos')).toBeInTheDocument()
    rerender(<CeldaImeiPendiente rep={resumen({ imei: '350000000000001' })} />)
    expect(screen.queryByText(/^Pedido /)).not.toBeInTheDocument()
  })
})
