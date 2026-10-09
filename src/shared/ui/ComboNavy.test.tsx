import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ComboNavy, siguienteAbiertoOMismo, type OpcionCombo } from './ComboNavy'

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
  it('con títulos de bloque, el alto de la lista cuenta también las filas de título (2·28 + 2·22 + 8)', async () => {
    const opciones: OpcionCombo[] = [
      { valor: '1', etiqueta: 'Black', grupo: 'SIM' },
      { valor: '2', etiqueta: 'Teal', grupo: 'SIM' },
      { valor: '3', etiqueta: 'Black', grupo: 'eSIM' },
      { valor: '4', etiqueta: 'Teal', grupo: 'eSIM' },
    ]
    render(<ComboNavy valor={null} opciones={opciones} onChange={() => {}} textoVacio="— Elige color —" ancho={170} visibles={2} aria-label="SKU de Chasis" />)
    await userEvent.click(screen.getByRole('combobox', { name: 'SKU de Chasis' }))
    expect(screen.getByRole('listbox', { name: 'SKU de Chasis' }).style.maxHeight).toBe('108px')
  })
  it('con ancho="full" llena el contenedor (w-full) en vez de un ancho fijo en px', async () => {
    render(<ComboNavy valor={null} opciones={MODELOS} onChange={() => {}} textoVacio="—" ancho="full" aria-label="Filtrar por modelo" />)
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    expect(combo).toHaveClass('w-full')
    expect(combo).not.toHaveAttribute('style')
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
  it('muestra de color con borde en la lista y en el botón; title y etiqueta propia del botón', async () => {
    const opciones: OpcionCombo[] = [
      { valor: '1', etiqueta: 'Ultramarine', etiquetaBoton: 'chai16ultramarine', titulo: 'chai16ultramarine', color: '#9AADF6' },
      { valor: '2', etiqueta: 'fucsia', titulo: 'chai16fucsia', color: null },
      { valor: '3', etiqueta: 'Teal', titulo: 'chai16teal', color: '#B0D4D2' },
    ]
    render(<ComboNavy valor="1" opciones={opciones} onChange={() => {}} textoVacio="— Elige color —" ancho={170} aria-label="SKU de Chasis" />)
    const combo = screen.getByRole('combobox', { name: 'SKU de Chasis' })
    expect(combo).toHaveTextContent('chai16ultramarine')
    // el botón y la opción activa son navy: el círculo lleva el borde claro para que un negro no se pierda
    expect(within(combo).getByTestId('muestra-color')).toHaveStyle({ backgroundColor: '#9AADF6' })
    expect(within(combo).getByTestId('muestra-color')).toHaveClass('border-white/70')
    await userEvent.click(combo)
    const lista = screen.getByRole('listbox', { name: 'SKU de Chasis' })
    const ultra = within(lista).getByRole('button', { name: 'Ultramarine' })
    expect(ultra).toHaveAttribute('title', 'chai16ultramarine')
    expect(within(ultra).getByTestId('muestra-color')).toHaveClass('border-white/70')
    expect(within(ultra).getByTestId('muestra-color')).not.toHaveClass('border-black/25')
    // una opción con color que no es la activa va sobre fondo blanco: borde oscuro fino
    const teal = within(lista).getByRole('button', { name: 'Teal' })
    expect(within(teal).getByTestId('muestra-color')).toHaveClass('border-black/25')
    const desconocido = within(lista).getByRole('button', { name: 'fucsia' })
    expect(within(desconocido).getByTestId('muestra-color')).toHaveAttribute('data-desconocido', 'true')
  })
  it('el botón cerrado lleva como title el titulo de la opción elegida; sin titulo, sin atributo title', () => {
    const opciones: OpcionCombo[] = [
      { valor: '1', etiqueta: 'Black', etiquetaBoton: 'chai16problacktitaniumesim', titulo: 'chai16problacktitaniumesim' },
      { valor: '2', etiqueta: 'bati13' },
    ]
    const { rerender } = render(<ComboNavy valor="1" opciones={opciones} onChange={() => {}} textoVacio="— Elige color —" ancho={240} aria-label="SKU de Chasis" />)
    expect(screen.getByRole('combobox', { name: 'SKU de Chasis' })).toHaveAttribute('title', 'chai16problacktitaniumesim')
    rerender(<ComboNavy valor="2" opciones={opciones} onChange={() => {}} textoVacio="— Elige color —" ancho={240} aria-label="SKU de Chasis" />)
    expect(screen.getByRole('combobox', { name: 'SKU de Chasis' })).not.toHaveAttribute('title')
    rerender(<ComboNavy valor={null} opciones={opciones} onChange={() => {}} textoVacio="— Elige color —" ancho={240} aria-label="SKU de Chasis" />)
    expect(screen.getByRole('combobox', { name: 'SKU de Chasis' })).not.toHaveAttribute('title')
  })
  it('bloques con título antes de la primera opción de cada grupo, y opciones resaltadas', async () => {
    const opciones: OpcionCombo[] = [
      { valor: '1', etiqueta: 'Black', grupo: 'SIM', color: '#232426' },
      { valor: '2', etiqueta: 'Teal', grupo: 'SIM', color: '#B0D4D2', resaltada: true },
      { valor: '3', etiqueta: 'Black', grupo: 'eSIM', color: '#232426' },
      { valor: '4', etiqueta: 'Teal', grupo: 'eSIM', color: '#B0D4D2', resaltada: true },
    ]
    render(<ComboNavy valor={null} opciones={opciones} onChange={() => {}} textoVacio="— Elige color —" ancho={170} aria-label="SKU de Chasis" />)
    await userEvent.click(screen.getByRole('combobox', { name: 'SKU de Chasis' }))
    const lista = screen.getByRole('listbox', { name: 'SKU de Chasis' })
    expect(Array.from(lista.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['SIM', 'Black', 'Teal', 'eSIM', 'Black', 'Teal'])
    expect(within(lista).getAllByRole('option')).toHaveLength(4)
    const resaltadas = within(lista).getAllByRole('option').filter((o) => o.getAttribute('data-resaltada') === 'true')
    expect(resaltadas.map((o) => o.textContent)).toEqual(['Teal', 'Teal'])
    expect(within(resaltadas[0]).getByRole('button')).toHaveClass('ring-verde-ok')
  })
  it('sin los campos nuevos se pinta igual: sin muestras, sin títulos ni resaltado', async () => {
    render(<ComboNavy valor="101" opciones={SKUS} onChange={() => {}} textoVacio="—" ancho={170} aria-label="SKU de Batería" />)
    const combo = screen.getByRole('combobox', { name: 'SKU de Batería' })
    expect(within(combo).queryByTestId('muestra-color')).not.toBeInTheDocument()
    await userEvent.click(combo)
    const lista = screen.getByRole('listbox', { name: 'SKU de Batería' })
    expect(within(lista).queryAllByTestId('muestra-color')).toHaveLength(0)
    expect(lista.querySelectorAll('li')).toHaveLength(3)
    expect(lista.querySelector('[data-resaltada]')).toBeNull()
  })
})

describe('siguienteAbiertoOMismo (el guardia de cambiarAbierto)', () => {
  // Task 16 va a contar interacciones abiertas con onOpenChange: un `false` de más deja el contador en negativo,
  // el espejo del `true` sin su `false` que ya se arregló (ver el comentario de abiertoRef en ComboNavy).
  it('no hay cambio real que emitir si se pide lo mismo que ya está (abierto o cerrado)', () => {
    expect(siguienteAbiertoOMismo(false, false, false)).toBeNull()
    expect(siguienteAbiertoOMismo(true, false, true)).toBeNull()
  })
  it('camino (a): "abrir" estando disabled y ya cerrado no emite un false fantasma (no hubo apertura)', () => {
    expect(siguienteAbiertoOMismo(true, true, false)).toBeNull()
  })
  it('abrir de verdad, cerrar de verdad y "abrir" con disabled estando ya abierto sí son cambios reales', () => {
    expect(siguienteAbiertoOMismo(true, false, false)).toBe(true)
    expect(siguienteAbiertoOMismo(false, false, true)).toBe(false)
    // disabled pasa a true con la lista abierta: no lo dispara la UI (el trigger deshabilitado no reabre), pero el
    // guardia por sí solo sigue viendo "cerrar" como cambio real si algo llegase a pedirlo.
    expect(siguienteAbiertoOMismo(true, true, true)).toBe(false)
  })
})
