import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { CREMA_EN_FILA_SELECCIONADA, DataTable } from '@/shared/ui/DataTable'
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
  asignadosPorImei: new Map(),
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

/**
 * Tercera línea de la celda IMEI (spec indicador-asignados 2026-06-29; PendientesSuperTecnicoController:319-322):
 * el conteo llega ya calculado desde la página, y la celda decide si lo pinta. La regla fina —con exactamente 2 la
 * píldora ya cuenta al segundo, con 3+ el contador convive con ella— es `ocultarContadorAsignados`.
 */
describe('crearColumnas: la tercera línea "N asignados" de la celda IMEI', () => {
  const conteo = (imei: string, n: number) => new Map([[imei, n]])
  const IMEI = '000000000000001'

  it('con dos técnicos y sin píldora que lo cuente, pinta "2 asignados"', () => {
    pintar([resumen({ imei: IMEI })], opciones({ soloLectura: true, asignadosPorImei: conteo(IMEI, 2) }))
    expect(screen.getByText('2 asignados')).toBeInTheDocument()
  })

  it('con un solo técnico, o sin el IMEI en el conteo, no hay tercera línea', () => {
    const { unmount } = pintar([resumen({ imei: IMEI })], opciones({ soloLectura: true, asignadosPorImei: conteo(IMEI, 1) }))
    expect(screen.queryByText(/asignados$/)).not.toBeInTheDocument()
    unmount()
    // Sin entrada en el mapa se cuenta 1, como el getOrDefault(imei, 1) del JavaFX.
    pintar([resumen({ imei: IMEI })], opciones({ soloLectura: true, asignadosPorImei: new Map() }))
    expect(screen.queryByText(/asignados$/)).not.toBeInTheDocument()
  })

  it('con exactamente 2 y la píldora "Glass: X" delante, el contador se calla', () => {
    const fila = resumen({ imei: IMEI, glassAbierta: true, glassTecnicoNombre: 'Técnico H' })
    pintar([fila], opciones({ soloLectura: true, asignadosPorImei: conteo(IMEI, 2) }))
    expect(screen.getByText('Glass: Técnico H')).toBeInTheDocument()
    expect(screen.queryByText('2 asignados')).not.toBeInTheDocument()
  })

  it('con 3 el contador vuelve y convive con la píldora', () => {
    const fila = resumen({ imei: IMEI, glassAbierta: true, glassTecnicoNombre: 'Técnico H' })
    pintar([fila], opciones({ soloLectura: true, asignadosPorImei: conteo(IMEI, 3) }))
    expect(screen.getByText('Glass: Técnico H')).toBeInTheDocument()
    expect(screen.getByText('3 asignados')).toBeInTheDocument()
  })

  it('es la sub-etiqueta gris en cursiva del JavaFX, y pasa a crema en la fila seleccionada', () => {
    pintar([resumen({ imei: IMEI })], opciones({ soloLectura: true, asignadosPorImei: conteo(IMEI, 2) }))
    expect(screen.getByText('2 asignados')).toHaveClass('text-[10px]', 'italic', 'text-texto-fecha-inicio', CREMA_EN_FILA_SELECCIONADA)
  })
})

