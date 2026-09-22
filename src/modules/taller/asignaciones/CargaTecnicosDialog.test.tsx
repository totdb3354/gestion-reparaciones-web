import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CargaTecnicosRespuesta } from '@/shared/api/client'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { desglose, filaCarga, resumen, tecnico } from '../test/fabrica'
import { AsignacionesPage } from './AsignacionesPage'
import { CargaTecnicosDialog } from './CargaTecnicosDialog'

// Los dos alcances vienen en la MISMA respuesta (D3), con cifras distintas a propósito: así un test puede
// distinguir "ha cambiado de alcance" de "ha vuelto a consultar". En Pedidos el orden es B(95) A(50) C(0);
// en Total, C(72) A(15) B(0): el toggle reordena la lista, no solo las cifras.
const RESPUESTA: CargaTecnicosRespuesta = {
  pedidos: [
    filaCarga({ idTec: 1, nombre: 'Técnico A', pctHecho: 20, pctPendiente: 30, hecho: desglose({ normales: 1 }), pendiente: desglose({ normales: 3, chasis: 1, enEsperaPieza: 2 }) }),
    filaCarga({ idTec: 2, nombre: 'Técnico B', pctHecho: 40, pctPendiente: 55, pendiente: desglose({ normales: 2 }) }),
    filaCarga({ idTec: 3, nombre: 'Técnico C' }),
  ],
  total: [
    filaCarga({ idTec: 1, nombre: 'Técnico A', pctHecho: 10, pctPendiente: 5, hecho: desglose({ glass: 1 }), pendiente: desglose({ porCerrar: 1 }) }),
    filaCarga({ idTec: 2, nombre: 'Técnico B' }),
    filaCarga({ idTec: 3, nombre: 'Técnico C', pctHecho: 60, pctPendiente: 12, hecho: desglose({ normales: 6 }), pendiente: desglose({ glass: 2 }) }),
  ],
}

/** Fin de semana: el servidor manda todo a cero con `sinJornada` en las dos listas. */
const FIN_DE_SEMANA: CargaTecnicosRespuesta = {
  pedidos: [
    filaCarga({ idTec: 2, nombre: 'Técnico B', sinJornada: true }),
    filaCarga({ idTec: 1, nombre: 'Técnico A', sinJornada: true }),
  ],
  total: [
    filaCarga({ idTec: 2, nombre: 'Técnico B', sinJornada: true }),
    filaCarga({ idTec: 1, nombre: 'Técnico A', sinJornada: true }),
  ],
}

let peticiones = 0

function servirCarga(respuesta: CargaTecnicosRespuesta) {
  server.use(
    http.get('*/api/reparaciones/carga-tecnicos', () => {
      peticiones += 1
      return HttpResponse.json(respuesta)
    }),
  )
}

beforeEach(() => {
  peticiones = 0
})

const cerrar = vi.fn()
const filtrar = vi.fn()

function abrir(respuesta: CargaTecnicosRespuesta = RESPUESTA) {
  cerrar.mockClear()
  filtrar.mockClear()
  servirCarga(respuesta)
  renderConProviders(
    <CargaTecnicosDialog abierto onCerrar={cerrar} onFiltrarPorTecnico={filtrar} onInteraccion={() => {}} />,
    { sesion: SESION_SUPER },
  )
}

/** Las filas de la ventana, en el orden en que están pintadas. Se busca dentro de la lista de la ventana y no en
 *  toda la pantalla: con la vista montada detrás, los nombres de técnico también salen en la tabla. */
const filas = () => within(screen.getByRole('list')).getAllByRole('listitem')
const nombres = () => filas().map((f) => within(f).getByText(/^Técnico /).textContent)
const filaDe = (nombre: string) => within(filas().find((f) => within(f).queryByText(nombre))!).getByRole('button')

