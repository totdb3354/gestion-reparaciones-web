import { useReducer } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { agrupados } from '../test/fabrica'
import { estadoInicial, reducir, type DatosNuevo } from './estado'
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

/** Arnés para la primera acción "otro" y para la zona de guardar (modelo 13: componente otroi13, idCom 161). */
function ArnesAccion({ onGuardado, antesDeCerrar }: { onGuardado: () => void; antesDeCerrar?: () => Promise<void> }) {
  const [estado, dispatch] = useReducer(reducir, DATOS, estadoInicial)
  const { guardarAccion, pulsarGuardar } = useGuardado({ estado, dispatch, onGuardado, antesDeCerrar })
  const accion = estado.otros[0]
  return (
    <div>
      <button onClick={() => dispatch({ tipo: 'ANADIR_ACCION' })}>añadir</button>
      <button onClick={() => accion && dispatch({ tipo: 'ESCRIBIR_ACCION', id: accion.id, texto: '  Limpieza de conector  ' })}>escribir</button>
      <button onClick={() => accion && guardarAccion(accion.id)}>guardar acción</button>
      <button onClick={pulsarGuardar}>terminar</button>
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
