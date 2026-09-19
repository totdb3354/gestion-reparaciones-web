import { useReducer } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { agrupados, detalleEdicion } from '../test/fabrica'
import { estadoInicial, reducir, textoBotonGuardar, zonaGuardarVisible, type DatosEditar, type DatosNuevo } from './estado'
import { conRegistro, type LlamadaRegistrada } from './test/handlers'
import { fechaGuardado, useGuardado } from './useGuardado'

const DATOS: DatosNuevo = { modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000111', agrupados: agrupados(), solicitudes: [], incidencia: 'R20260910_3', modeloTelefono: '13' }

/** Escrituras en orden, sin las del borrador. `conRegistro` anota `metodo` en mayúsculas, `ruta` = pathname y `cuerpo` = JSON recibido. */
const escrituras = (llamadas: LlamadaRegistrada[]) =>
  llamadas.filter((l) => !l.ruta.endsWith('/borrador'))

/** Arnés del hook para la fila de batería (modelo 13: bati13, idCom 101, stock 5). */
function ArnesFila() {
  const [estado, dispatch] = useReducer(reducir, DATOS, estadoInicial)
  const { guardarFila } = useGuardado({ estado, dispatch, onGuardado: () => {} })
  const bat = estado.filas.find((f) => f.prefijo === 'bat')
  return (
    <div>
      <button onClick={() => dispatch({ tipo: 'SUMAR', prefijo: 'bat' })}>sumar</button>
      <button onClick={() => guardarFila('bat')}>guardar fila</button>
      <output data-testid="bat">{JSON.stringify({ confirmando: bat?.confirmandoGuardar, guardando: bat?.guardando, guardada: bat?.guardada })}</output>
    </div>
  )
}
const leer = () => JSON.parse(screen.getByTestId('bat').textContent ?? '{}') as { confirmando: boolean; guardando: boolean; guardada: { idRep: string; fecha: string } | null }

beforeEach(() => {
  // Solo se falsea Date (la fecha de "✓ Guardada" es la hora local): los temporizadores reales siguen sirviendo a MSW y a user-event.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 16, 9, 15))
})
afterEach(() => vi.useRealTimers())

describe('useGuardado · guardar fila', () => {
  it('fechaGuardado usa la hora local del navegador con ceros a la izquierda', () => {
    expect(fechaGuardado(new Date(2026, 8, 6, 9, 5))).toBe('06/09 09:05')
    expect(fechaGuardado(new Date(2026, 11, 24, 18, 40))).toBe('24/12 18:40')
  })

  it('el primer clic pide confirmación sin llamar; el segundo hace el POST con el cuerpo exacto y marca la fila guardada', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    renderConProviders(<ArnesFila />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: 'sumar' }))
    await userEvent.click(screen.getByRole('button', { name: 'guardar fila' }))
    expect(leer().confirmando).toBe(true)
    expect(escrituras(llamadas)).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'guardar fila' }))
    await waitFor(() => expect(leer().guardada).toEqual({ idRep: 'R20260916_9', fecha: '16/09 09:15' }))
    expect(escrituras(llamadas)).toEqual([
      {
        metodo: 'POST',
        ruta: '/api/reparaciones/A20260916_1/filas',
        cuerpo: {
          filas: [{ idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }],
          imei: '355400000000111',
          idTec: 4,
          idRepAnterior: 'R20260910_3',
        },
      },
    ])
  })

  it('error 409: aviso "No se pudo guardar la fila: <mensaje del servidor>" y la fila vuelve a estar editable', async () => {
    server.use(...conRegistro().handlers)
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => HttpResponse.json({ message: 'La asignación ya fue eliminada o completada' }, { status: 409 })))
    renderConProviders(<ArnesFila />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: 'sumar' }))
    await userEvent.click(screen.getByRole('button', { name: 'guardar fila' }))
    await userEvent.click(screen.getByRole('button', { name: 'guardar fila' }))
    expect(await screen.findByText('No se pudo guardar la fila: La asignación ya fue eliminada o completada')).toBeInTheDocument()
    expect(leer()).toEqual({ confirmando: false, guardando: false, guardada: null })
  })

  it('un corte de conexión no añade el literal de la fila (ya avisa el mecanismo global) pero rehabilita', async () => {
    server.use(...conRegistro().handlers)
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => new HttpResponse(null, { status: 503 })))
    renderConProviders(<ArnesFila />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: 'sumar' }))
    await userEvent.click(screen.getByRole('button', { name: 'guardar fila' }))
    await userEvent.click(screen.getByRole('button', { name: 'guardar fila' }))
    expect(await screen.findByText('Sin conexión con el servidor: HTTP 503')).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo guardar la fila/)).not.toBeInTheDocument()
    expect(leer()).toEqual({ confirmando: false, guardando: false, guardada: null })
  })
})