describe('CargaTecnicosDialog', () => {
  it('arranca en Pedidos', async () => {
    abrir()
    expect(await screen.findByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedidos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'false')
    // 95% solo existe en el alcance Pedidos; el vacío se cuenta como "de cliente", no como "sin carga" a secas.
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(filaDe('Técnico C')).toHaveAttribute('title', expect.stringContaining('sin carga de cliente'))
  })

  it('el toggle a Total cambia las cifras sin volver a consultar', async () => {
    abrir()
    expect(await screen.findByText('95%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Total' }))
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.queryByText('95%')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true')
    // La respuesta ya traía los dos alcances: cambiar de alcance no puede costar un viaje al servidor (D3).
    expect(peticiones).toBe(1)
  })

  it('las filas salen ordenadas de mayor a menor carga', async () => {
    abrir()
    expect(await screen.findByRole('list')).toBeInTheDocument()
    expect(nombres()).toEqual(['Técnico B', 'Técnico A', 'Técnico C'])
    await userEvent.click(screen.getByRole('button', { name: 'Total' }))
    expect(nombres()).toEqual(['Técnico C', 'Técnico A', 'Técnico B'])
  })

  it('sin jornada las cifras son un guion', async () => {
    abrir(FIN_DE_SEMANA)
    expect(await screen.findByRole('list')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    // Empatadas a cero, el desempate por nombre deja un orden estable entre refrescos.
    expect(nombres()).toEqual(['Técnico A', 'Técnico B'])
  })

  it('el tooltip lleva el desglose y omite los ceros', async () => {
    abrir()
    expect(await screen.findByRole('list')).toBeInTheDocument()
    expect(filaDe('Técnico A')).toHaveAttribute(
      'title',
      'Pendiente: 3 normales · 1 chasis · 2 en espera de pieza — Hecho hoy: 1 normales\nClick: ver sus asignaciones',
    )
    // En Total el mismo técnico tiene otro desglose: el tooltip sigue al alcance activo.
    await userEvent.click(screen.getByRole('button', { name: 'Total' }))
    expect(filaDe('Técnico A')).toHaveAttribute('title', expect.stringContaining('Pendiente: 1 por cerrar — Hecho hoy: 1 glass'))
  })

  it('pulsar una fila cierra la ventana y llama a onFiltrarPorTecnico', async () => {
    abrir()
    expect(await screen.findByRole('list')).toBeInTheDocument()
    await userEvent.click(filaDe('Técnico B'))
    expect(filtrar).toHaveBeenCalledWith(2)
    expect(cerrar).toHaveBeenCalled()
  })
})

describe('CargaTecnicosDialog dentro de la vista', () => {
  const reparacion = resumen({ idRep: 'A20260916_1', imei: '000000000000001', idTec: 2 })

  beforeEach(() => {
    server.use(
      http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([reparacion])),
      http.get('*/api/glass/asignaciones', () => HttpResponse.json([resumen({ idRep: 'AG20260916_2', imei: '000000000000002', idTec: 1 })])),
      http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 1, nombre: 'Técnico A' }), tecnico({ idTec: 2, nombre: 'Técnico B' })])),
      http.get('*/api/clientes/activos', () => HttpResponse.json([])),
    )
  })

  const abrirVista = async () => {
    renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })
    expect(await screen.findByText('A20260916_1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Carga técnicos' }))
  }

  it('pulsar una fila deja la tabla filtrada por ese técnico', async () => {
    servirCarga(RESPUESTA)
    await abrirVista()
    expect(await screen.findByRole('list')).toBeInTheDocument()
    await userEvent.click(filaDe('Técnico B'))
    // La ventana se cierra y la tabla se queda con las filas de ese técnico (el filtro de técnico, en solitario).
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(await screen.findByText('1 asignación')).toBeInTheDocument()
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
    expect(screen.queryByText('AG20260916_2')).not.toBeInTheDocument()
  })

  it('si la consulta falla, se ve un mensaje en la ventana y la tabla de fondo no se ve afectada', async () => {
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => new HttpResponse(null, { status: 500 })))
    await abrirVista()
    expect(await screen.findByText('No se pudo cargar la carga de técnicos.')).toBeInTheDocument()
    // OJO: el 500 es ConexionError, así que la política global del QueryClient abre además su diálogo encima. Para
    // dejar el aviso solo aquí haría falta `meta: { silenciarError: true }` en `useCargaTecnicos` (./api, fuera del
    // alcance de esta tarea); queda anotado en el informe.
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    // Son dos consultas independientes (spec §14): la de la tabla no se entera.
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
    expect(screen.getByText('AG20260916_2')).toBeInTheDocument()
  })
})
