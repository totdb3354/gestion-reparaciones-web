import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { DataTable } from '@/shared/ui/DataTable'
import { BadgeEstadoPedido } from './BadgeEstadoPedido'
import { CABECERAS_CSV_OTROS, CABECERAS_CSV_PEDIDOS, claseFilaPedido, crearColumnasOtros, crearColumnasPedidos, filaCsvOtro, filaCsvPedido } from './columnas'

const compra = (o: Partial<CompraComponente> = {}): CompraComponente => ({
  idCompra: 1, idCom: 11, tipoComponente: 'lcd-x-negro', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 5, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR', precioEur: 12.5,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})
const otro = (o: Partial<CompraOtro> = {}): CompraOtro => ({
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 3, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2,
  estado: 'recibido', updatedAt: '2026-09-20T08:30:00', ...o,
})

function montarPedidos(filas: CompraComponente[], onComponente = vi.fn()) {
  const r = render(<DataTable columns={crearColumnasPedidos({ onComponente })} data={filas} vacio="Sin pedidos" getRowId={(p) => String(p.idCompra)} filaClase={claseFilaPedido} />)
  return { ...r, onComponente }
}
const celdas = (container: HTMLElement, columna: string) => Array.from(container.querySelectorAll(`[data-columna="${columna}"]`)).map((c) => c.textContent)

describe('tabla de componentes', () => {
  it('siete cabeceras en orden, sin Div., con los anchos del FXML', () => {
    const { container } = montarPedidos([compra()])
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Pedido', 'Componente', 'Proveedor', 'Cant.', 'P.Unit.', 'EUR', 'Estado'])
    const cols = container.querySelectorAll('col')
    expect(cols[0]).toHaveStyle({ width: '115px' })
    expect(cols[1]).toHaveStyle({ width: '190px' })
    expect(cols[6]).toHaveStyle({ width: '110px' })
  })
  it('Pedido en dd/MM/yy HH:mm de Madrid y Cant. según el estado', () => {
    const { container } = montarPedidos([
      compra({ idCompra: 1, estado: 'parcial', cantidad: 10, cantidadRecibida: 3 }),
      compra({ idCompra: 2, estado: 'parcial', cantidad: 10, cantidadRecibida: null, fechaPedido: '2026-01-15T10:00:00' }),
      compra({ idCompra: 3, estado: 'recibido', cantidadRecibida: 2 }),
      compra({ idCompra: 4, estado: 'recibido', cantidadRecibida: null }),
      compra({ idCompra: 5, estado: 'en_camino' }),
    ])
    expect(celdas(container, 'fecha')).toEqual(['20/09/26 10:30', '15/01/26 11:00', '20/09/26 10:30', '20/09/26 10:30', '20/09/26 10:30'])
    expect(celdas(container, 'cantidad')).toEqual(['3/10', '10', '2', '5', '5'])
  })
  it('P.Unit. con el símbolo de su divisa y coma decimal; EUR = unidades × precioEur en euros', () => {
    const { container } = montarPedidos([
      compra({ idCompra: 1 }),
      compra({ idCompra: 2, divisa: 'USD', precioUnidadPedido: 10, precioEur: 8.8 }),
      compra({ idCompra: 3, divisa: 'GBP', precioUnidadPedido: 3, precioEur: 3.45 }),
      compra({ idCompra: 4, estado: 'recibido', cantidadRecibida: 2 }),
    ])
    expect(celdas(container, 'precio')).toEqual(['12,50 €', '10,00 $', '3,00 GBP', '12,50 €'])
    expect(celdas(container, 'eur')).toEqual(['62,50 €', '44,00 €', '17,25 €', '25,00 €'])
  })
  it('"!" ámbar negrita en P.Unit. y EUR solo en un recibido con precio o total 0', () => {
    montarPedidos([compra({ idCompra: 1, estado: 'recibido', precioUnidadPedido: 0, precioEur: 0 }), compra({ idCompra: 2, estado: 'pendiente', precioUnidadPedido: 0, precioEur: 0, tipoComponente: 'bat-x' })])
    const marcados = screen.getAllByText('0,00 €')
    expect(marcados).toHaveLength(4)
    expect(marcados[0]).toHaveClass('font-bold', 'text-fila-solicitud-brd')
    expect(marcados[1]).toHaveClass('font-bold', 'text-fila-solicitud-brd')
    expect(marcados[2]).not.toHaveClass('font-bold')
    const avisos = screen.getAllByText('!')
    expect(avisos).toHaveLength(2)
    for (const a of avisos) expect(a).toHaveClass('text-[12px]', 'font-bold', 'text-fila-solicitud-brd')
  })
  it('Componente es un enlace con la clase de "En Camino" de Stock y avisa con el pedido', async () => {
    const { onComponente } = montarPedidos([compra({ idCompra: 2, idCom: 12, tipoComponente: 'bat-x' })])
    const enlace = screen.getByRole('button', { name: 'bat-x' })
    expect(enlace).toHaveClass('cursor-pointer', 'text-texto-accion', 'hover:underline')
    await userEvent.click(enlace)
    expect(onComponente).toHaveBeenCalledWith(expect.objectContaining({ idCompra: 2, idCom: 12 }))
  })
})

describe('tabla de otros', () => {
  it('Concepto en vez de Componente, como texto sin enlace, con los anchos del FXML', () => {
    const { container } = render(<DataTable columns={crearColumnasOtros()} data={[otro()]} vacio="Sin otros pedidos" getRowId={(p) => String(p.idCompraOtro)} filaClase={claseFilaPedido} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Pedido', 'Concepto', 'Proveedor', 'Cant.', 'P.Unit.', 'EUR', 'Estado'])
    expect(screen.getByText('Cinta de embalar').tagName).not.toBe('BUTTON')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    const cols = container.querySelectorAll('col')
    expect(cols[1]).toHaveStyle({ width: '220px' })
    expect(cols[3]).toHaveStyle({ width: '60px' })
    expect(cols[4]).toHaveStyle({ width: '80px' })
    expect(celdas(container, 'eur')).toEqual(['6,00 €'])
  })
})

describe('badge, "⚠" y clase de fila', () => {
  it('badge con el estado tal cual y los colores de StockController :903-914; "⚠" solo si urgente en camino o parcial', () => {
    const casos: [Partial<CompraComponente>, string[]][] = [
      [{ estado: 'pendiente' }, ['bg-badge-pendiente-bg', 'text-badge-pendiente-text']],
      [{ estado: 'en_camino', esUrgente: true }, ['bg-fila-solicitud-bg', 'text-fila-solicitud-brd']],
      [{ estado: 'en_camino' }, ['bg-badge-neutro-bg', 'text-azul-gris']],
      [{ estado: 'recibido' }, ['bg-fila-recibido-bg', 'text-fila-recibido-brd']],
      [{ estado: 'parcial', esUrgente: true }, ['bg-fila-parcial-bg', 'text-fila-parcial-brd']],
      [{ estado: 'cancelado' }, ['bg-fila-cancelado-bg', 'text-fila-cancelado-text']],
    ]
    for (const [o, clases] of casos) {
      const { unmount } = render(<BadgeEstadoPedido pedido={compra(o)} />)
      const badge = screen.getByText(String(o.estado))
      expect(badge).toHaveClass('rounded-[12px]', 'px-2.5', 'py-[3px]', 'text-[11px]', 'font-bold', ...clases)
      const conAviso = o.esUrgente === true && (o.estado === 'en_camino' || o.estado === 'parcial')
      if (conAviso) expect(screen.getByText('⚠')).toHaveClass('text-[13px]', 'text-fila-solicitud-brd')
      else expect(screen.queryByText('⚠')).not.toBeInTheDocument()
      unmount()
    }
    render(<BadgeEstadoPedido pedido={compra({ estado: 'pendiente', esUrgente: true })} />)
    expect(screen.queryByText('⚠')).not.toBeInTheDocument()
  })
  it('clase de fila: barra de 8 px por estado; en camino solo si es urgente; cancelado sin barra y con opacidad', () => {
    expect(claseFilaPedido(compra({ estado: 'pendiente' }))).toBe('border-l-8 border-l-fila-pendiente-brd')
    expect(claseFilaPedido(compra({ estado: 'en_camino', esUrgente: true }))).toBe('border-l-8 border-l-fila-solicitud-brd')
    expect(claseFilaPedido(compra({ estado: 'en_camino' }))).toBe('border-l-8 border-l-transparent')
    expect(claseFilaPedido(compra({ estado: 'recibido' }))).toBe('border-l-8 border-l-fila-recibido-brd')
    expect(claseFilaPedido(otro({ estado: 'parcial' }))).toBe('border-l-8 border-l-fila-parcial-brd')
    expect(claseFilaPedido(otro({ estado: 'cancelado' }))).toBe('border-l-8 border-l-transparent opacity-45')
  })
})

describe('CSV (StockController :1961-2006)', () => {
  it('componentes: cabeceras exactas, fecha con año completo, cantidad pedida, Sí/No, coma decimal, total con recibidas y estado con guion bajo', () => {
    expect(CABECERAS_CSV_PEDIDOS).toEqual(['Fecha pedido', 'Componente', 'Cantidad', 'Urgente', 'Proveedor', 'Precio unidad', 'Divisa', 'Total EUR', 'Estado'])
    expect(filaCsvPedido(compra({ estado: 'recibido', cantidadRecibida: 2, esUrgente: true }))).toEqual(['20/09/2026 10:30', 'lcd-x-negro', '5', 'Sí', 'Proveedor A', '12,50', 'EUR', '25,00', 'recibido'])
    expect(filaCsvPedido(compra({ estado: 'en_camino', divisa: 'USD', precioUnidadPedido: 10, precioEur: 8.8 }))).toEqual(['20/09/2026 10:30', 'lcd-x-negro', '5', 'No', 'Proveedor A', '10,00', 'USD', '44,00', 'en_camino'])
  })
  it('otros: sin Urgente', () => {
    expect(CABECERAS_CSV_OTROS).toEqual(['Fecha pedido', 'Concepto', 'Cantidad', 'Proveedor', 'Precio unidad', 'Divisa', 'Total EUR', 'Estado'])
    expect(filaCsvOtro(otro())).toEqual(['20/09/2026 10:30', 'Cinta de embalar', '3', 'Proveedor A', '2,00', 'EUR', '6,00', 'recibido'])
  })
})