/** Arnés para la primera acción "otro", la fila de batería y la zona de guardar (modelo 13: componente otroi13, idCom 161;
 *  bati13, idCom 101). */
function ArnesAccion({ onGuardado, antesDeCerrar }: { onGuardado: () => void; antesDeCerrar?: () => Promise<void> }) {
  const [estado, dispatch] = useReducer(reducir, DATOS, estadoInicial)
  const { guardarAccion, guardarFila, pulsarGuardar } = useGuardado({ estado, dispatch, onGuardado, antesDeCerrar })
  const accion = estado.otros[0]
  const bat = estado.filas.find((f) => f.prefijo === 'bat')
  return (
    <div>
      <button onClick={() => dispatch({ tipo: 'SUMAR', prefijo: 'bat' })}>sumar</button>
      <button onClick={() => guardarFila('bat')}>guardar fila</button>
      <button onClick={() => dispatch({ tipo: 'ANADIR_ACCION' })}>añadir</button>
      <button onClick={() => accion && dispatch({ tipo: 'ESCRIBIR_ACCION', id: accion.id, texto: '  Limpieza de conector  ' })}>escribir</button>
      <button onClick={() => accion && guardarAccion(accion.id)}>guardar acción</button>
      <button onClick={pulsarGuardar}>terminar</button>
      <output data-testid="bat">{JSON.stringify({ confirmando: bat?.confirmandoGuardar, guardando: bat?.guardando, guardada: bat?.guardada })}</output>
      <output data-testid="accion">{JSON.stringify(accion ? { confirmando: accion.confirmando, guardando: accion.guardando, guardada: accion.guardada } : null)}</output>
      <output data-testid="guardado">{JSON.stringify(estado.guardado)}</output>
    </div>
  )
}
const leerAccion = () => JSON.parse(screen.getByTestId('accion').textContent ?? 'null') as { confirmando: boolean; guardando: boolean; guardada: { idRep: string; fecha: string } | null }
const leerGuardado = () => JSON.parse(screen.getByTestId('guardado').textContent ?? '{}') as { clics: number; textoConfirmacion: boolean; enCurso: boolean }
const pulsar = (nombre: string) => userEvent.click(screen.getByRole('button', { name: nombre }))

const FILA_ACCION = { idCom: 161, cantidad: 0, reutilizado: false, observacion: 'Limpieza de conector', prefijo: 'otro', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }

