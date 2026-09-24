import { getDefaultNormalizer, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { CREMA_EN_FILA_SELECCIONADA, DataTable } from '@/shared/ui/DataTable'
import { BadgeEstadoStock } from './BadgeEstadoStock'
import { CABECERAS_CSV_STOCK, claseFilaStock, crearColumnasStock, filaCsvStock, parametrosPedidos } from './columnas'

const base: Componente = { idCom: 1, tipo: 'lcd-x', fechaRegistro: '2026-09-01T10:30:00', stock: 5, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null }
const c = (o: Partial<Componente>): Componente => ({ ...base, ...o })

function montar(filas: Componente[], onEnCamino = vi.fn()) {
  render(<DataTable columns={crearColumnasStock({ onEnCamino })} data={filas} vacio="Sin componentes" getRowId={(x) => String(x.idCom)} filaClase={claseFilaStock} />)
  return onEnCamino
}

describe('columnas de Stock actual', () => {
  it('pinta las seis cabeceras en orden y con los anchos del FXML', () => {
    const { container } = render(<DataTable columns={crearColumnasStock({ onEnCamino: vi.fn() })} data={[base]} vacio="Sin componentes" />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Componente', 'En Stock', 'En Camino', 'Stock Mínimo', 'Último pedido', 'Estado'])
    const cols = container.querySelectorAll('col')
    expect(cols[0]).toHaveStyle({ width: '230px' })
    expect(cols[5]).toHaveStyle({ width: '100px' })
  })
  it('un compartido lleva el sufijo con dos espacios; sin último pedido pinta "—" y con fecha dd/MM/yyyy', () => {
    // 09:00 UTC = 11:00 en Madrid: la hora no cruza medianoche al convertir, así que el día es el mismo en UTC y en Madrid
    // (formatear pasa a Madrid, decisión 8; entre las 22:00 y las 24:00 UTC la web pintaría el día siguiente).
    montar([c({ idComMaster: 9, ultimoPedido: '2026-08-15T09:00:00' })])
    expect(screen.getByText('lcd-x  (compartido)', { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument()
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
  it('clase de fila: borde por estado y opacidad en desactivadas, que no se ponen azules', () => {
    expect(claseFilaStock(c({ stock: 2 }))).toContain('border-l-fila-solicitud-brd')
    expect(claseFilaStock(c({ stock: 0 }))).toContain('border-l-rojo-sin-stock')
    expect(claseFilaStock(base)).toContain('border-l-transparent')
    const inactiva = claseFilaStock(c({ activo: false }))
    expect(inactiva).toContain('opacity-45')
    expect(inactiva).toContain('data-[state=selected]:bg-transparent')
  })
  it('en una fila desactivada "Último pedido" no lleva la crema de la fila seleccionada (no se pone azul)', () => {
    montar([c({ activo: false, ultimoPedido: '2026-08-15T09:00:00' })])
    expect(screen.getByText('15/08/2026')).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
  })
  it('parámetros hacia Pedidos: los tres estados del pipeline y el buscador con el tipo', () => {
    expect(parametrosPedidos(c({ tipo: 'lcd x pro' }))).toBe('estados=pendiente%2Cen+camino%2Cparcial&buscar=lcd+x+pro')
  })
  // formatear lee el ISO sin zona como UTC y lo pinta en Europe/Madrid, como FechaUtils.formatear en exportarStock: 10:30 UTC = 12:30 CEST.
  it('CSV: cabeceras exactas del JavaFX, tipo sin sufijo, estado del semáforo y fecha de registro con hora (Madrid)', () => {
    expect(CABECERAS_CSV_STOCK).toEqual(['Tipo', 'Stock', 'Stock mínimo', 'Estado', 'En camino', 'Fecha registro'])
    expect(filaCsvStock(c({ idComMaster: 9, stock: 0, enCamino: 4 }))).toEqual(['lcd-x', '0', '2', 'Sin stock', '4', '01/09/2026 12:30'])
  })
})
