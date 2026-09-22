import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { DataTable } from '@/shared/ui/DataTable'
import { glass, resumen, tecnico } from '../test/fabrica'
import { useAsignacionesTodas } from './api'
import { claseFilaAsignacion, crearColumnas, type OpcionesColumnas } from './columnas'
import { useAccionConDeshacer } from './useAccionConDeshacer'

const TECNICOS = [tecnico({ idTec: 4, nombre: 'Técnico A' }), tecnico({ idTec: 6, nombre: 'Técnico H' })]

const opciones = (p: Partial<OpcionesColumnas> = {}): OpcionesColumnas => ({
  soloLectura: false,
  tecnicos: TECNICOS,
  ejecutar: vi.fn(),
  onInteraccion: vi.fn(),
  onBorrar: vi.fn(),
  hoy: '2026-09-16',
  ...p,
})

function pintar(filas: ReparacionResumen[], o: OpcionesColumnas) {
  return renderConProviders(
    <DataTable columns={crearColumnas(o)} data={filas} vacio="sin filas" getRowId={(r) => r.idRep} filaClase={claseFilaAsignacion} />,
    { sesion: SESION_SUPER },
  )
}

/** [id, cabecera, size]: los prefWidth de PendientesSuperTecnicoView.fxml, en el orden de la spec §7. */
const DIEZ_PRIMERAS = [
  ['id', 'Id Asignación', 90],
  ['tipo', 'Tipo', 90],
  ['tecnico', 'Técnico', 110],
  ['imei', 'IMEI', 130],
  ['modelo', 'Modelo', 120],
  ['fecha', 'Fecha asignación', 130],
  ['comentario', 'Comentario', 160],
  ['cliente', 'Cliente', 110],
  ['asignadoPor', 'Asignado por', 120],
  ['estado', 'Estado', 100],
]

describe('crearColumnas: las once columnas de la tabla de asignaciones', () => {
  it('el orden, las cabeceras y los anchos del FXML, con la papelera al final', () => {
    const cols = crearColumnas(opciones())
    expect(cols.map((c) => [c.id, c.header, c.size])).toEqual([...DIEZ_PRIMERAS, ['borrar', '', 45]])
  })

  it('ninguna columna ordena (D5: el orden de prioridad es funcional)', () => {
    expect(crearColumnas(opciones()).every((c) => c.enableSorting === false)).toBe(true)
  })

  it('en solo lectura la papelera no existe (ADMIN, spec §12)', () => {
    const cols = crearColumnas(opciones({ soloLectura: true }))
    expect(cols.map((c) => [c.id, c.header, c.size])).toEqual(DIEZ_PRIMERAS)
  })
})

describe('crearColumnas: "hoy" lo calcula la página, no la construcción de las columnas', () => {
  it('el badge de entrega de la misma fila cambia de forma según el "hoy" recibido (D3: no se congela a medianoche)', () => {
    const fila = glass('2026-09-16T07:02:00')

    const { unmount } = pintar([fila], opciones({ soloLectura: true, hoy: '2026-09-16' }))
    expect(screen.getByText('Llegó 09:02')).toBeInTheDocument()
    unmount()

    pintar([fila], opciones({ soloLectura: true, hoy: '2026-09-17' }))
    expect(screen.getByText('Llegó 16/09')).toBeInTheDocument()
  })
})

describe('claseFilaAsignacion: la franja de 8 px de la fila', () => {
  it('ámbar con solicitud de pieza, roja en incidencia y transparente si no', () => {
    expect(claseFilaAsignacion(resumen({ esSolicitud: 1 }))).toContain('border-l-fila-solicitud-brd')
    expect(claseFilaAsignacion(resumen({ esIncidencia: true }))).toContain('border-l-fila-incidencia-brd')
    expect(claseFilaAsignacion(resumen())).toContain('border-l-transparent')
    expect(claseFilaAsignacion(resumen())).toContain('border-l-8')
  })
})