describe('useGuardado · guardar acción y terminar', () => {
  it('acción: el primer clic pide confirmación; el segundo hace el POST con la fila "otro" recortada y la marca guardada', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    renderConProviders(<ArnesAccion onGuardado={() => {}} />, { sesion: SESION_TEC })
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('guardar acción')
    expect(leerAccion().confirmando).toBe(true)
    expect(escrituras(llamadas)).toEqual([])
    await pulsar('guardar acción')
    await waitFor(() => expect(leerAccion().guardada).toEqual({ idRep: 'R20260916_9', fecha: '16/09 09:15' }))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3' } },
    ])
  })

  it('acción con error: aviso "No se pudo guardar la acción: <mensaje>" y el siguiente clic vuelve a pedir confirmación', async () => {
    server.use(...conRegistro().handlers)
    let intentos = 0
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => { intentos++; return HttpResponse.json({ message: 'Componente no válido' }, { status: 422 }) }))
    renderConProviders(<ArnesAccion onGuardado={() => {}} />, { sesion: SESION_TEC })
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('guardar acción')
    await pulsar('guardar acción')
    expect(await screen.findByText('No se pudo guardar la acción: Componente no válido')).toBeInTheDocument()
    expect(intentos).toBe(1)
    expect(leerAccion().guardando).toBe(false)
    expect(leerAccion().guardada).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await pulsar('guardar acción')
    expect(intentos).toBe(1)
    await pulsar('guardar acción')
    await waitFor(() => expect(intentos).toBe(2))
  })

  it('terminar: primer clic confirma, segundo ejecuta; antesDeCerrar se espera tras completa y antes de onGuardado', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const orden: string[] = []
    renderConProviders(<ArnesAccion onGuardado={() => orden.push('guardado')} antesDeCerrar={async () => { orden.push(`antes:${escrituras(llamadas).length}`) }} />, { sesion: SESION_TEC })
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('terminar')
    expect(leerGuardado()).toEqual({ clics: 1, textoConfirmacion: true, enCurso: false })
    expect(escrituras(llamadas)).toEqual([])
    await pulsar('terminar')
    await waitFor(() => expect(orden).toEqual(['antes:1', 'guardado']))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3', idAsignacion: 'A20260916_1', categoria: null } },
    ])
  })

  it('un fallo de antesDeCerrar no impide cerrar', async () => {
    server.use(...conRegistro().handlers)
    const onGuardado = vi.fn()
    renderConProviders(<ArnesAccion onGuardado={onGuardado} antesDeCerrar={() => Promise.reject(new Error('sin borrador'))} />, { sesion: SESION_TEC })
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('terminar')
    await pulsar('terminar')
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1))
  })

  it('terminar con corte de conexión: no pone el literal, pero deja el guardado listo para reintentar', async () => {
    server.use(...conRegistro().handlers)
    server.use(http.post('*/api/reparaciones/completa', () => new HttpResponse(null, { status: 503 })))
    const onGuardado = vi.fn()
    renderConProviders(<ArnesAccion onGuardado={onGuardado} />, { sesion: SESION_TEC })
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('terminar')
    await pulsar('terminar')
    expect(await screen.findByText('Sin conexión con el servidor: HTTP 503')).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo guardar/)).not.toBeInTheDocument()
    expect(leerGuardado()).toEqual({ clics: 0, textoConfirmacion: true, enCurso: false })
    expect(onGuardado).not.toHaveBeenCalled()
  })
})

const FILA_BAT = { idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }

/** Sostiene el POST de "completa" abierto hasta que el test llama a `soltar()`, y anota la llamada en `llamadas` al
 *  resolverse (igual que hace `conRegistro`, pero este handler la sustituye por delante: gana el registrado en último lugar). */
function completaEnVuelo(llamadas: LlamadaRegistrada[]) {
  let soltar: () => void = () => {}
  const puerta = new Promise<void>((resolve) => { soltar = resolve })
  server.use(http.post('*/api/reparaciones/completa', async ({ request }) => {
    const cuerpo = await request.json()
    await puerta
    llamadas.push({ metodo: request.method, ruta: new URL(request.url).pathname, cuerpo })
    return new HttpResponse(null, { status: 201 })
  }))
  return () => soltar()
}

