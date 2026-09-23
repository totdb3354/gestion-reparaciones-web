import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { focusManager } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- el badge del lateral vive en el SubNav del AppLayout real; ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
import { server } from '@/test/server'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import { TEXTO_COPIAR_CELDA } from '@/shared/ui/MenuCopiarCelda'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { handlersNotificaciones } from '../notificaciones/test/handlers'
import { resumen, tecnico } from '../test/fabrica'
import { AsignacionesPage } from './AsignacionesPage'

// Una fila por categoría, en el orden en que las devuelve el servidor (reparación, glass, pulido) y con los tres
// rangos del orden de prioridad repartidos a contrapelo: la urgente llega la segunda y la de cliente la tercera.
const reparacion = resumen({ idRep: 'A20260916_1', imei: '000000000000001', cliente: null })
const glass = resumen({ idRep: 'AG20260916_2', imei: '000000000000002', cliente: null, urgente: true })
const pulido = resumen({ idRep: 'AP20260916_3', imei: '000000000000003', cliente: 'CLIENTE A' })

beforeEach(() => {
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([reparacion])),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([glass])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([pulido])),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 4, nombre: 'Técnico A' })])),
    // El editor de cliente del menú contextual (Task 12) carga el catálogo de clientes activos con la vista.
    http.get('*/api/clientes/activos', () => HttpResponse.json([{ idCli: 1, nombre: 'CLIENTE A', activo: true, updatedAt: '2026-09-01T00:00:00' }])),
  )
})

afterEach(() => {
  vi.useRealTimers()
  // El foco de ventana es estado GLOBAL de TanStack: sin esto el test que lo fuerza dejaría a los demás con la
  // ventana marcada como enfocada a mano en vez de con el detector real del navegador.
  focusManager.setFocused(undefined)
})

const abrir = () => renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })

/** Cuenta las cargas de la lista: el sondeo pide las tres categorías a la vez, así que con contar una basta. */
function contarCargas() {
  const cargas = { n: 0 }
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => {
      cargas.n += 1
      return HttpResponse.json([reparacion])
    }),
  )
  return cargas
}

const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

/** Clic derecho sobre la primera fila: monta MenuAsignacion, que es lo que avisa de que hay un menú abierto. */
async function abrirMenuContextual() {
  const fila = screen.getAllByRole('row').find((f) => within(f).queryByText('A20260916_1'))!
  fireEvent.contextMenu(within(fila).getByText('A20260916_1'))
  await screen.findAllByRole('menuitem')
}

