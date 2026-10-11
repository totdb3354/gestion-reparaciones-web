import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it, vi } from 'vitest'
import type { CompraComponente } from '@/shared/api/client'
import { DataTable } from '@/shared/ui/DataTable'
import { MenuPedido } from './MenuPedido'
import { idPedido, nombrePedido, type AccionMenu, type Pedido } from './reglas'
import { BLOQUE_PRUEBA } from './formulario/datosPrueba'

const pedido = (o: Partial<CompraComponente> = {}): CompraComponente => ({
  ...BLOQUE_PRUEBA,
  idCompra: 1, idCom: 11, tipoComponente: 'lcd-x-negro', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 5, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR', precioEur: 12.5,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})
const COLUMNAS: ColumnDef<Pedido>[] = [{ id: 'nombre', header: 'Nombre', accessorFn: nombrePedido }]

function montar(p: Pedido, onAccion: (a: AccionMenu, p: Pedido) => void = vi.fn(), onInteraccion?: (abierto: boolean) => void) {
  render(<DataTable columns={COLUMNAS} data={[p]} vacio="" getRowId={(x) => String(idPedido(x))} menuFila={(x) => <MenuPedido pedido={x} onAccion={onAccion} onInteraccion={onInteraccion} />} />)
}
const abrir = () => userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('lcd-x-negro') })

describe('MenuPedido (spec 4b §6, StockController :970-1010)', () => {
  it.each([
    ['pendiente', ['Confirmar pedido', 'Editar', 'Borrar'], 1],
    ['en_camino', ['Recepción parcial', 'Confirmar recibido', 'Editar', 'Cancelar pedido'], 1],
    ['parcial', ['Recibir resto', 'Cerrar sin resto'], 0],
    ['recibido', ['Revertir a En camino', 'Editar'], 1],
  ])('%s: entradas en orden y separadores', async (estado, textos, separadores) => {
    montar(pedido({ estado }))
    await abrir()
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(textos)
    expect(screen.queryAllByRole('separator')).toHaveLength(separadores)
  })
  it('cancelado: sin entradas', async () => {
    montar(pedido({ estado: 'cancelado' }))
    await abrir()
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })
  it('elegir una entrada avisa con la acción y el pedido', async () => {
    const onAccion = vi.fn()
    const p = pedido({ estado: 'en_camino' })
    montar(p, onAccion)
    await abrir()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recepción parcial' }))
    expect(onAccion).toHaveBeenCalledWith('parcial', p)
  })
  it('abrir y cerrar el menú avisa a onInteraccion (congela el sondeo de la página)', async () => {
    const onInteraccion = vi.fn()
    montar(pedido(), vi.fn(), onInteraccion)
    await abrir()
    expect(onInteraccion).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard('{Escape}')
    expect(onInteraccion).toHaveBeenLastCalledWith(false)
  })

  it('0.9.9: «Mover a bloque» abre los destinos y elegir uno avisa con su número', async () => {
    const onMover = vi.fn()
    render(<DataTable columns={COLUMNAS} data={[pedido()]} vacio="" getRowId={(x) => String(idPedido(x))}
      menuFila={(x) => <MenuPedido pedido={x} onAccion={vi.fn()} mover={{ destinos: [{ idBloque: 40, texto: 'Bloque 40', detalle: '08/10 · 1 línea · abierto' }], sola: false, onMover }} />} />)
    await abrir()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque 40/ }))
    expect(onMover).toHaveBeenCalledWith(40)
  })

  it('0.9.9: un cancelado con «mover» tiene solo esa entrada; si está sola, «Bloque nuevo» va deshabilitado', async () => {
    render(<DataTable columns={COLUMNAS} data={[pedido({ estado: 'cancelado' })]} vacio="" getRowId={(x) => String(idPedido(x))}
      menuFila={(x) => <MenuPedido pedido={x} onAccion={vi.fn()} mover={{ destinos: [], sola: true, onMover: vi.fn() }} />} />)
    await abrir()
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Mover a bloque'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    const nuevo = await screen.findByRole('menuitem', { name: /Bloque nuevo/ })
    expect(nuevo).toHaveAttribute('aria-disabled', 'true')
    expect(nuevo).toHaveTextContent('ya está sola en su bloque')
  })
})