describe('crearColumnas: columna Técnico y papelera', () => {
  it('en solo lectura el técnico es texto plano, sin desplegable', () => {
    pintar([resumen({ idTec: 4, nombreTecnico: 'Técnico A' })], opciones({ soloLectura: true }))
    expect(screen.getByText('Técnico A')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar asignación' })).not.toBeInTheDocument()
  })

  it('en solo lectura el técnico es SOLO el nombre: la fila de glass entregada no cuelga "Llegó dd/MM HH:mm"', () => {
    // La columna Técnico del ADMIN es texto plano en el JavaFX (PendientesSuperTecnicoController:254-259). El
    // subtexto de entrega es de la celda de reparador del Historial y aquí sobraba.
    pintar([glass('2026-09-16T07:02:00')], opciones({ soloLectura: true }))
    expect(screen.getByText('Técnico A')).toBeInTheDocument()
    expect(screen.queryByText('Llegó 16/09 09:02')).not.toBeInTheDocument()
    // El badge de entrega de la columna Estado no se toca: sigue contando la llegada.
    expect(screen.getByText('Llegó 09:02')).toBeInTheDocument()
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

// ── La guarda del deshacer: no manda una escritura condenada ni pisa el cambio de otro ──────────────────────────

/** Como servidorDeUnaFila, pero el primer GET (montaje) responde al instante y cualquier GET posterior se queda
 *  retenido hasta `liberarGet()`. Sirve para que, al pulsar "Deshacer", la caché SIGA sin confirmar la reasignación
 *  (el camino rápido no vale) y se ejercite de verdad la espera de `filaParaDeshacer`. */
function servidorDeUnaFilaConGetRetenido() {
  const estado = { fila: FILA }
  const cuerpos: CuerpoReasignar[] = []
  let primeraHecha = false
  let liberar = () => {}
  const puerta = new Promise<void>((resolve) => { liberar = resolve })
  server.use(
    http.get('*/api/reparaciones/asignaciones', async () => {
      if (primeraHecha) await puerta
      primeraHecha = true
      return HttpResponse.json([estado.fila])
    }),
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
  return { estado, cuerpos, liberarGet: () => liberar() }
}

/** Tras reasignar, la fila desaparece del listado (p. ej. se cerró): la caché nunca vuelve a traerla. */
function servidorDeUnaFilaQueDesapareceTrasEscribir() {
  const estado: { fila: ReparacionResumen | null } = { fila: FILA }
  const cuerpos: CuerpoReasignar[] = []
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json(estado.fila ? [estado.fila] : [])),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.patch('*/api/reparaciones/asignaciones/:idRep', async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoReasignar
      cuerpos.push(cuerpo)
      if (!estado.fila || cuerpo.updatedAt !== estado.fila.updatedAt) return new HttpResponse(null, { status: 409 })
      estado.fila = null
      return new HttpResponse(null, { status: 200 })
    }),
  )
  return { cuerpos }
}

/** Tras reasignar, cualquier GET posterior falla (servidor caído): la caché se queda con el dato de antes de
 *  reasignar y `refetchQueries` (retry: false) resuelve igual, sin lanzar. */
function servidorDeUnaFilaConGetQueCaeTrasEscribir() {
  const estado = { fila: FILA }
  const cuerpos: CuerpoReasignar[] = []
  let primeraHecha = false
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => {
      if (primeraHecha) return new HttpResponse(null, { status: 500 })
      primeraHecha = true
      return HttpResponse.json([estado.fila])
    }),
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
  return { cuerpos }
}

/** En cuanto llega MI reasignación (a Técnico H), otro supertécnico mueve la misma fila a un tercer técnico
 *  (idTec 9), dentro de los 8 s del aviso: exactamente lo que Deshacer no debe pisar. */
function servidorDeUnaFilaQueOtroPisaDespues() {
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
      estado.fila = { ...estado.fila, idTec: cuerpo.idTec, nombreTecnico: 'Técnico H', updatedAt: UPDATED_AT_TRAS_ESCRIBIR }
      if (cuerpo.idTec === 6) {
        estado.fila = { ...estado.fila, idTec: 9, nombreTecnico: 'Técnico Otro', updatedAt: '2026-09-16T07:06:00' }
      }
      return new HttpResponse(null, { status: 200 })
    }),
  )
  return { estado, cuerpos }
}

describe('crearColumnas: la guarda del deshacer no manda una escritura condenada ni pisa un cambio ajeno', () => {
  it('la caché sin confirmar aún: Deshacer espera la recarga antes de escribir (no el camino rápido)', async () => {
    const { cuerpos, liberarGet } = servidorDeUnaFilaConGetRetenido()
    await reasignarATecnicoH()
    await screen.findByText('A20260916_1 reasignada a Técnico H')
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    // El GET posterior a reasignar está retenido: la caché sigue sin confirmar el cambio y la vuelta atrás
    // todavía no ha podido salir. Sin la espera de filaParaDeshacer, este PATCH ya habría salido.
    await new Promise((r) => setTimeout(r, 30))
    expect(cuerpos).toHaveLength(1)
    liberarGet()
    await vi.waitFor(() => expect(cuerpos).toHaveLength(2))
    expect(cuerpos[1]).toEqual({ idTec: 4, comentarioAsignacion: 'no tocar', updatedAt: UPDATED_AT_TRAS_ESCRIBIR })
  })

  it('la fila sale del listado tras reasignar: Deshacer no manda la fila capturada (409 garantizado) y avisa', async () => {
    const { cuerpos } = servidorDeUnaFilaQueDesapareceTrasEscribir()
    await reasignarATecnicoH()
    await screen.findByText('A20260916_1 reasignada a Técnico H')
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Error')).toBeInTheDocument()
    expect(within(dialogo).getByText(/no se ha confirmado el cambio en el servidor/)).toBeInTheDocument()
    // Ningún segundo PATCH: ni con la fila capturada (updatedAt caducado) ni con ninguna otra.
    expect(cuerpos).toHaveLength(1)
  })

  it('la recarga falla (servidor caído): Deshacer no manda el updatedAt caducado y avisa', async () => {
    const { cuerpos } = servidorDeUnaFilaConGetQueCaeTrasEscribir()
    await reasignarATecnicoH()
    await screen.findByText('A20260916_1 reasignada a Técnico H')
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Error')).toBeInTheDocument()
    expect(cuerpos).toHaveLength(1)
  })

  it('otro supertécnico mueve la fila dentro de los 8 s: Deshacer no la pisa y avisa (no basta con que sea "fresca")', async () => {
    const { estado, cuerpos } = servidorDeUnaFilaQueOtroPisaDespues()
    await reasignarATecnicoH()
    await screen.findByText('A20260916_1 reasignada a Técnico H')
    // El otro supertécnico ya movió la fila a Técnico Otro (idTec 9) en el propio PATCH de arriba.
    await vi.waitFor(() => expect(estado.fila.idTec).toBe(9))
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Error')).toBeInTheDocument()
    // No hay segundo PATCH: no se manda una reversión con la fila de otro técnico.
    expect(cuerpos).toHaveLength(1)
    expect(estado.fila.idTec).toBe(9)
  })
})