describe('useGuardado · "Terminar asignación" en curso bloquea guardar fila y guardar acción por separado', () => {
  it('"✓ Guardar fila" no añade su propio POST /filas mientras "completa" está en vuelo: la fila ya viaja dentro', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const soltar = completaEnVuelo(llamadas)
    renderConProviders(<ArnesAccion onGuardado={() => {}} />, { sesion: SESION_TEC })
    await pulsar('sumar')
    await pulsar('terminar')
    await pulsar('terminar')
    // "completa" está en vuelo (guardado.enCurso = true): dos clics sobre "✓ Guardar fila" de esa misma fila no deben
    // añadir un POST /filas aparte (duplicaría el descuento de stock en el servidor).
    await pulsar('guardar fila')
    await pulsar('guardar fila')
    soltar()
    await waitFor(() => expect(escrituras(llamadas).some((l) => l.ruta.endsWith('/completa'))).toBe(true))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: { filas: [FILA_BAT], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3', idAsignacion: 'A20260916_1', categoria: null } },
    ])
  })

  it('"✓ Guardar" de una acción no añade su propio POST /filas mientras "completa" está en vuelo', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const soltar = completaEnVuelo(llamadas)
    renderConProviders(<ArnesAccion onGuardado={() => {}} />, { sesion: SESION_TEC })
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('terminar')
    await pulsar('terminar')
    await pulsar('guardar acción')
    await pulsar('guardar acción')
    soltar()
    await waitFor(() => expect(escrituras(llamadas).some((l) => l.ruta.endsWith('/completa'))).toBe(true))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3', idAsignacion: 'A20260916_1', categoria: null } },
    ])
  })
})

/** Sostiene el POST de "filas" (guardar fila o guardar acción, mismo endpoint) en vuelo hasta que el test llama a
 *  `soltar()`, mirror de `completaEnVuelo` en el sentido contrario. */
function filaEnVuelo(llamadas: LlamadaRegistrada[]) {
  let soltar: () => void = () => {}
  const puerta = new Promise<void>((resolve) => { soltar = resolve })
  server.use(http.post('*/api/reparaciones/:idAsignacion/filas', async ({ request }) => {
    const cuerpo = await request.json()
    await puerta
    llamadas.push({ metodo: request.method, ruta: new URL(request.url).pathname, cuerpo })
    return HttpResponse.json({ value: 'R20260916_9' }, { status: 201 })
  }))
  return () => soltar()
}

describe('useGuardado · guardar fila o guardar acción en curso bloquea "Terminar asignación"', () => {
  it('"Terminar asignación" no lanza su propio "completa" mientras una fila se está guardando por separado: viajaría duplicada', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const soltar = filaEnVuelo(llamadas)
    renderConProviders(<ArnesAccion onGuardado={() => {}} />, { sesion: SESION_TEC })
    await pulsar('sumar')
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('guardar fila')
    await pulsar('guardar fila')
    // La fila está guardando (POST /filas en vuelo): dos clics sobre "terminar" no deben lanzar "completa" (duplicaría
    // el descuento de stock en el servidor).
    await pulsar('terminar')
    await pulsar('terminar')
    soltar()
    await waitFor(() => expect(escrituras(llamadas).some((l) => l.ruta.endsWith('/filas'))).toBe(true))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo: { filas: [FILA_BAT], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3' } },
    ])
    // Con la fila ya guardada, dos clics más sobre "terminar" completan sin volver a incluirla.
    await pulsar('terminar')
    await pulsar('terminar')
    await waitFor(() => expect(escrituras(llamadas).some((l) => l.ruta.endsWith('/completa'))).toBe(true))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo: { filas: [FILA_BAT], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3' } },
      { metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3', idAsignacion: 'A20260916_1', categoria: null } },
    ])
  })

  it('"Terminar asignación" no lanza su propio "completa" mientras una acción se está guardando por separado', async () => {
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const soltar = filaEnVuelo(llamadas)
    renderConProviders(<ArnesAccion onGuardado={() => {}} />, { sesion: SESION_TEC })
    await pulsar('sumar')
    await pulsar('añadir')
    await pulsar('escribir')
    await pulsar('guardar acción')
    await pulsar('guardar acción')
    await pulsar('terminar')
    await pulsar('terminar')
    soltar()
    await waitFor(() => expect(escrituras(llamadas).some((l) => l.ruta.endsWith('/filas'))).toBe(true))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3' } },
    ])
    await pulsar('terminar')
    await pulsar('terminar')
    await waitFor(() => expect(escrituras(llamadas).some((l) => l.ruta.endsWith('/completa'))).toBe(true))
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3' } },
      { metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: { filas: [FILA_BAT], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3', idAsignacion: 'A20260916_1', categoria: null } },
    ])
  })
})

