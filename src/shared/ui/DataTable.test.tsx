import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertaProvider } from './AlertaProvider'
import { ContextMenuItem } from './context-menu'
import { anchosEstirados, DataTable, type CeldaPulsada } from './DataTable'
import { TextoExpandible } from './TextoExpandible'

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
const DIEZ: Fila[] = Array.from({ length: 10 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))

const ALTO_CABECERA = 40
const ALTO_FILA = 44
/** jsdom no maqueta: cabecera de 40 px y filas de datos de 44 px colocadas por su data-index justo debajo (su offsetTop es
 *  relativo a la <table>, que empieza arriba del todo del contenedor), y un contenedor (el padre de la <table>) de `alto`
 *  px útiles (clientHeight) más `barraHorizontal` px de barra de scroll (offsetHeight, lo que mide el virtualizador).
 *  El scrollTop de jsdom guarda lo que se le asigna, sin acotarlo. Los espías los restaura el afterEach. */
function simularMaquetacion(alto: number, barraHorizontal = 0) {
  const esFila = (el: HTMLElement) => el.tagName === 'TR' && el.dataset.index !== undefined
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
    return esFila(this) ? ALTO_CABECERA + Number(this.dataset.index) * ALTO_FILA : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.firstElementChild?.tagName === 'TABLE') return alto + barraHorizontal
    return this.tagName === 'THEAD' ? ALTO_CABECERA : esFila(this) ? ALTO_FILA : 0
  })
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.firstElementChild?.tagName === 'TABLE' ? alto : 0
  })
}

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

  it('si la selección cambia desde fuera, desplaza solo el contenedor hasta dejar la fila justo debajo de la cabecera, aunque ya se viera (calco de tabla.scrollTo(i) del enlace "Id Rep. Anterior")', () => {
    simularMaquetacion(300)
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const tabla = (seleccionada: string | null) => <DataTable columns={COLUMNAS} data={DIEZ} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={() => {}} />
    const { rerender } = render(tabla(null))
    const contenedor = screen.getByRole('table').parentElement!
    expect(contenedor.scrollTop).toBe(0)
    // F2 ocupa 128–172 px del contenido y ya se ve entera en los 300 px del contenedor.
    rerender(tabla('2'))
    expect(contenedor.scrollTop).toBe(2 * ALTO_FILA)
    // Ni la página ni otros ancestros se desplazan (scrollIntoView los movería a todos): el TableView solo mueve su lista.
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('con filasContexto, una selección externa deja esas filas por encima, o la primera fila si no hay tantas (restauración del maestro de IMEIs)', () => {
    simularMaquetacion(300)
    const tabla = (seleccionada: string | null) => (
      <DataTable columns={COLUMNAS} data={DIEZ} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={() => {}} filasContexto={3} />
    )
    const { rerender } = render(tabla(null))
    const contenedor = screen.getByRole('table').parentElement!
    rerender(tabla('7'))
    expect(contenedor.scrollTop).toBe(4 * ALTO_FILA) // F4 justo debajo de la cabecera
    rerender(tabla('2'))
    expect(contenedor.scrollTop).toBe(0) // F0
  })

  it('una selección hecha en la propia tabla (clic, clic derecho) no desplaza; las flechas desplazan el contenedor lo justo para ver la fila entera bajo la cabecera', async () => {
    // Contenedor de 150 px: bajo la cabecera de 40 caben 110, dos filas y media.
    simularMaquetacion(150)
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    function TablaConEstado() {
      const [seleccionada, setSeleccionada] = useState<string | null>(null)
      return <DataTable columns={COLUMNAS} data={DIEZ} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={setSeleccionada} filasContexto={3} />
    }
    render(<TablaConEstado />)
    const contenedor = screen.getByRole('table').parentElement!
    await userEvent.click(screen.getByText('F2'))
    expect(screen.getByRole('row', { name: /^F2 x$/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('F1') })
    expect(screen.getByRole('row', { name: /^F1 x$/ })).toHaveAttribute('aria-selected', 'true')
    // F2 (128–172 px) asoma a medias y aun así ni el clic ni el clic derecho desplazan.
    expect(contenedor.scrollTop).toBe(0)
    contenedor.focus()
    await userEvent.keyboard('{ArrowDown}') // F2: su borde inferior (172) justo al final de los 150 px
    expect(screen.getByRole('row', { name: /^F2 x$/ })).toHaveAttribute('aria-selected', 'true')
    expect(contenedor.scrollTop).toBe(172 - 150)
    await userEvent.keyboard('{ArrowDown}') // F3 (172–216)
    expect(contenedor.scrollTop).toBe(216 - 150)
    await userEvent.keyboard('{ArrowUp}') // F2 ya se ve entera entre la cabecera (66 + 40) y el final (66 + 150): no se mueve
    expect(contenedor.scrollTop).toBe(66)
    await userEvent.keyboard('{ArrowUp}') // F1 (84–128) queda bajo la cabecera: su borde superior justo debajo de ella
    expect(contenedor.scrollTop).toBe(84 - ALTO_CABECERA)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('la marca de selección interna solo vale para el efecto siguiente: tras una flecha que no cambia la selección, las dos selecciones externas desplazan, también la vuelta a esa fila', async () => {
    simularMaquetacion(300)
    const onSeleccionar = vi.fn()
    const tabla = (seleccionada: string) => <DataTable columns={COLUMNAS} data={DIEZ} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={onSeleccionar} />
    const { rerender } = render(tabla('0'))
    const contenedor = screen.getByRole('table').parentElement!
    contenedor.focus()
    // (1) Flecha arriba en la primera fila: la tabla "elige" la fila ya seleccionada, nada cambia y la marca queda puesta.
    await userEvent.keyboard('{ArrowUp}')
    expect(onSeleccionar).toHaveBeenLastCalledWith('0')
    expect(contenedor.scrollTop).toBe(0)
    // (2) Selección externa de otra fila.
    rerender(tabla('5'))
    expect(contenedor.scrollTop).toBe(5 * ALTO_FILA)
    // (3) Selección externa de vuelta a la primera fila: no se confunde con la marca que dejó (1).
    rerender(tabla('0'))
    expect(contenedor.scrollTop).toBe(0)
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

  describe('flechas en modo virtual (más filas que el umbral)', () => {
    const QUINIENTAS: Fila[] = Array.from({ length: 500 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))
    function TablaVirtual() {
      const [seleccionada, setSeleccionada] = useState<string | null>(null)
      return <DataTable columns={COLUMNAS} data={QUINIENTAS} vacio="" getRowId={(f) => f.id} umbralVirtual={100} seleccionada={seleccionada} onSeleccionar={setSeleccionada} />
    }
    /** Contenedor de 150 px útiles con barra de scroll horizontal de 15 px (el Historial necesita 1470 px de ancho), el alto
     *  de todo su contenido (cabecera y 500 filas) y un scrollTo que, como el del navegador, mueve el scrollTop (jsdom no lo
     *  implementa). */
    function montar() {
      simularMaquetacion(150, 15)
      render(<TablaVirtual />)
      const contenedor = screen.getByRole('table').parentElement!
      Object.defineProperty(contenedor, 'scrollHeight', { configurable: true, value: ALTO_CABECERA + QUINIENTAS.length * ALTO_FILA })
      Object.assign(contenedor, { scrollTo: ({ top }: ScrollToOptions) => { contenedor.scrollTop = top ?? 0 } })
      return contenedor
    }
    function desplazarConRueda(contenedor: HTMLElement, scrollTop: number) {
      contenedor.scrollTop = scrollTop
      fireEvent.scroll(contenedor)
    }

    it('dejan entera bajo la cabecera la fila a la que llegan, como sin virtualizar (el virtualizador no sabe de la cabecera sticky ni de la barra)', async () => {
      const contenedor = montar()
      await userEvent.click(screen.getByText('F1'))
      contenedor.focus()
      await userEvent.keyboard('{ArrowDown}') // F2 (128–172): su borde inferior justo al final de los 150 px útiles
      expect(contenedor.scrollTop).toBe(172 - 150)
      await userEvent.keyboard('{ArrowDown}') // F3 (172–216)
      expect(contenedor.scrollTop).toBe(216 - 150)
      await userEvent.keyboard('{ArrowUp}{ArrowUp}') // F1 (84–128): su borde superior justo debajo de la cabecera
      expect(contenedor.scrollTop).toBe(84 - ALTO_CABECERA)
    })

    it('si la fila a la que llegan no está pintada (la selección quedó lejos tras usar la rueda), la acercan igual', async () => {
      const contenedor = montar()
      desplazarConRueda(contenedor, 300 * ALTO_FILA)
      await userEvent.click(screen.getByText('F300'))
      desplazarConRueda(contenedor, 0)
      expect(screen.queryByText('F301')).not.toBeInTheDocument()
      contenedor.focus()
      await userEvent.keyboard('{ArrowDown}') // F301 (13284–13328), muy por debajo: su borde inferior al final del contenedor
      expect(contenedor.scrollTop).toBe(ALTO_CABECERA + 302 * ALTO_FILA - 150)
    })
  })

  it('un refresco de datos con la misma selección no vuelve a desplazar la tabla', () => {
    simularMaquetacion(300)
    const tabla = (data: Fila[], seleccionada: string) => <DataTable columns={COLUMNAS} data={data} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={() => {}} />
    const { rerender } = render(tabla(DIEZ, '3'))
    const contenedor = screen.getByRole('table').parentElement!
    expect(contenedor.scrollTop).toBe(3 * ALTO_FILA)
    contenedor.scrollTop = 0 // el usuario vuelve arriba con la rueda
    rerender(tabla([...DIEZ], '3'))
    expect(contenedor.scrollTop).toBe(0)
    rerender(tabla(DIEZ, '1'))
    expect(contenedor.scrollTop).toBe(ALTO_FILA)
  })

  it('cada petición de desplazamiento desplaza hasta la selección aunque ya fuera esa y enfoca el contenedor sin mover la página; una selección externa sin petición no enfoca (calco de select(i); scrollTo(i); requestFocus() en cada clic del enlace "Id Rep. Anterior")', () => {
    simularMaquetacion(300)
    const enfocar = vi.spyOn(HTMLElement.prototype, 'focus')
    const tabla = (seleccionada: string | null, peticion: number) => (
      <DataTable columns={COLUMNAS} data={DIEZ} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={() => {}} pedirDesplazamiento={peticion} />
    )
    const { rerender } = render(tabla(null, 0))
    const contenedor = screen.getByRole('table').parentElement!
    // Selección externa sin petición (la restauración del maestro de IMEIs): desplaza, pero la tabla no se lleva el foco.
    rerender(tabla('2', 0))
    expect(contenedor.scrollTop).toBe(2 * ALTO_FILA)
    expect(enfocar).not.toHaveBeenCalled()
    // Primer clic en un enlace a F5.
    rerender(tabla('5', 1))
    expect(contenedor.scrollTop).toBe(5 * ALTO_FILA)
    expect(contenedor).toHaveFocus()
    expect(enfocar).toHaveBeenLastCalledWith({ preventScroll: true })
    // El usuario vuelve arriba con la rueda y el foco pasa a otro sitio; F5 sigue seleccionada.
    contenedor.scrollTop = 0
    contenedor.blur()
    // Segundo clic en el mismo enlace: la selección no cambia y aun así vuelve a desplazar y a enfocar.
    rerender(tabla('5', 2))
    expect(contenedor.scrollTop).toBe(5 * ALTO_FILA)
    expect(contenedor).toHaveFocus()
    expect(enfocar).toHaveBeenCalledTimes(2)
  })

  it('una petición de desplazamiento a una fila que no está en la tabla no desplaza ni enfoca, y no queda pendiente para cuando la fila aparezca', () => {
    simularMaquetacion(300)
    const tabla = (data: Fila[], seleccionada: string | null, peticion: number) => (
      <DataTable columns={COLUMNAS} data={data} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada} onSeleccionar={() => {}} pedirDesplazamiento={peticion} />
    )
    const { rerender } = render(tabla(DIEZ.slice(0, 5), null, 0))
    const contenedor = screen.getByRole('table').parentElement!
    // Enlace a F7, que un filtro deja fuera de la tabla (el JavaFX solo actúa si la encuentra entre los items).
    rerender(tabla(DIEZ.slice(0, 5), '7', 1))
    expect(contenedor.scrollTop).toBe(0)
    expect(contenedor).not.toHaveFocus()
    // Al quitar el filtro F7 aparece: la tabla no se lleva el foco (el usuario puede estar escribiendo en el filtro).
    rerender(tabla(DIEZ, '7', 1))
    expect(contenedor).not.toHaveFocus()
  })

  it('si la selección llega antes que las filas, desplaza cuando aparecen', () => {
    simularMaquetacion(300)
    const tabla = (data: Fila[]) => <DataTable columns={COLUMNAS} data={data} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />
    const { rerender } = render(tabla([]))
    const contenedor = screen.getByRole('table').parentElement!
    expect(contenedor.scrollTop).toBe(0)
    rerender(tabla(DIEZ))
    expect(contenedor.scrollTop).toBe(3 * ALTO_FILA)
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

describe('DataTable — eventos que no nacen en la tabla (portales y controles de las celdas)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  type PropsTabla = {
    columnas?: ColumnDef<Fila, string>[]
    inicial?: string | null
    alSeleccionar?: (id: string | null) => void
    onAbrir?: (f: Fila) => void
    menuFila?: (f: Fila, celda: CeldaPulsada) => ReactNode
  }
  /** Tabla con la selección en estado, como las páginas (`onSeleccionar={setSeleccionada}`). */
  function TablaConEstado({ columnas = COLUMNAS, inicial = null, alSeleccionar, onAbrir, menuFila }: PropsTabla) {
    const [seleccionada, setSeleccionada] = useState<string | null>(inicial)
    return (
      <DataTable columns={columnas} data={DIEZ} vacio="" getRowId={(f) => f.id} seleccionada={seleccionada}
        onSeleccionar={(id) => { alSeleccionar?.(id); setSeleccionada(id) }} onAbrir={onAbrir} menuFila={menuFila} />
    )
  }

  it('con el menú contextual abierto, las flechas se quedan en el menú y no mueven la selección de la tabla', async () => {
    const alSeleccionar = vi.fn()
    render(<TablaConEstado alSeleccionar={alSeleccionar} menuFila={() => <><ContextMenuItem>Uno</ContextMenuItem><ContextMenuItem>Dos</ContextMenuItem></>} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('F2') })
    await screen.findByRole('menu')
    expect(alSeleccionar).toHaveBeenLastCalledWith('2')
    alSeleccionar.mockClear()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Uno' })).toHaveFocus()
    expect(alSeleccionar).not.toHaveBeenCalled()
    // hidden: con el menú abierto, Radix marca el resto de la página con aria-hidden.
    expect(screen.getByRole('row', { name: /^F2 x$/, hidden: true })).toHaveAttribute('aria-selected', 'true')
  })

  it('Enter sobre un ítem del menú contextual ejecuta el ítem y no abre la fila seleccionada', async () => {
    const onAbrir = vi.fn()
    const accion = vi.fn()
    render(<TablaConEstado onAbrir={onAbrir} menuFila={() => <ContextMenuItem onSelect={accion}>Acción</ContextMenuItem>} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('F2') })
    ;(await screen.findByRole('menuitem', { name: 'Acción' })).focus()
    await userEvent.keyboard('{Enter}')
    expect(accion).toHaveBeenCalledTimes(1)
    expect(onAbrir).not.toHaveBeenCalled()
  })

  it('Enter con el foco en un botón de una celda pulsa ese botón y no abre la fila; las flechas siguen moviendo la selección', async () => {
    const pulsado = vi.fn()
    const onAbrir = vi.fn()
    const columnas: ColumnDef<Fila, string>[] = [
      ...COLUMNAS,
      { id: 'ver', header: '', size: 60, cell: ({ row }) => <button type="button" onClick={() => pulsado(row.original.id)}>{`Ver ${row.original.nombre}`}</button> },
    ]
    render(<TablaConEstado columnas={columnas} inicial="2" onAbrir={onAbrir} />)
    screen.getByRole('button', { name: 'Ver F2' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(pulsado).toHaveBeenCalledWith('2')
    expect(onAbrir).not.toHaveBeenCalled()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('row', { name: /^F3 x Ver F3$/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('los clics, dobles clics, clics derechos y teclas de un portal pintado desde una celda no seleccionan ni abren la fila', async () => {
    const alSeleccionar = vi.fn()
    const onAbrir = vi.fn()
    const columnas: ColumnDef<Fila, string>[] = [
      ...COLUMNAS,
      { id: 'flotante', header: '', size: 60, cell: ({ row }) => row.original.id === '2' && createPortal(<button type="button">flotante</button>, document.body) },
    ]
    render(<TablaConEstado columnas={columnas} inicial="5" alSeleccionar={alSeleccionar} onAbrir={onAbrir} />)
    const flotante = screen.getByRole('button', { name: 'flotante' })
    await userEvent.click(flotante)
    await userEvent.dblClick(flotante)
    await userEvent.pointer({ keys: '[MouseRight]', target: flotante })
    // fireEvent devuelve false si alguien canceló la acción por defecto de la tecla.
    const flechaSinCancelar = fireEvent.keyDown(flotante, { key: 'ArrowDown' })
    const enterSinCancelar = fireEvent.keyDown(flotante, { key: 'Enter' })
    expect(alSeleccionar).not.toHaveBeenCalled()
    expect(onAbrir).not.toHaveBeenCalled()
    expect(flechaSinCancelar).toBe(true)
    expect(enterSinCancelar).toBe(true)
    expect(screen.getByRole('row', { name: /^F5 x/ })).toHaveAttribute('aria-selected', 'true')
  })

  describe('popup de un TextoExpandible de una celda', () => {
    const columnas: ColumnDef<Fila, string>[] = [
      ...COLUMNAS,
      { id: 'texto', header: 'Texto', size: 150, cell: ({ row }) => <TextoExpandible titulo="Texto completo" texto={`texto de ${row.original.nombre}`} /> },
    ]
    async function abrirPopup(props: PropsTabla) {
      render(<AlertaProvider><TablaConEstado columnas={columnas} menuFila={() => <ContextMenuItem>Acción de la fila</ContextMenuItem>} {...props} /></AlertaProvider>)
      await userEvent.click(screen.getByRole('button', { name: 'texto de F2' }))
      return within(await screen.findByRole('dialog', { name: 'Texto completo' })).getByRole('textbox')
    }

    it('las flechas en su área de texto mueven el cursor (no se cancelan) y no la selección de la tabla', async () => {
      const alSeleccionar = vi.fn()
      const area = await abrirPopup({ alSeleccionar })
      alSeleccionar.mockClear()
      expect(fireEvent.keyDown(area, { key: 'ArrowDown' })).toBe(true)
      expect(fireEvent.keyDown(area, { key: 'ArrowUp' })).toBe(true)
      expect(alSeleccionar).not.toHaveBeenCalled()
    })

    it('el doble clic en su área de texto (seleccionar una palabra) no abre la fila', async () => {
      const onAbrir = vi.fn()
      const area = await abrirPopup({ onAbrir })
      await userEvent.dblClick(area)
      expect(onAbrir).not.toHaveBeenCalled()
    })

    it('el clic derecho en su área de texto deja el menú del navegador y no abre el de la fila', async () => {
      const area = await abrirPopup({})
      expect(fireEvent.contextMenu(area)).toBe(true)
      expect(screen.queryByRole('menuitem', { name: 'Acción de la fila' })).not.toBeInTheDocument()
    })
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
