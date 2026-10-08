import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { CREMA_EN_FILA_SELECCIONADA, DataTable } from '@/shared/ui/DataTable'
import { BadgeEstadoStock } from './BadgeEstadoStock'
import { CABECERAS_CSV_STOCK, cabecerasCsvStock, claseFilaStock, crearColumnasStock, filaCsvStock, parametrosPedidos } from './columnas'
import { agruparCompartidos, type FilaStock } from './grupos'
import { repartoFluido } from '@/test/columnas'

const base: Componente = { idCom: 1, tipo: 'lcd-x', fechaRegistro: '2026-09-01T10:30:00', stock: 5, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null, consumoDiario: null, pedir60: null }
const c = (o: Partial<Componente>): Componente => ({ ...base, ...o })

const filas = (l: Componente[]): FilaStock[] => agruparCompartidos(l)

function montar(lista: Componente[], onEnCamino = vi.fn()) {
  render(<DataTable columns={crearColumnasStock({ onEnCamino })} data={filas(lista)} vacio="Sin componentes" getRowId={(x) => String(x.idCom)} filaClase={claseFilaStock} />)
  return onEnCamino
}

describe('columnas de Stock actual', () => {
  it('pinta las seis cabeceras en orden y con los anchos del FXML', () => {
    const { container } = render(<DataTable columns={crearColumnasStock({ onEnCamino: vi.fn() })} data={filas([base])} vacio="Sin componentes" />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Componente', 'En Stock', 'En Camino', 'Stock Mínimo', 'Último pedido', 'Estado'])
    const cols = container.querySelectorAll('col')
    expect(cols[0]).toHaveStyle({ width: '230px' })
    expect(cols[5]).toHaveStyle({ width: '100px' })
  })
  it('sin último pedido pinta "—" y con fecha dd/MM/yyyy', () => {
    // 09:00 UTC = 11:00 en Madrid: la hora no cruza medianoche al convertir, así que el día es el mismo en UTC y en Madrid
    // (formatear pasa a Madrid, decisión 8; entre las 22:00 y las 24:00 UTC la web pintaría el día siguiente).
    montar([c({ ultimoPedido: '2026-08-15T09:00:00' })])
    expect(screen.getByText('15/08/2026')).toBeInTheDocument()
    montar([c({ idCom: 2, tipo: 'bat-x' })])
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
  it('"En Camino" a 0 es texto "—"; > 0 es un enlace azul que avisa con el componente', async () => {
    montar([c({ ultimoPedido: '2026-09-01T09:00:00' })])
    expect(document.querySelector('[data-columna="enCamino"]')).toHaveTextContent('—')
    const onEnCamino = montar([c({ enCamino: 3 })])
    const enlace = screen.getByRole('button', { name: '3' })
    expect(enlace).toHaveClass('text-texto-accion', 'hover:underline')
    await userEvent.click(enlace)
    expect(onEnCamino).toHaveBeenCalledWith(expect.objectContaining({ idCom: 1 }))
  })
  it('el badge Estado lleva los colores del semáforo', () => {
    const { rerender } = render(<BadgeEstadoStock estado="OK" />)
    expect(screen.getByText('OK')).toHaveClass('bg-badge-neutro-bg', 'text-azul-gris', 'rounded-[10px]', 'text-[11px]', 'font-bold')
    rerender(<BadgeEstadoStock estado="Bajo" />)
    expect(screen.getByText('Bajo')).toHaveClass('bg-fila-solicitud-bg', 'text-fila-solicitud-brd')
    rerender(<BadgeEstadoStock estado="Sin stock" />)
    expect(screen.getByText('Sin stock')).toHaveClass('bg-badge-sin-stock-bg', 'text-rojo-sin-stock')
    rerender(<BadgeEstadoStock estado="Desactivado" />)
    expect(screen.getByText('Desactivado')).toHaveClass('bg-fila-cancelado-bg', 'text-fila-cancelado-text')
  })
  it('clase de fila: borde por estado y opacidad en desactivadas, que al seleccionarse se ponen azules atenuadas', () => {
    expect(claseFilaStock(c({ stock: 2 }))).toContain('border-l-fila-solicitud-brd')
    expect(claseFilaStock(c({ stock: 0 }))).toContain('border-l-rojo-sin-stock')
    expect(claseFilaStock(base)).toContain('border-l-transparent')
    const inactiva = claseFilaStock(c({ activo: false }))
    expect(inactiva).toContain('opacity-45')
    // stock-fila-desactivada-seleccionada.png: navy al 45 % con texto claro, así que no se anula el azul de la selección.
    expect(inactiva).not.toContain('data-[state=selected]:bg-transparent')
    expect(inactiva).not.toContain('data-[state=selected]:text-inherit')
  })
  it('una fila desactivada seleccionada lleva el azul y la crema de la selección, con la opacidad 0.45', () => {
    render(<DataTable columns={crearColumnasStock({ onEnCamino: vi.fn() })} data={filas([c({ activo: false, ultimoPedido: '2026-08-15T09:00:00' })])} vacio="Sin componentes" getRowId={(x) => String(x.idCom)} filaClase={claseFilaStock} seleccionada="1" onSeleccionar={vi.fn()} />)
    const fila = screen.getByRole('row', { name: /^lcd-x/ })
    expect(fila).toHaveAttribute('data-state', 'selected')
    expect(fila).toHaveClass('opacity-45', 'data-[state=selected]:bg-azul-medio', 'data-[state=selected]:text-crema')
    expect(fila).not.toHaveClass('data-[state=selected]:bg-transparent')
    expect(screen.getByText('15/08/2026')).toHaveClass(CREMA_EN_FILA_SELECCIONADA)
  })
  it('la última fila conserva la franja izquierda: el cuerpo de la tabla solo quita el borde inferior de la última', () => {
    montar([c({ idCom: 1, stock: 5 }), c({ idCom: 2, tipo: 'bat-x', stock: 0 })])
    const filas = screen.getAllByRole('row').slice(1)
    const ultima = filas[filas.length - 1]
    expect(ultima).toHaveClass('border-l-8', 'border-l-rojo-sin-stock')
    const cuerpo = ultima.closest('tbody')
    expect(cuerpo).toHaveClass('[&_tr:last-child]:border-b-0')
    expect(cuerpo).not.toHaveClass('[&_tr:last-child]:border-0')
  })
  it('una fila de grupo muestra el nombre de todos y "stock compartido" en gris pequeño, que se aclara al seleccionarse', () => {
    montar([c({ idCom: 1, tipo: 'bat-x' }), c({ idCom: 2, tipo: 'bat-y', idComMaster: 1 })])
    expect(screen.getAllByRole('row')).toHaveLength(2)
    const celda = document.querySelector('[data-columna="componente"]') as HTMLElement
    expect(within(celda).getByText('bat-x / bat-y')).toBeInTheDocument()
    expect(within(celda).getByText('stock compartido')).toHaveClass('text-[11px]', 'text-azul-gris', CREMA_EN_FILA_SELECCIONADA)
    expect(within(celda).getByText('bat-x / bat-y').parentElement).toHaveClass('whitespace-normal')
  })
  it('una fila suelta no lleva "stock compartido"', () => {
    montar([c({})])
    expect(screen.queryByText('stock compartido')).not.toBeInTheDocument()
  })
  it('parámetros hacia Pedidos: los tres estados del pipeline y el buscador con el tipo', () => {
    expect(parametrosPedidos(c({ tipo: 'lcd x pro' }))).toBe('estados=pendiente%2Cen+camino%2Cparcial&buscar=lcd+x+pro')
  })
  // formatear lee el ISO sin zona como UTC y lo pinta en Europe/Madrid, como FechaUtils.formatear en exportarStock: 10:30 UTC = 12:30 CEST.
  it('CSV de un grupo: una fila con el nombre de todos en "Tipo"', () => {
    const [grupo] = filas([c({ idCom: 1, tipo: 'bat-x' }), c({ idCom: 2, tipo: 'bat-y', idComMaster: 1 })])
    expect(filaCsvStock(grupo)[0]).toBe('bat-x / bat-y')
  })
  it('CSV: cabeceras exactas del JavaFX, tipo, estado del semáforo y fecha de registro con hora (Madrid)', () => {
    expect(CABECERAS_CSV_STOCK).toEqual(['Tipo', 'Stock', 'Stock mínimo', 'Estado', 'En camino', 'Fecha registro'])
    expect(filaCsvStock(filas([c({ stock: 0, enCamino: 4 })])[0])).toEqual(['lcd-x', '0', '2', 'Sin stock', '4', '01/09/2026 12:30'])
  })
})

describe('columnas de Stock actual en ajuste fluido (adaptación a web)', () => {
  it('Componente absorbe el ancho sobrante y las de números, fecha y badge son fijas (maxSize = size, que sigue siendo el del FXML)', () => {
    expect(repartoFluido(crearColumnasStock({ onEnCamino: vi.fn() }))).toEqual({
      fijas: ['enStock', 'enCamino', 'stockMinimo', 'ultimoPedido', 'estado'],
      absorben: ['componente'],
      otras: [],
    })
  })
  it('con previsión: dos columnas entre "Stock Mínimo" y "Último pedido"; el 0 en gris y "—" en desactivadas', () => {
    render(<DataTable columns={crearColumnasStock({ onEnCamino: vi.fn(), conPrevision: true })} data={filas([
      c({ consumoDiario: 0.31, pedir60: 16 }),
      c({ idCom: 3, tipo: 'bat-z', consumoDiario: 0, pedir60: 0 }),
      c({ idCom: 2, tipo: 'bat-x', activo: false }),
    ])} vacio="Sin componentes" getRowId={(x) => String(x.idCom)} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Componente', 'En Stock', 'En Camino', 'Stock Mínimo', 'Consumo/día', 'Pedir 60 d', 'Último pedido', 'Estado'])
    const pedir = (id: string) => screen.getAllByRole('row').slice(1).find((f) => within(f).queryByText(id))!.querySelector('[data-columna="pedir60"]')!
    expect(within(screen.getAllByRole('row')[1]).getByText('0,31')).toBeInTheDocument()
    expect(within(pedir('lcd-x') as HTMLElement).getByText('16')).toHaveClass('font-bold')
    expect(within(pedir('bat-z') as HTMLElement).getByText('0')).toHaveClass('text-texto-vacio')
    expect(pedir('bat-x')).toHaveTextContent('—')
  })
  it('sin previsión (TECNICO) las columnas son las de siempre', () => {
    render(<DataTable columns={crearColumnasStock({ onEnCamino: vi.fn() })} data={filas([base])} vacio="Sin componentes" />)
    expect(screen.queryByRole('columnheader', { name: 'Consumo/día' })).not.toBeInTheDocument()
  })
  it('CSV: con previsión añade las dos columnas al final', () => {
    expect(cabecerasCsvStock(false)).toEqual(CABECERAS_CSV_STOCK)
    expect(cabecerasCsvStock(true)).toEqual([...CABECERAS_CSV_STOCK, 'Consumo/día', 'Pedir 60 d'])
    const fila = filaCsvStock(filas([c({ consumoDiario: 0.31, pedir60: 16 })])[0], true)
    expect(fila.slice(-2)).toEqual(['0,31', '16'])
    expect(filaCsvStock(filas([c({ activo: false })])[0], true).slice(-2)).toEqual(['—', '—'])
    expect(filaCsvStock(filas([base])[0])).toHaveLength(CABECERAS_CSV_STOCK.length)
  })
})