const DATOS_EDITAR: DatosEditar = { modo: 'editar', idRep: 'R20260916_5', detalle: detalleEdicion(), agrupados: agrupados(), yaReparados: [], accionesYaReparadas: [] }

/** Arnés mínimo: el reductor real, el hook y botones que despachan lo que en la vista hacen las filas. */
function ArnesEdicion({ datos, onGuardado }: { datos: DatosEditar; onGuardado: () => void }) {
  const [estado, dispatch] = useReducer(reducir, datos, estadoInicial)
  const { pulsarGuardar } = useGuardado({ estado, dispatch, onGuardado })
  const ultima = estado.otros[estado.otros.length - 1]
  return (
    <>
      <button onClick={() => dispatch({ tipo: 'SUMAR', prefijo: 'bat' })}>sumar bat</button>
      <button onClick={() => dispatch({ tipo: 'SUMAR', prefijo: 'cam' })}>sumar cam</button>
      <button onClick={() => dispatch({ tipo: 'SUMAR', prefijo: 'mc' })}>sumar mc</button>
      <button onClick={() => dispatch({ tipo: 'ANADIR_ACCION' })}>añadir acción</button>
      <button onClick={() => ultima && dispatch({ tipo: 'ESCRIBIR_ACCION', id: ultima.id, texto: 'Limpieza interna' })}>escribir acción</button>
      {zonaGuardarVisible(estado) && <button data-testid="guardar" onClick={pulsarGuardar}>{textoBotonGuardar(estado)}</button>}
    </>
  )
}
function montarEdicion(datos: DatosEditar = DATOS_EDITAR) {
  const registro = conRegistro()
  server.use(...registro.handlers)
  const onGuardado = vi.fn()
  renderConProviders(<ArnesEdicion datos={datos} onGuardado={onGuardado} />, { sesion: SESION_SUPER })
  return { ...registro, onGuardado }
}
// `pulsar(nombre)` ya existe en este fichero desde la Task 15 (clic en el botón con ese nombre): se reutiliza, no se redeclara.

