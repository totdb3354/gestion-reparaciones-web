import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import { TEXTO_COPIAR_CELDA } from '@/shared/ui/MenuCopiarCelda'
import { renderConProviders, SESION_SUPER } from '@/test/render'
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
    // El modal "Asignar trabajos" es el sub-proyecto 3b: el botón está en su sitio, deshabilitado y con el tooltip
    // en el envoltorio, que es quien recibe el hover.
    const asignar = screen.getByRole('button', { name: 'Asignar' })
    expect(asignar).toBeDisabled()
    expect(asignar.parentElement).toHaveAttribute('title', 'Disponible en el siguiente sub-proyecto')
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
})