describe('AsignacionesPage', () => {
  it('muestra el título y el contador filtrado', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Asignaciones pendientes' })).toBeInTheDocument()
    // findByText: el título es estático y sale en el primer render, antes de que resuelvan los GET de los que
    // depende el contador (mismo motivo que en PendientesPage.test.tsx).
    expect(await screen.findByText('3 asignaciones')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeEnabled()
    expect(await screen.findByText(/^Actualizado /)).toBeInTheDocument()
  })

  it('pinta las tres categorías en la misma tabla', async () => {
    abrir()
    expect(await screen.findByText('A20260916_1')).toBeInTheDocument()
    expect(screen.getByText('AG20260916_2')).toBeInTheDocument()
    expect(screen.getByText('AP20260916_3')).toBeInTheDocument()
  })

  it('las urgentes salen primero', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const ids = screen.getAllByRole('row').slice(1).map((f) => within(f).getAllByRole('cell')[0].textContent)
    expect(ids).toEqual(['AG20260916_2', 'AP20260916_3', 'A20260916_1'])
  })

  it('la tabla no se puede ordenar por columna', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const cabeceras = screen.getAllByRole('columnheader')
    expect(cabeceras).toHaveLength(11)
    for (const c of cabeceras) expect(within(c).queryByRole('button')).not.toBeInTheDocument()
  })

  it('el contador y la tabla usan la lista filtrada, y un IMEI incompleto no filtra', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const campo = screen.getByRole('textbox', { name: 'Filtrar por IMEI' })
    // Tecleando a medias la tabla no se toca: el filtro solo cuenta con los IMEIs de 15 dígitos.
    await userEvent.type(campo, '00000')
    expect(screen.getByText('3 asignaciones')).toBeInTheDocument()
    await userEvent.type(campo, '0000000001')
    expect(await screen.findByText('1 asignación')).toBeInTheDocument()
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
    expect(screen.queryByText('AG20260916_2')).not.toBeInTheDocument()
  })

  it('el clic derecho selecciona la fila y abre su menú contextual', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const fila = screen.getAllByRole('row').find((f) => within(f).queryByText('A20260916_1'))!
    fireEvent.contextMenu(within(fila).getByText('A20260916_1'))
    // El menú se abre sobre la fila pulsada y, como en el JavaFX, la deja seleccionada: así la acción no cae en otra.
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent)
    expect(items).toEqual([TEXTO_COPIAR_CELDA, 'Editar comentario', 'Editar cliente', 'Marcar urgente', 'Marcar chasis'])
    expect(fila).toHaveAttribute('aria-selected', 'true')
  })

  it('el "N asignados" del IMEI sale del conteo de la lista completa, no de la filtrada', async () => {
    // Calco del JavaFX: `conteoTecnicosPorImei = contarTecnicosPorImei(asignaciones)` se calcula en cargar(), sobre
    // lo descargado y antes de filtrar. Aquí el mismo IMEI lo tienen dos técnicos en dos categorías distintas, así
    // que filtrar por Tipo deja una sola fila a la vista y el contador debe seguir diciendo 2.
    const IMEI = '000000000000009'
    server.use(
      http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([resumen({ idRep: 'A20260916_4', imei: IMEI, idTec: 4 })])),
      http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([resumen({ idRep: 'AP20260916_5', imei: IMEI, idTec: 6 })])),
    )
    abrir()
    await screen.findByText('A20260916_4')
    expect(screen.getAllByText('2 asignados')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Tipo' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pulido' }))
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('1 asignación')).toBeInTheDocument()
    expect(screen.queryByText('A20260916_4')).not.toBeInTheDocument()
    expect(screen.getAllByText('2 asignados')).toHaveLength(1)
  })

  it('Limpiar filtros devuelve todas las filas', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    await userEvent.type(screen.getByRole('textbox', { name: 'Filtrar por IMEI' }), '000000000000001')
    await screen.findByText('1 asignación')
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByText('3 asignaciones')).toBeInTheDocument()
  })
})

/**
 * D4 de punta a punta, que es lo único que demuestra que la congelación sirve: los tests del contador solo dicen
 * que el número sube y baja. Aquí se cuentan las peticiones reales del sondeo con el reloj falso, con la vista
 * entera montada y abriendo lo que abre el usuario.
 *
 * `shouldAdvanceTime`: el reloj falso corre también con el tiempo real, o las promesas de msw (y las esperas de
 * Testing Library) se quedarían colgadas dentro de un reloj parado.
 */