describe('useGuardado — "Guardar cambios" (modo edición)', () => {
  it('"Guardar cambios" → "✓  Confirmar terminar" → PUT y, con filas y acciones nuevas, dos POST completa en ese orden con el idTec original', async () => {
    const { llamadas, onGuardado } = montarEdicion()
    await pulsar('sumar bat')
    await pulsar('sumar cam')
    await pulsar('añadir acción')
    await pulsar('escribir acción')
    expect(screen.getByTestId('guardar').textContent).toBe('Guardar cambios')
    await userEvent.click(screen.getByTestId('guardar'))
    expect(screen.getByTestId('guardar').textContent).toBe('✓  Confirmar terminar')
    expect(llamadas).toHaveLength(0)
    await userEvent.click(screen.getByTestId('guardar'))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1))
    // `conRegistro` anota `metodo` en mayúsculas y `ruta` = pathname.
    expect(llamadas.map((l) => `${l.metodo} ${l.ruta}`)).toEqual([
      'PUT /api/reparaciones/R20260916_5',
      'POST /api/reparaciones/completa',
      'POST /api/reparaciones/completa',
    ])
    expect(llamadas[0].cuerpo).toEqual({ idComNuevo: 101, esReutilizadoNuevo: false, observacionNueva: null, nNuevas: 2, updatedAt: '2026-09-16T07:02:00' })
    // Sesión: supertécnico con idTec 3. El trabajo nuevo va a nombre del técnico ORIGINAL (4), sin asignación ni incidencia.
    expect(llamadas[1].cuerpo).toMatchObject({ imei: '355400000000111', idTec: 4, idAsignacion: null, idRepAnterior: null, categoria: null, filas: [{ idCom: 121, cantidad: 1, reutilizado: false, prefijo: 'cam', esSolicitud: false }] })
    expect(llamadas[2].cuerpo).toMatchObject({ imei: '355400000000111', idTec: 4, idAsignacion: null, idRepAnterior: null, categoria: null, filas: [{ idCom: 161, cantidad: 0, prefijo: 'otro', observacion: 'Limpieza interna' }] })
  })

  it('edición de una G…: completa lleva categoria "G"', async () => {
    const { llamadas, onGuardado } = montarEdicion({ ...DATOS_EDITAR, idRep: 'G20260916_3', detalle: detalleEdicion({ idCom: 141 }) })
    await pulsar('sumar mc')
    await userEvent.click(screen.getByTestId('guardar'))
    await userEvent.click(screen.getByTestId('guardar'))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1))
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].cuerpo).toMatchObject({ categoria: 'G', idTec: 4, idAsignacion: null, filas: [{ idCom: 151, prefijo: 'mc' }] })
  })

  it('409: aviso literal de dos líneas, no se cierra, y hacen falta otros dos clics con el texto aún en "✓  Confirmar terminar"', async () => {
    const { llamadas, onGuardado } = montarEdicion()
    server.use(http.put('*/api/reparaciones/R20260916_5', () => HttpResponse.json({ message: 'El registro fue modificado por otro usuario' }, { status: 409 })))
    await pulsar('sumar bat')
    await userEvent.click(screen.getByTestId('guardar'))
    await userEvent.click(screen.getByTestId('guardar'))
    const aviso = await screen.findByRole('dialog', { name: 'Error' })
    expect(within(aviso).getByText(/otro usuario modificó/).textContent).toBe('No se pudo guardar: otro usuario modificó esta reparación.\nCierra y vuelve a abrir el formulario para ver los cambios actuales.')
    expect(onGuardado).not.toHaveBeenCalled()
    expect(llamadas).toHaveLength(0)
    await userEvent.click(within(aviso).getByRole('button', { name: 'Aceptar' }))
    expect(screen.getByTestId('guardar').textContent).toBe('✓  Confirmar terminar')
    server.use(http.put('*/api/reparaciones/R20260916_5', () => new HttpResponse(null, { status: 204 })))
    await userEvent.click(screen.getByTestId('guardar'))
    expect(onGuardado).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTestId('guardar'))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1))
  })

  it('otro error: "No se pudo guardar: <mensaje>"; lo ya hecho no se deshace y los pasos siguientes no se ejecutan', async () => {
    const { llamadas, onGuardado } = montarEdicion()
    server.use(http.post('*/api/reparaciones/completa', () => HttpResponse.json({ message: 'Stock insuficiente para cami13' }, { status: 422 })))
    await pulsar('sumar bat')
    await pulsar('sumar cam')
    await pulsar('añadir acción')
    await pulsar('escribir acción')
    await userEvent.click(screen.getByTestId('guardar'))
    await userEvent.click(screen.getByTestId('guardar'))
    const aviso = await screen.findByRole('dialog', { name: 'Error' })
    expect(within(aviso).getByText(/No se pudo guardar/).textContent).toBe('No se pudo guardar: Stock insuficiente para cami13')
    // El PUT (paso 1) llegó al registro; el completa que falló lo atendió el handler de arriba y el de acciones no salió.
    expect(llamadas.map((l) => `${l.metodo} ${l.ruta}`)).toEqual(['PUT /api/reparaciones/R20260916_5'])
    expect(onGuardado).not.toHaveBeenCalled()
  })
})
