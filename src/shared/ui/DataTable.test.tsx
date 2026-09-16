import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import { ContextMenuItem } from './context-menu'
import { anchosEstirados, DataTable } from './DataTable'

type Fila = { id: string; nombre: string; nota: string }

const DATOS: Fila[] = [
  { id: '1', nombre: 'WEB', nota: 'a' },
  { id: '2', nombre: 'OTRO', nota: 'b' },
  { id: '3', nombre: 'AMAZON', nota: 'c' },
]
const COLUMNAS: ColumnDef<Fila, string>[] = [
  { accessorKey: 'nombre', header: 'Nombre', size: 340 },
  { accessorKey: 'nota', header: 'Nota', size: 130 },
]

describe('DataTable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fija los anchos con un colgroup y sin columna de relleno (ajuste fijo)', () => {
    const { container } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="Sin filas" />)
    const cols = container.querySelectorAll('col')
    expect(cols).toHaveLength(2)
    expect(cols[0]).toHaveStyle({ width: '340px' })
    expect(cols[1]).toHaveStyle({ width: '130px' })
    expect(container.querySelector('table')).toHaveStyle({ width: '470px' })
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(within(screen.getByRole('row', { name: /^WEB a$/ })).getAllByRole('cell')).toHaveLength(2)
  })

  it('en ajuste estirar reparte porcentajes sobre la suma y fija el mínimo', () => {
    const { container } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="Sin filas" ajuste="estirar" />)
    const cols = container.querySelectorAll('col')
    expect(cols[0].style.width).toMatch(/^72\.34/)
    expect(cols[1].style.width).toMatch(/^27\.65/)
    expect(container.querySelector('table')).toHaveStyle({ minWidth: '470px' })
    expect(container.querySelector('table')).toHaveClass('w-full')
  })

  it('con altoFila cada fila de datos mide ese alto (setFixedCellSize); sin él las filas no llevan alto', () => {
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" altoFila={44} />)
    const [cabecera, ...filas] = screen.getAllByRole('row')
    expect(filas).toHaveLength(3)
    filas.forEach((f) => expect(f).toHaveStyle({ height: '44px' }))
    expect(cabecera.style.height).toBe('')
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" />)
    screen.getAllByRole('row').forEach((f) => expect(f.style.height).toBe(''))
  })

  it('en modo virtual la ventana de filas pintadas se calcula con altoFila', () => {
    const muchas: Fila[] = Array.from({ length: 500 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))
    const { unmount } = render(<DataTable columns={COLUMNAS} data={muchas} vacio="" getRowId={(f) => f.id} umbralVirtual={100} />)
    const conAltoEstimado = screen.getAllByRole('row').length - 1
    unmount()
    render(<DataTable columns={COLUMNAS} data={muchas} vacio="" getRowId={(f) => f.id} umbralVirtual={100} altoFila={88} />)
    expect(screen.getAllByRole('row').length - 1).toBeLessThan(conAltoEstimado)
  })

  it('el mensaje de vacío ocupa todas las columnas que se pintan', () => {
    render(<DataTable columns={COLUMNAS} data={[]} vacio="Sin filas" />)
    expect(screen.getByRole('cell', { name: 'Sin filas' })).toHaveAttribute('colspan', '2')
  })

  it('selecciona con clic, mueve con las flechas y abre con Enter o doble clic', async () => {
    const onSeleccionar = vi.fn()
    const onAbrir = vi.fn()
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada={null} onSeleccionar={onSeleccionar} onAbrir={onAbrir} />)
    await userEvent.click(screen.getByText('OTRO'))
    expect(onSeleccionar).toHaveBeenLastCalledWith('2')
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="2" onSeleccionar={onSeleccionar} onAbrir={onAbrir} />)
    const fila = screen.getByRole('row', { name: /^OTRO b$/ })
    expect(fila).toHaveAttribute('data-state', 'selected')
    expect(fila).toHaveAttribute('aria-selected', 'true')
    expect(fila).toHaveClass('data-[state=selected]:bg-azul-medio')
    const contenedor = screen.getByRole('table').parentElement!
    contenedor.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onSeleccionar).toHaveBeenLastCalledWith('3')
    await userEvent.keyboard('{ArrowUp}')
    expect(onSeleccionar).toHaveBeenLastCalledWith('1')
    await userEvent.keyboard('{Enter}')
    expect(onAbrir).toHaveBeenLastCalledWith(DATOS[1])
    await userEvent.dblClick(screen.getByText('AMAZON'))
    expect(onAbrir).toHaveBeenLastCalledWith(DATOS[2])
  })

  it('las clases de fila de la página ganan a las de la tabla (cursor, hover) sin perder el estilo de la seleccionada', () => {
    render(
      <DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="2" onSeleccionar={() => {}}
        filaClase={() => 'cursor-pointer hover:bg-fila-maestro-bg'} />,
    )
    const fila = screen.getByRole('row', { name: /^OTRO b$/ })
    expect(fila).toHaveClass('cursor-pointer', 'hover:bg-fila-maestro-bg', 'data-[state=selected]:bg-azul-medio', 'data-[state=selected]:text-crema')
    expect(fila).not.toHaveClass('cursor-default')
    expect(fila).not.toHaveClass('hover:bg-muted/50')
  })

  it('el menú contextual recibe la columna pulsada y puede resaltar la celda', async () => {
    const { container } = render(
      <DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id}
        menuFila={(f, celda) => <ContextMenuItem onSelect={celda.resaltar}>{`copiar ${f.nombre} ${celda.columnaId}`}</ContextMenuItem>} />,
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('b') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'copiar OTRO nota' }))
    const celda = within(screen.getByRole('row', { name: /^OTRO b$/ })).getAllByRole('cell')[1]
    expect(celda).toHaveClass('bg-fila-modificada-bg')
    expect(container.querySelector('tbody')).not.toBeNull()
  })

  it('ordena por clic en la cabecera solo si se pide', async () => {
    render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" ordenacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Nombre' }))
    const nombres = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)
    expect(nombres).toEqual(['AMAZON', 'OTRO', 'WEB'])
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('sin ordenación las cabeceras no son botones', () => {
    render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" />)
    expect(screen.queryByRole('button', { name: 'Nombre' })).not.toBeInTheDocument()
  })

  it('si la selección cambia desde fuera, deja la fila arriba del todo (calco de tabla.scrollTo(i) del enlace "Id Rep. Anterior")', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada={null} onSeleccionar={() => {}} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start' })
    expect(scrollIntoView.mock.instances[0]).toBe(screen.getByRole('row', { name: /^AMAZON c$/ }))
  })

  it('con filasContexto, una selección externa deja esas filas por encima, o la primera fila si no hay tantas (restauración del maestro de IMEIs)', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const diez: Fila[] = Array.from({ length: 10 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))
    const tabla = (seleccionada: string | null) => (
      <DataTable columns={COLUMNAS} data={diez} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={() => {}} filasContexto={3} />
    )
    const { rerender } = render(tabla(null))
    rerender(tabla('7'))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start' })
    expect(scrollIntoView.mock.instances[0]).toBe(screen.getByRole('row', { name: /^F4 x$/ }))
    rerender(tabla('2'))
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start' })
    expect(scrollIntoView.mock.instances[1]).toBe(screen.getByRole('row', { name: /^F0 x$/ }))
  })

  it('una selección hecha en la propia tabla (clic, clic derecho) no desplaza; las flechas desplazan lo justo', async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    function TablaConEstado() {
      const [seleccionada, setSeleccionada] = useState<string | null>(null)
      return <DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={setSeleccionada} filasContexto={3} />
    }
    render(<TablaConEstado />)
    await userEvent.click(screen.getByText('OTRO'))
    expect(screen.getByRole('row', { name: /^OTRO b$/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('AMAZON') })
    expect(screen.getByRole('row', { name: /^AMAZON c$/ })).toHaveAttribute('aria-selected', 'true')
    expect(scrollIntoView).not.toHaveBeenCalled()
    screen.getByRole('table').parentElement!.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('row', { name: /^OTRO b$/ })).toHaveAttribute('aria-selected', 'true')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' })
    expect(scrollIntoView.mock.instances[0]).toBe(screen.getByRole('row', { name: /^OTRO b$/ }))
  })

  it('en modo virtual una selección externa desplaza siempre (aunque la fila ya se vea) y con el contexto pedido', () => {
    const muchas: Fila[] = Array.from({ length: 500 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))
    const tabla = (seleccionada: string | null, filasContexto?: number) => (
      <DataTable columns={COLUMNAS} data={muchas} vacio="" getRowId={(f) => f.id} umbralVirtual={100} seleccionada={seleccionada} onSeleccionar={() => {}} filasContexto={filasContexto} />
    )
    const { rerender } = render(tabla(null))
    // jsdom no hace layout: se simula un contenedor de 600 px con las 500 filas de 44 px por debajo de la cabecera.
    const contenedor = screen.getByRole('table').parentElement!
    const scrollTo = vi.fn()
    Object.assign(contenedor, { scrollTo })
    Object.defineProperty(contenedor, 'scrollHeight', { configurable: true, value: 40 + 500 * 44 })
    Object.defineProperty(contenedor, 'clientHeight', { configurable: true, value: 600 })
    rerender(tabla('2'))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2 * 44, behavior: 'auto' })
    rerender(tabla('300', 3))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 297 * 44, behavior: 'auto' })
  })

  it('un refresco de datos con la misma selección no vuelve a desplazar la tabla', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    rerender(<DataTable columns={COLUMNAS} data={[...DATOS]} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="1" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('si la selección llega antes que las filas, desplaza cuando aparecen', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { rerender } = render(<DataTable columns={COLUMNAS} data={[]} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('por encima del umbral solo pinta las filas visibles (virtualización)', () => {
    const muchas: Fila[] = Array.from({ length: 500 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))
    render(<DataTable columns={COLUMNAS} data={muchas} vacio="" getRowId={(f) => f.id} umbralVirtual={100} />)
    const filas = screen.getAllByRole('row').length - 1
    expect(filas).toBeGreaterThan(5)
    expect(filas).toBeLessThan(100)
    expect(screen.getByText('F0')).toBeInTheDocument()
    expect(screen.queryByText('F499')).not.toBeInTheDocument()
  })
})

describe('anchosEstirados (aplicarAnchosDetalle: prefWidth = max(min, min·u), acotado a [min, maxWidth] columna a columna)', () => {
  const suma = (anchos: number[]) => anchos.reduce((a, b) => a + b, 0)

  it('sin topes estira cada columna en proporción a su mínimo hasta llenar el ancho (el tope por defecto de TanStack no cuenta)', () => {
    expect(anchosEstirados([100, 200, 300], [undefined, Number.MAX_SAFE_INTEGER, undefined], 1200)).toEqual([200, 400, 600])
  })

  it('una columna que llega a su tope se queda en él y lo que cede queda en blanco, sin repartirlo entre las demás', () => {
    const anchos = anchosEstirados([100, 200, 300], [undefined, 300, undefined], 1200)
    expect(anchos).toEqual([200, 300, 600])
    expect(suma(anchos)).toBe(1100)
  })

  it('con menos ancho que la suma de mínimos todas se quedan en su mínimo (y la tabla hace scroll horizontal)', () => {
    expect(anchosEstirados([100, 200, 300], [150, 250, undefined], 500)).toEqual([100, 200, 300])
  })

  it('con todas las columnas topadas la tabla mide la suma de los topes', () => {
    const anchos = anchosEstirados([100, 200, 300], [150, 250, 350], 1200)
    expect(anchos).toEqual([150, 250, 350])
    expect(suma(anchos)).toBe(750)
  })

  it('un tope por debajo del mínimo deja el mínimo, como boundedSize(ancho, min, max) del JavaFX', () => {
    expect(anchosEstirados([100, 200], [80, undefined], 600)).toEqual([100, 400])
  })

  it('no redondea: los anchos fraccionarios suman el ancho disponible', () => {
    const anchos = anchosEstirados([110, 130, 100], [undefined, undefined, undefined], 1000)
    expect(anchos[0]).toBeCloseTo(323.5294, 4)
    expect(anchos[1]).toBeCloseTo(382.3529, 4)
    expect(anchos[2]).toBeCloseTo(294.1176, 4)
    expect(suma(anchos)).toBeCloseTo(1000, 9)
  })
})

describe('DataTable — ajuste estirar con topes (maxSize de la columna)', () => {
  const COLUMNAS_CON_TOPE: ColumnDef<Fila, string>[] = [
    { accessorKey: 'nombre', header: 'Nombre', size: 300 },
    { accessorKey: 'nota', header: 'Nota', size: 100, maxSize: 150 },
  ]
  // jsdom no hace layout ni avisa de tamaños: ResizeObserver controlable desde el test.
  type Observador = { cb: ResizeObserverCallback; observados: Element[]; desconectado: boolean }
  const observadores: Observador[] = []
  class ResizeObserverFalso {
    private readonly o: Observador
    constructor(cb: ResizeObserverCallback) {
      this.o = { cb, observados: [], desconectado: false }
      observadores.push(this.o)
    }
    observe(el: Element) { this.o.observados.push(el) }
    unobserve() {}
    disconnect() { this.o.desconectado = true }
  }
  function medirContenedor(ancho: number) {
    act(() => {
      for (const o of observadores.filter((x) => !x.desconectado)) {
        o.cb(o.observados.map((target) => ({ target, contentRect: { width: ancho } }) as unknown as ResizeObserverEntry), {} as ResizeObserver)
      }
    })
  }

  beforeEach(() => {
    observadores.length = 0
    vi.stubGlobal('ResizeObserver', ResizeObserverFalso)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mide el ancho del contenedor (redondeado hacia abajo) y pinta los anchos en px con la regla del JavaFX', () => {
    const { container } = render(<DataTable columns={COLUMNAS_CON_TOPE} data={DATOS} vacio="" ajuste="estirar" />)
    const tabla = container.querySelector('table')!
    expect(observadores.flatMap((o) => o.observados)).toEqual([tabla.parentElement])
    medirContenedor(800.7) // u = 800 / 400 = 2 → Nombre 600; Nota 200, topada a 150; los 50 px restantes quedan en blanco
    const cols = container.querySelectorAll('col')
    expect(cols[0]).toHaveStyle({ width: '600px' })
    expect(cols[1]).toHaveStyle({ width: '150px' })
    expect(tabla).toHaveStyle({ width: '750px', minWidth: '400px' })
    expect(tabla).not.toHaveClass('w-full')
    medirContenedor(500) // u = 1,25 → 375 y 125 (por debajo del tope)
    expect(cols[0]).toHaveStyle({ width: '375px' })
    expect(cols[1]).toHaveStyle({ width: '125px' })
    expect(tabla).toHaveStyle({ width: '500px', minWidth: '400px' })
  })

  it('mientras el contenedor mide 0 (jsdom, tabla oculta) conserva los porcentajes', () => {
    const { container } = render(<DataTable columns={COLUMNAS_CON_TOPE} data={DATOS} vacio="" ajuste="estirar" />)
    medirContenedor(0)
    const cols = container.querySelectorAll('col')
    expect(cols[0].style.width).toBe('75%')
    expect(cols[1].style.width).toBe('25%')
    expect(container.querySelector('table')).toHaveStyle({ minWidth: '400px' })
    expect(container.querySelector('table')).toHaveClass('w-full')
  })

  it('sin columnas con tope no mide el contenedor y conserva los porcentajes', () => {
    const { container } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" ajuste="estirar" />)
    medirContenedor(2000)
    expect(observadores.flatMap((o) => o.observados)).toEqual([])
    expect(container.querySelectorAll('col')[0].style.width).toMatch(/^72\.34/)
    expect(container.querySelector('table')).toHaveClass('w-full')
  })

  it('deja de observar el contenedor al desmontarse', () => {
    const { unmount } = render(<DataTable columns={COLUMNAS_CON_TOPE} data={DATOS} vacio="" ajuste="estirar" />)
    const conContenedor = observadores.filter((o) => o.observados.length > 0)
    expect(conContenedor).toHaveLength(1)
    expect(conContenedor[0].desconectado).toBe(false)
    unmount()
    expect(conContenedor[0].desconectado).toBe(true)
  })
})