describe('crearColumnas: contenido de las celdas', () => {
  it('id, tipo con Chasis, IMEI con su píldora, modelo traducido, fecha, cliente y quien la asignó', () => {
    const fila = resumen({
      idRep: 'A20260916_1', imei: '000000000000001', esChasis: true, modelo: '14',
      fechaAsig: '2026-09-16T07:02:00', cliente: 'Cliente Uno', nombreTecnicoAsigna: 'Técnico F',
      glassAbierta: true, glassTecnicoNombre: 'Técnico H',
    })
    pintar([fila], opciones({ soloLectura: true }))
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
    expect(screen.getByText('Reparación')).toBeInTheDocument()
    expect(screen.getByText('Chasis')).toBeInTheDocument()
    expect(screen.getByText('000000000000001')).toBeInTheDocument()
    expect(screen.getByText('Glass: Técnico H')).toBeInTheDocument()
    expect(screen.getByText('iPhone 14')).toBeInTheDocument()
    expect(screen.getByText('2026/09/16 09:02')).toBeInTheDocument()
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument()
    expect(screen.getByText('Técnico F')).toBeInTheDocument()
  })

  it('sin asignador, "Asignado por" pinta "—" (calco del cAsignadoPor del JavaFX)', () => {
    pintar([resumen({ nombreTecnicoAsigna: null })], opciones({ soloLectura: true }))
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('el comentario abre el popup de lectura al pulsarlo', async () => {
    pintar([resumen({ comentarioAsignacion: 'Revisar el conector' })], opciones({ soloLectura: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar el conector' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Comentario')).toBeInTheDocument()
    expect(within(dialogo).getByText('Revisar el conector')).toBeInTheDocument()
  })

  it('Estado apila los badges de badgesEstado', () => {
    pintar([resumen({ urgente: true, porCerrar: true })], opciones({ soloLectura: true }))
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Por cerrar')).toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
  })
})

describe('crearColumnas: columna Técnico y papelera', () => {
  it('en solo lectura el técnico es texto plano, sin desplegable', () => {
    pintar([resumen({ idTec: 4, nombreTecnico: 'Técnico A' })], opciones({ soloLectura: true }))
    expect(screen.getByText('Técnico A')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar asignación' })).not.toBeInTheDocument()
  })

  it('editable: el desplegable muestra el técnico actual y lista los técnicos activos', async () => {
    pintar([resumen({ idRep: 'AG20260916_2', idTec: 4, nombreTecnico: 'Técnico A' })], opciones())
    const combo = screen.getByRole('combobox', { name: 'Técnico de AG20260916_2' })
    expect(combo).toHaveTextContent('Técnico A')
    await userEvent.click(combo)
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Técnico A', 'Técnico H'])
  })

  it('editable: la papelera llama a onBorrar con la fila', async () => {
    const onBorrar = vi.fn()
    const fila = resumen({ idRep: 'AP20260916_3' })
    pintar([fila], opciones({ onBorrar }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar asignación' }))
    expect(onBorrar).toHaveBeenCalledExactlyOnceWith(fila)
  })

  it('avisa de la apertura y del cierre del desplegable (D4)', async () => {
    // Con el desplegable abierto el sondeo se congela, o la recarga mueve la fila bajo el cursor.
    const onInteraccion = vi.fn()
    pintar([resumen({ idRep: 'AG20260916_2' })], opciones({ onInteraccion }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Técnico de AG20260916_2' }))
    expect(onInteraccion.mock.calls).toEqual([[true]])
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(onInteraccion.mock.calls).toEqual([[true], [false]]))
  })
})

// ── Reasignar de verdad, contra un servidor falso ────────────────────────────────────────────────────────────────

const FILA = resumen({ idRep: 'A20260916_1', idTec: 4, nombreTecnico: 'Técnico A', comentarioAsignacion: 'no tocar', updatedAt: '2026-09-16T07:02:00' })
/** El UPDATED_AT que deja la primera escritura (Reparacion lo lleva ON UPDATE CURRENT_TIMESTAMP). */
const UPDATED_AT_TRAS_ESCRIBIR = '2026-09-16T07:05:00'

type CuerpoReasignar = { idTec: number; comentarioAsignacion: string; updatedAt: string }

/**
 * Servidor falso de una sola fila: el PATCH exige el `updatedAt` vigente (el bloqueo optimista del DAO, que
 * responde 409 si no cuadra) y lo mueve al escribir. Sin eso, un deshacer que mandase el `updatedAt` caducado
 * pasaría igual y el test no probaría nada.
 */
function servidorDeUnaFila() {
  const estado = { fila: FILA }
  const cuerpos: CuerpoReasignar[] = []
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([estado.fila])),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.patch('*/api/reparaciones/asignaciones/:idRep', async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoReasignar
      cuerpos.push(cuerpo)
      if (cuerpo.updatedAt !== estado.fila.updatedAt) return new HttpResponse(null, { status: 409 })
      const nombre = TECNICOS.find((t) => t.idTec === cuerpo.idTec)?.nombre ?? ''
      estado.fila = { ...estado.fila, idTec: cuerpo.idTec, nombreTecnico: nombre, updatedAt: UPDATED_AT_TRAS_ESCRIBIR }
      return new HttpResponse(null, { status: 200 })
    }),
  )
  return { estado, cuerpos }
}

/** Mini-página: la tabla con sus columnas y el aviso del hook montado UNA sola vez, como AsignacionesPage. Las filas
 *  salen de `useAsignacionesTodas`, no de un array fijo, porque el deshacer relee la fila de esa misma caché. */
function Pagina() {
  const { ejecutar, aviso } = useAccionConDeshacer()
  const { data = [] } = useAsignacionesTodas()
  return (
    <>
      <DataTable columns={crearColumnas({ ...opciones(), ejecutar })} data={data} vacio="sin filas" getRowId={(r) => r.idRep} filaClase={claseFilaAsignacion} />
      {aviso}
    </>
  )
}

/** Monta la mini-página y elige "Técnico H" en el desplegable de la única fila. */
async function reasignarATecnicoH() {
  renderConProviders(<Pagina />, { sesion: SESION_SUPER })
  await userEvent.click(await screen.findByRole('combobox', { name: 'Técnico de A20260916_1' }))
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'Técnico H' }))
}

describe('crearColumnas: reasignar desde la celda (D2)', () => {
  it('elegir otro técnico reasigna al instante, con el comentario y el updatedAt de la fila', async () => {
    const { cuerpos, estado } = servidorDeUnaFila()
    await reasignarATecnicoH()
    // El comentario viaja tal cual: reasignar y editar el comentario son el mismo endpoint (hoja de contrato §2).
    await vi.waitFor(() => expect(cuerpos).toEqual([{ idTec: 6, comentarioAsignacion: 'no tocar', updatedAt: '2026-09-16T07:02:00' }]))
    expect(estado.fila.idTec).toBe(6)
  })

  it('tras reasignar sale el aviso con Deshacer, y deshacer devuelve al técnico anterior', async () => {
    const { cuerpos, estado } = servidorDeUnaFila()
    await reasignarATecnicoH()
    expect(await screen.findByText('A20260916_1 reasignada a Técnico H')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await vi.waitFor(() => expect(cuerpos).toHaveLength(2))
    expect(cuerpos[1].idTec).toBe(4)
    // La vuelta atrás llegó de verdad al servidor: si la hubiera rechazado el bloqueo optimista, seguiría en el 6.
    await vi.waitFor(() => expect(estado.fila.idTec).toBe(4))
  })

  it('deshacer manda el updatedAt recargado, no el que caducó al reasignar', async () => {
    const { cuerpos } = servidorDeUnaFila()
    await reasignarATecnicoH()
    await screen.findByText('A20260916_1 reasignada a Técnico H')
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await vi.waitFor(() => expect(cuerpos).toHaveLength(2))
    expect(cuerpos[1].updatedAt).toBe(UPDATED_AT_TRAS_ESCRIBIR)
    expect(cuerpos[1].updatedAt).not.toBe(FILA.updatedAt)
    // Y no hubo 409: el manejador global de mutaciones habría abierto su diálogo de error.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