describe('AsignacionesPage · el sondeo se congela mientras hay algo abierto (D4)', () => {
  it('el menú contextual congela el sondeo, y cerrarlo lo reanuda', async () => {
    const cargas = contarCargas()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    abrir()
    await screen.findByText('A20260916_1')
    expect(cargas.n).toBe(1)

    // Punto de partida: sin nada abierto el sondeo recarga solo a los 60 s.
    await avanzar(INTERVALO_CONECTADO_MS)
    await waitFor(() => expect(cargas.n).toBe(2))

    await abrirMenuContextual()
    // Dos intervalos enteros con el menú abierto: ni una recarga. Sin esto la fila se movería bajo el cursor y el
    // ítem del menú caería sobre otra.
    await avanzar(INTERVALO_CONECTADO_MS * 2)
    expect(cargas.n).toBe(2)

    // Cerrar el menú lo DESMONTA (Radix solo monta el contenido abierto), así que quien libera el contador es la
    // limpieza del efecto: es la mitigación de la spec §17 ("el contador se libera también al desmontar").
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument())
    await avanzar(INTERVALO_CONECTADO_MS)
    await waitFor(() => expect(cargas.n).toBe(3))
  })

  it('un desplegable de filtro congela el sondeo, y cerrarlo lo reanuda', async () => {
    const cargas = contarCargas()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    abrir()
    await screen.findByText('A20260916_1')
    expect(cargas.n).toBe(1)

    await usuario.click(screen.getByRole('button', { name: 'Tipo' }))
    await avanzar(INTERVALO_CONECTADO_MS * 2)
    expect(cargas.n).toBe(1)

    await usuario.keyboard('{Escape}')
    await avanzar(INTERVALO_CONECTADO_MS)
    await waitFor(() => expect(cargas.n).toBe(2))
  })

  // El tercer tipo de consumidor: las dos ventanas de la cabecera, que avisan por ref en vez de por dependencia
  // del efecto. Se prueba la de carga; la de glass usa exactamente el mismo mecanismo.
  it('la ventana de carga de técnicos congela el sondeo, y cerrarla lo reanuda', async () => {
    const cargas = contarCargas()
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => HttpResponse.json({ pedidos: [], total: [] })))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    abrir()
    await screen.findByText('A20260916_1')
    expect(cargas.n).toBe(1)

    await usuario.click(screen.getByRole('button', { name: 'Carga técnicos' }))
    await screen.findByRole('dialog')
    await avanzar(INTERVALO_CONECTADO_MS * 2)
    expect(cargas.n).toBe(1)

    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await avanzar(INTERVALO_CONECTADO_MS)
    await waitFor(() => expect(cargas.n).toBe(2))
  })

  it('el botón Asignar abre el modal y congela el refresco', async () => {
    // Los mismos handlers que el test del modal: técnicos, carga y catálogo de clientes.
    server.use(
      http.get('*/api/reparaciones/carga-tecnicos', () => HttpResponse.json({ pedidos: [], total: [] })),
      http.get('*/api/clientes', () => HttpResponse.json([])),
    )
    const cargas = contarCargas()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    abrir()
    await screen.findByText('A20260916_1')
    expect(cargas.n).toBe(1)

    await usuario.click(screen.getByRole('button', { name: 'Asignar' }))
    expect(await screen.findByRole('heading', { name: 'Asignar trabajos' })).toBeInTheDocument()
    await avanzar(INTERVALO_CONECTADO_MS * 2)
    expect(cargas.n).toBe(1)

    // Sin entradas, Escape lo cierra sin preguntar; al desmontarse libera el sondeo.
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Asignar trabajos' })).not.toBeInTheDocument())
    await avanzar(INTERVALO_CONECTADO_MS)
    await waitFor(() => expect(cargas.n).toBe(2))
  })

  /**
   * La otra puerta de entrada de una recarga de fondo, aparte del intervalo: el foco de ventana. El QueryClient de
   * la app trae `refetchOnWindowFocus: true` y `staleTime: 0` (política global de shared/api/queryClient, que no se
   * toca), así que congelar solo el intervalo dejaba a un alt-tab recargando y reordenando la tabla con el menú
   * abierto. El reloj solo avanza 100 ms en cada tramo: muy por debajo del intervalo, así que lo único que puede
   * disparar una carga aquí es el foco.
   */
  it('volver a la ventana no recarga con algo abierto, y sí al cerrarlo', async () => {
    const cargas = contarCargas()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    abrir()
    await screen.findByText('A20260916_1')
    expect(cargas.n).toBe(1)

    await abrirMenuContextual()
    act(() => { focusManager.setFocused(false) })
    act(() => { focusManager.setFocused(true) })
    await avanzar(100)
    expect(cargas.n).toBe(1)

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument())
    act(() => { focusManager.setFocused(false) })
    act(() => { focusManager.setFocused(true) })
    await avanzar(100)
    await waitFor(() => expect(cargas.n).toBe(2))
  })
})

/**
 * Paridad asig-lista: el TableView del JavaFX (CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN) estira las columnas hasta
 * el borde y el Id se lee entero. La tabla va en el ajuste 'estirar' de DataTable, como el Historial; la papelera lleva
 * tope, así que DataTable mide el contenedor y pinta en px. jsdom no mide: ResizeObserver controlable desde el test.
 */
