import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ComboNavy, type OpcionCombo } from './ComboNavy'

const MODELOS: OpcionCombo[] = [{ valor: '13', etiqueta: 'iPhone 13' }, { valor: '13promax', etiqueta: 'iPhone 13 Pro Max' }, { valor: '14', etiqueta: 'iPhone 14' }]
const SKUS: OpcionCombo[] = [{ valor: '101', etiqueta: 'bati13' }, { valor: '102', etiqueta: 'bati14', clase: 'text-rojo-sin-stock' }, { valor: '103', etiqueta: 'bati13promax', clase: 'text-fila-solicitud-brd' }]

function Demo({ inicial = null, alCambiar, alAbrir, opciones = MODELOS }: { inicial?: string | null; alCambiar?: (v: string) => void; alAbrir?: (a: boolean) => void; opciones?: OpcionCombo[] }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return <ComboNavy valor={valor} opciones={opciones} onChange={(v) => { setValor(v); alCambiar?.(v) }} onOpenChange={alAbrir} textoVacio="— Selecciona modelo —" ancho={180} aria-label="Filtrar por modelo" />
}

describe('ComboNavy (combo navy de selección única)', () => {
  it('muestra textoVacio, abre, elige, llama a onChange y se cierra', async () => {
    const alCambiar = vi.fn()
    render(<Demo alCambiar={alCambiar} />)
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    expect(combo).toHaveTextContent('— Selecciona modelo —')
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await userEvent.click(combo)
    const lista = screen.getByRole('listbox', { name: 'Filtrar por modelo' })
    expect(within(lista).getAllByRole('option').map((o) => o.textContent)).toEqual(['iPhone 13', 'iPhone 13 Pro Max', 'iPhone 14'])
    await userEvent.click(within(lista).getByRole('button', { name: 'iPhone 13 Pro Max' }))
    expect(alCambiar).toHaveBeenCalledTimes(1)
    expect(alCambiar).toHaveBeenCalledWith('13promax')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('iPhone 13 Pro Max')
  })
  it('la opción activa va marcada (aria-selected y fondo navy)', async () => {
    render(<Demo inicial="14" />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect(screen.getByRole('option', { name: 'iPhone 14' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'iPhone 13' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('button', { name: 'iPhone 14' })).toHaveClass('bg-azul-noche', 'text-superficie')
    expect(screen.getByRole('button', { name: 'iPhone 13' })).toHaveClass('text-azul-noche')
  })
  it('disabled no abre', async () => {
    render(<ComboNavy valor="13" opciones={MODELOS} onChange={() => {}} textoVacio="— Selecciona modelo —" ancho={180} disabled aria-label="Filtrar por modelo" />)
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    expect(combo).toBeDisabled()
    await userEvent.click(combo)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('aplica la clase de color de la opción en la lista y en el botón', async () => {
    render(<ComboNavy valor="102" opciones={SKUS} onChange={() => {}} textoVacio="—" ancho={170} tamanoTexto={11} visibles={8} aria-label="SKU de Batería" />)
    const combo = screen.getByRole('combobox', { name: 'SKU de Batería' })
    expect(combo).toHaveClass('text-rojo-sin-stock', 'text-[11px]')
    expect(combo).not.toHaveClass('text-texto-nav-activo')
    await userEvent.click(combo)
    expect(screen.getByRole('button', { name: 'bati13promax' })).toHaveClass('text-fila-solicitud-brd')
    expect(screen.getByRole('button', { name: 'bati13' })).toHaveClass('text-azul-noche')
    // la activa se pinta en blanco sobre navy aunque tenga clase de stock
    expect(screen.getByRole('button', { name: 'bati14' })).toHaveClass('bg-azul-noche', 'text-superficie')
  })
  it('es la píldora navy con el ancho pedido; la lista limita su alto a las filas visibles', async () => {
    render(<ComboNavy valor={null} opciones={SKUS} onChange={() => {}} textoVacio="—" ancho={170} tamanoTexto={11} visibles={2} aria-label="SKU de Batería" />)
    const combo = screen.getByRole('combobox', { name: 'SKU de Batería' })
    expect(combo).toHaveTextContent('—')
    expect(combo).toHaveClass('rounded-3xl', 'bg-azul-noche', 'font-bold', 'text-texto-nav-activo')
    expect(combo).toHaveStyle({ width: '170px' })
    expect(combo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(combo)
    const lista = screen.getByRole('listbox', { name: 'SKU de Batería' })
    expect(lista).toHaveStyle({ maxHeight: '64px' })
    expect(lista.closest('[data-slot="popover-content"]')).toHaveClass('border-fila-sep', 'bg-superficie', 'rounded-lg')
  })
  it('avisa con onOpenChange al abrir, al elegir una opción y al cerrar sin elegir', async () => {
    // El aviso lo necesita quien congela algo mientras el desplegable está abierto (el sondeo de una tabla, que al
    // recargar movería la fila bajo el cursor). Elegir una opción cierra el combo a mano, así que también avisa.
    const abierto = vi.fn()
    render(<Demo alAbrir={abierto} />)
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    await userEvent.click(combo)
    expect(abierto.mock.calls).toEqual([[true]])
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'iPhone 14' }))
    expect(abierto.mock.calls).toEqual([[true], [false]])
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    await userEvent.keyboard('{Escape}')
    expect(abierto.mock.calls).toEqual([[true], [false], [true], [false]])
  })
  it('desmontar con la lista abierta emite el false que falta (si no, quien congela el sondeo por D4 se queda pegado)', async () => {
    const abierto = vi.fn()
    const { unmount } = render(<Demo alAbrir={abierto} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect(abierto.mock.calls).toEqual([[true]])
    unmount()
    expect(abierto.mock.calls).toEqual([[true], [false]])
  })
  it('desmontar con la lista cerrada no emite nada de más', () => {
    const abierto = vi.fn()
    const { unmount } = render(<Demo alAbrir={abierto} />)
    unmount()
    expect(abierto).not.toHaveBeenCalled()
  })
  it('sin onOpenChange el combo se comporta igual (la prop es opcional)', async () => {
    render(<Demo />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('un valor que no está entre las opciones se muestra como vacío', () => {
    render(<ComboNavy valor="99" opciones={MODELOS} onChange={() => {}} textoVacio="— Selecciona modelo —" ancho={180} aria-label="Filtrar por modelo" />)
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('— Selecciona modelo —')
  })
})
