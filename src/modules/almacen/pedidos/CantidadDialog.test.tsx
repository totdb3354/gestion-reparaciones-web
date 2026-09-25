import { getDefaultNormalizer, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { renderConProviders } from '@/test/render'
import { CantidadDialog } from './CantidadDialog'

const sinColapsar = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) }
const enCamino: CompraComponente = {
  idCompra: 2, idCom: 12, tipoComponente: 'bat-x', idProv: 2, nombreProveedor: 'Proveedor B', cantidad: 10, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-19T08:00:00', fechaLlegada: null, precioUnidadPedido: 10, divisa: 'USD', precioEur: 8.8,
  estado: 'en_camino', updatedAt: '2026-09-19T08:00:00',
}
const parcial: CompraOtro = {
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 10, cantidadRecibida: 3,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2,
  estado: 'parcial', updatedAt: '2026-09-20T08:30:00',
}

function montar(modo: 'parcial' | 'resto', pedido: CompraComponente | CompraOtro | null, errorServidor: string | null = null) {
  const onConfirmar = vi.fn()
  renderConProviders(<CantidadDialog modo={modo} pedido={pedido} errorServidor={errorServidor} enviando={false} onConfirmar={onConfirmar} onCancelar={vi.fn()} />)
  return onConfirmar
}

describe('CantidadDialog (spec 4b §6, P6)', () => {
  it('"Recepción parcial": subtítulo con las pedidas, etiqueta y campo vacío con foco; confirma el entero', async () => {
    const onConfirmar = montar('parcial', enCamino)
    const dlg = within(screen.getByRole('dialog', { name: 'Recepción parcial' }))
    expect(dlg.getByText('Pedido #2 — bat-x (10 pedidas)')).toBeInTheDocument()
    const campo = dlg.getByLabelText('Cantidad recibida ahora:')
    expect(campo).toHaveValue('')
    expect(campo).toHaveFocus()
    expect(dlg.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    await userEvent.type(campo, '4{Enter}')
    expect(onConfirmar).toHaveBeenCalledWith(4)
  })
  it('"Recepción parcial": "Cantidad no válida." si no es un número y el rango con la cantidad pedida; no confirma', async () => {
    const onConfirmar = montar('parcial', enCamino)
    const campo = screen.getByLabelText('Cantidad recibida ahora:')
    await userEvent.type(campo, 'abc{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Cantidad no válida.')
    await userEvent.clear(campo)
    await userEvent.type(campo, '10{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0 y menor que 10.')
    expect(onConfirmar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Recepción parcial' })).toBeInTheDocument()
  })
  it('"Recibir unidades": subtítulo en dos líneas con el concepto en otros y campo precargado con el restante', async () => {
    const onConfirmar = montar('resto', parcial)
    const dlg = within(screen.getByRole('dialog', { name: 'Recibir unidades' }))
    expect(dlg.getByText('Pedido #7 — Cinta de embalar (recibidas: 3/10)\nSi introduces 7, el pedido se cerrará como recibido.', sinColapsar)).toBeInTheDocument()
    const campo = dlg.getByLabelText('Cantidad que llega ahora:')
    expect(campo).toHaveValue('7')
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirmar).toHaveBeenCalledWith(7)
  })
  it('"Recibir unidades": mayor que 0 y sin pasar de lo pedido', async () => {
    const onConfirmar = montar('resto', parcial)
    const campo = screen.getByLabelText('Cantidad que llega ahora:')
    await userEvent.clear(campo)
    await userEvent.type(campo, '0{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0.')
    await userEvent.clear(campo)
    await userEvent.type(campo, '8{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('No puedes recibir más de lo pedido. Faltan 7 unidad(es).')
    expect(onConfirmar).not.toHaveBeenCalled()
  })
  it('un 422 del servidor se pinta inline y se oculta al teclear', async () => {
    montar('resto', parcial, 'No puedes recibir más de lo pedido. Faltan 7 unidad(es).')
    expect(screen.getByRole('alert')).toHaveTextContent('No puedes recibir más de lo pedido. Faltan 7 unidad(es).')
    await userEvent.type(screen.getByLabelText('Cantidad que llega ahora:'), '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