describe('AsignacionesPage · la tabla ocupa todo el ancho (paridad asig-lista)', () => {
  const observadores: { cb: ResizeObserverCallback; observados: Element[] }[] = []
  class ResizeObserverFalso {
    private readonly o: { cb: ResizeObserverCallback; observados: Element[] }
    constructor(cb: ResizeObserverCallback) {
      this.o = { cb, observados: [] }
      observadores.push(this.o)
    }
    observe(el: Element) { this.o.observados.push(el) }
    unobserve() {}
    disconnect() {}
  }
  function medirContenedor(ancho: number) {
    act(() => {
      for (const o of observadores) o.cb(o.observados.map((target) => ({ target, contentRect: { width: ancho } }) as unknown as ResizeObserverEntry), {} as ResizeObserver)
    })
  }
  beforeEach(() => {
    observadores.length = 0
    vi.stubGlobal('ResizeObserver', ResizeObserverFalso)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sin medida (antes del primer layout) la tabla va a w-full con los anchos en porcentaje', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    expect(screen.getByRole('table')).toHaveClass('w-full')
    const anchos = Array.from(document.querySelectorAll('col')).map((c) => c.style.width)
    expect(anchos.every((a) => a.endsWith('%'))).toBe(true)
  })

  it('medida, llena el contenedor: el Id no baja de 120 px, la papelera se queda en 45 y Comentario es la más ancha', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    // Contenedor de la captura (1920 px de pantalla menos lateral y márgenes). Suma de pesos 1305 → u ≈ 1,257.
    medirContenedor(1640)
    const px = Array.from(document.querySelectorAll('col')).map((c) => parseFloat(c.style.width))
    const [id, , , , , , comentario, cliente, , , papelera] = px
    expect(id).toBeGreaterThanOrEqual(120)
    expect(papelera).toBe(45)
    expect(comentario).toBe(Math.max(...px))
    expect(cliente).toBeGreaterThan(px[2]) // más que Técnico
    // Todo el ancho menos lo que la papelera no crece (45·(u−1) ≈ 11,6 px en blanco, como el hueco del JavaFX).
    expect(px.reduce((a, b) => a + b, 0)).toBeGreaterThan(1625)
  })
})

/**
 * El badge del lateral (total de asignaciones, calco de lblBadgeAsignaciones) lee la MISMA consulta que la vista: con
 * la vista abierta no añade peticiones, y como no sondea por su cuenta sobre su propio enlace, no rompe el congelado.
 */
describe('AsignacionesPage · con el lateral montado (badge de Asignaciones)', () => {
  beforeEach(() => {
    // AppLayout con supertécnico monta la campana de la barra y el badge de Pendientes del lateral.
    server.use(...handlersNotificaciones())
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })))
  })

  const abrirConLateral = () => renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones', layout: <AppLayout /> })

  it('el badge muestra el total sin filtros y comparte la carga de la vista (una sola petición por lista)', async () => {
    const cargas = contarCargas()
    const usuario = userEvent.setup()
    abrirConLateral()
    await screen.findByText('A20260916_1')
    const enlace = screen.getByRole('link', { name: /Asignaciones/ })
    expect(await within(enlace).findByText('3')).toBeInTheDocument()
    expect(cargas.n).toBe(1)
    // Filtrar cambia el contador de la cabecera, no el badge (spec §9).
    await usuario.type(screen.getByPlaceholderText('Filtrar por IMEI'), '000000000000003')
    await waitFor(() => expect(screen.queryByText('A20260916_1')).not.toBeInTheDocument())
    expect(within(enlace).getByText('3')).toBeInTheDocument()
  })

  it('con el menú contextual abierto el sondeo sigue congelado aunque el lateral esté montado', async () => {
    const cargas = contarCargas()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    abrirConLateral()
    await screen.findByText('A20260916_1')
    await within(screen.getByRole('link', { name: /Asignaciones/ })).findByText('3')
    expect(cargas.n).toBe(1)
    await abrirMenuContextual()
    await avanzar(INTERVALO_CONECTADO_MS * 2)
    expect(cargas.n).toBe(1)
  })
})
