import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ConexionError, NoEncontradoError, PermisoError, StaleDataError } from '@/shared/api/errors'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { AlertaProvider } from '@/shared/ui/AlertaProvider'
import { SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { CLAVE_CONTADORES, claveAsignaciones, claveHistorial } from '../api'
import { BORRADOR_JAVAFX, agrupados, asignacionActiva, detalleEdicion, reparacion, solicitudAsignacion } from '../test/fabrica'
import {
  CLAVE_NOTIF, borrarBorrador, cargarEditar, cargarNuevo, claveCargaEditar, claveCargaNuevo, guardarBorrador, idsReparacionesDelImei,
  useAgotarComponente, useCargaEditar, useCargaNuevo, useCompleta, useEditarReparacion, useGuardarFila, useRecargarAlCerrar,
} from './api'
import { conRegistro, handlersFormulario } from './test/handlers'

function envoltorio(sesion: typeof SESION_TEC) {
  guardarSesion(sesion)
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider><AlertaProvider>{children}</AlertaProvider></SessionProvider></QueryClientProvider>
  )
  return { wrapper, qc }
}

describe('cargarNuevo', () => {
  it('compone DatosNuevo con el imei de la asignación', async () => {
    guardarSesion(SESION_TEC)
    const solicitudes = [solicitudAsignacion({ idCom: 102 })]
    const activas = [asignacionActiva()]
    server.use(...handlersFormulario({ asignacion: { imei: '355400000000222' }, solicitudes, incidencia: 'R20260910_3', activas, modeloTelefono: '14', borrador: BORRADOR_JAVAFX }))
    const carga = await cargarNuevo('A20260916_1')
    expect(carga.datos).toEqual({
      modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000222', agrupados: agrupados(), solicitudes, incidencia: 'R20260910_3',
      modeloTelefono: '14',
    })
    expect(Object.keys(carga.datos.agrupados)).toEqual(['bat', 'cha', 'g', 'mc', 'lcd', 'cam', 'otro'])
    expect(carga.asignacionesActivas).toEqual(activas)
    expect(carga.borradorJson).toBe(BORRADOR_JAVAFX)
  })
  it('pide la incidencia con tipo=R y, para una AG, con tipo=G y modo glass', async () => {
    guardarSesion(SESION_TEC)
    const consultas: string[] = []
    server.use(...handlersFormulario())
    server.use(
      http.get('*/api/reparaciones/imei/:imei/incidencia-activa', ({ request, params }) => {
        consultas.push(`${String(params.imei)}${new URL(request.url).search}`)
        return HttpResponse.json({ value: null })
      }),
    )
    expect((await cargarNuevo('A20260916_1')).datos.modo).toBe('nuevo')
    expect((await cargarNuevo('AG20260916_2')).datos).toMatchObject({ modo: 'glass', idAsignacion: 'AG20260916_2', incidencia: null })
    expect(consultas).toEqual(['355400000000111?tipo=R', '355400000000111?tipo=G'])
  })
  it("modelo '' llega como null y sin borrador llega null", async () => {
    guardarSesion(SESION_TEC)
    server.use(...handlersFormulario())
    const carga = await cargarNuevo('A20260916_1')
    expect(carga.datos.modeloTelefono).toBeNull()
    expect(carga.borradorJson).toBeNull()
    expect(carga.asignacionesActivas).toEqual([])
  })
  it('un fallo en asignaciones-activas, en el modelo o en el borrador no rompe la carga', async () => {
    guardarSesion(SESION_TEC)
    server.use(...handlersFormulario({ incidencia: 'R20260910_3' }))
    server.use(
      http.get('*/api/reparaciones/imei/:imei/asignaciones-activas', () => HttpResponse.json({ message: 'fallo' }, { status: 422 })),
      http.get('*/api/telefonos/:imei/modelo', () => new HttpResponse(null, { status: 404 })),
      http.get('*/api/reparaciones/:idRep/borrador', () => HttpResponse.json({ message: 'fallo' }, { status: 409 })),
    )
    const carga = await cargarNuevo('A20260916_1')
    expect(carga.asignacionesActivas).toEqual([])
    expect(carga.datos.modeloTelefono).toBeNull()
    expect(carga.borradorJson).toBeNull()
    expect(carga.datos.incidencia).toBe('R20260910_3')
  })
  it('un 403 del borrador se propaga como PermisoError (la asignación es de otro técnico)', async () => {
    guardarSesion(SESION_TEC)
    server.use(...handlersFormulario())
    server.use(http.get('*/api/reparaciones/:idRep/borrador', () => new HttpResponse(null, { status: 403 })))
    await expect(cargarNuevo('A20260916_1')).rejects.toBeInstanceOf(PermisoError)
  })
  it('un fallo en la incidencia, en las solicitudes o en los componentes rechaza la carga', async () => {
    guardarSesion(SESION_TEC)
    server.use(...handlersFormulario())
    server.use(http.get('*/api/reparaciones/imei/:imei/incidencia-activa', () => HttpResponse.json({ message: 'Tipo no válido' }, { status: 422 })))
    await expect(cargarNuevo('A20260916_1')).rejects.toThrow('Tipo no válido')
    server.resetHandlers()
    server.use(...handlersFormulario())
    server.use(http.get('*/api/reparaciones/asignaciones/:idAsignacion/solicitudes', () => HttpResponse.text('boom', { status: 503 })))
    await expect(cargarNuevo('A20260916_1')).rejects.toBeInstanceOf(ConexionError)
    server.resetHandlers()
    server.use(...handlersFormulario())
    server.use(http.get('*/api/componentes/agrupados', () => HttpResponse.json({ message: 'sin catálogo' }, { status: 422 })))
    await expect(cargarNuevo('A20260916_1')).rejects.toThrow('sin catálogo')
  })
  it('una asignación que no existe rechaza con NoEncontradoError y no pide nada más', async () => {
    guardarSesion(SESION_TEC)
    let otras = 0
    server.use(
      http.get('*/api/reparaciones/asignaciones/:idRep', () => new HttpResponse(null, { status: 404 })),
      http.get('*/api/componentes/agrupados', () => { otras++; return HttpResponse.json({}) }),
    )
    await expect(cargarNuevo('A20260916_404')).rejects.toBeInstanceOf(NoEncontradoError)
    expect(otras).toBe(0)
  })
})

describe('cargarEditar', () => {
  it('encadena detalle → agrupados + ya-reparados(excluir) + acciones(categoria, excluir)', async () => {
    guardarSesion(SESION_SUPER)
    const consultas: string[] = []
    const detalle = detalleEdicion({ imei: '355400000000222', idCom: 111 })
    server.use(...handlersFormulario({ detalle }))
    server.use(
      http.get('*/api/reparaciones/imei/:imei/ya-reparados', ({ request, params }) => {
        consultas.push(`ya-reparados ${String(params.imei)}${new URL(request.url).search}`)
        return HttpResponse.json([101, 121])
      }),
      http.get('*/api/reparaciones/imei/:imei/acciones', ({ request, params }) => {
        consultas.push(`acciones ${String(params.imei)}${new URL(request.url).search}`)
        return HttpResponse.json(['Limpieza del conector de carga'])
      }),
    )
    const datos = await cargarEditar('R20260916_5')
    expect(datos).toEqual({ modo: 'editar', idRep: 'R20260916_5', detalle, agrupados: agrupados(), yaReparados: [101, 121], accionesYaReparadas: ['Limpieza del conector de carga'] })
    expect(consultas.sort()).toEqual(['acciones 355400000000222?categoria=R&excluir=R20260916_5', 'ya-reparados 355400000000222?excluir=R20260916_5'])
  })
  it('categoria=G para un idRep que empieza por G', async () => {
    guardarSesion(SESION_SUPER)
    let consulta = ''
    server.use(...handlersFormulario())
    server.use(
      http.get('*/api/reparaciones/imei/:imei/acciones', ({ request }) => { consulta = new URL(request.url).search; return HttpResponse.json([]) }),
    )
    await cargarEditar('G20260916_64')
    expect(consulta).toBe('?categoria=G&excluir=G20260916_64')
  })
  it('un fallo en las acciones ya reparadas es silencioso; en ya-reparados, no', async () => {
    guardarSesion(SESION_SUPER)
    server.use(...handlersFormulario({ yaReparados: [101] }))
    server.use(http.get('*/api/reparaciones/imei/:imei/acciones', () => HttpResponse.json({ message: 'fallo' }, { status: 422 })))
    expect((await cargarEditar('R20260916_5')).accionesYaReparadas).toEqual([])
    server.resetHandlers()
    server.use(...handlersFormulario())
    server.use(http.get('*/api/reparaciones/imei/:imei/ya-reparados', () => HttpResponse.json({ message: 'fallo al leer' }, { status: 422 })))
    await expect(cargarEditar('R20260916_5')).rejects.toThrow('fallo al leer')
  })
  it('un 403 del detalle se propaga y un detalle vacío es NoEncontradoError', async () => {
    guardarSesion(SESION_TEC)
    server.use(...handlersFormulario())
    server.use(http.get('*/api/reparaciones/:idRep/detalle-edicion', () => new HttpResponse(null, { status: 403 })))
    await expect(cargarEditar('R20260916_5')).rejects.toBeInstanceOf(PermisoError)
    server.resetHandlers()
    server.use(...handlersFormulario())
    server.use(http.get('*/api/reparaciones/:idRep/detalle-edicion', () => new HttpResponse(null, { status: 200 })))
    await expect(cargarEditar('R20260916_5')).rejects.toBeInstanceOf(NoEncontradoError)
  })
})

describe('useCargaNuevo y useCargaEditar', () => {
  it('cargan con su clave y un fallo no abre el aviso global (lo pone la vista)', async () => {
    const { wrapper, qc } = envoltorio(SESION_TEC)
    server.use(...handlersFormulario({ modeloTelefono: '13' }))
    const ok = renderHook(() => useCargaNuevo('A20260916_1'), { wrapper })
    await waitFor(() => expect(ok.result.current.isSuccess).toBe(true))
    expect(ok.result.current.data?.datos.modeloTelefono).toBe('13')
    expect(qc.getQueryData(claveCargaNuevo('A20260916_1'))).toBe(ok.result.current.data)
    server.use(http.get('*/api/reparaciones/:idRep/borrador', () => new HttpResponse(null, { status: 403 })))
    const ko = renderHook(() => useCargaNuevo('A20260916_7'), { wrapper })
    await waitFor(() => expect(ko.result.current.isError).toBe(true))
    expect(ko.result.current.error).toBeInstanceOf(PermisoError)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('useCargaEditar carga con su clave', async () => {
    const { wrapper, qc } = envoltorio(SESION_SUPER)
    server.use(...handlersFormulario({ yaReparados: [121] }))
    const h = renderHook(() => useCargaEditar('R20260916_5'), { wrapper })
    await waitFor(() => expect(h.result.current.isSuccess).toBe(true))
    expect(h.result.current.data?.yaReparados).toEqual([121])
    expect(qc.getQueryData(claveCargaEditar('R20260916_5'))).toBe(h.result.current.data)
  })
  it('no se queda en caché al desmontar: reabrir vuelve a pedirlo todo', async () => {
    const { wrapper } = envoltorio(SESION_TEC)
    let peticiones = 0
    server.use(...handlersFormulario())
    server.use(http.get('*/api/componentes/agrupados', () => { peticiones++; return HttpResponse.json(agrupados()) }))
    const primera = renderHook(() => useCargaNuevo('A20260916_1'), { wrapper })
    await waitFor(() => expect(primera.result.current.isSuccess).toBe(true))
    primera.unmount()
    const segunda = renderHook(() => useCargaNuevo('A20260916_1'), { wrapper })
    await waitFor(() => expect(segunda.result.current.isSuccess).toBe(true))
    expect(peticiones).toBe(2)
  })
})

describe('mutaciones del formulario', () => {
  const fila = { idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }

  it('useGuardarFila envía el cuerpo tal cual y devuelve el idRep', async () => {
    const { wrapper } = envoltorio(SESION_TEC)
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const cuerpo = { filas: [fila], imei: '355400000000111', idTec: 4, idRepAnterior: 'R20260910_3' }
    const m = renderHook(() => useGuardarFila(), { wrapper })
    await expect(m.result.current.mutateAsync({ idAsignacion: 'A20260916_1', cuerpo })).resolves.toBe('R20260916_9')
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo }])
  })
  it('useGuardarFila devuelve "?" si el servidor no da id', async () => {
    const { wrapper } = envoltorio(SESION_TEC)
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => HttpResponse.json({ value: null }, { status: 201 })))
    const m = renderHook(() => useGuardarFila(), { wrapper })
    await expect(m.result.current.mutateAsync({ idAsignacion: 'A20260916_1', cuerpo: { filas: [fila], imei: '355400000000111', idTec: 4, idRepAnterior: null } })).resolves.toBe('?')
  })
  it('useCompleta, useAgotarComponente y useEditarReparacion envían el cuerpo tal cual, en el orden en que se llaman', async () => {
    const { wrapper } = envoltorio(SESION_SUPER)
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    const agotar = { idCom: 121, cantidad: 4, descripcion: null }
    const completa = { filas: [fila], imei: '355400000000111', idTec: 3, idRepAnterior: null, idAsignacion: 'A20260916_1', categoria: null }
    const editar = { idComNuevo: 101, esReutilizadoNuevo: false, observacionNueva: null, nNuevas: 2, updatedAt: '2026-09-16T07:02:00' }
    const a = renderHook(() => useAgotarComponente(), { wrapper })
    const c = renderHook(() => useCompleta(), { wrapper })
    const e = renderHook(() => useEditarReparacion(), { wrapper })
    await a.result.current.mutateAsync({ idAsignacion: 'A20260916_1', cuerpo: agotar })
    await c.result.current.mutateAsync(completa)
    await e.result.current.mutateAsync({ idRep: 'R20260916_5', cuerpo: editar })
    expect(llamadas).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/agotar-componente', cuerpo: agotar },
      { metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: completa },
      { metodo: 'PUT', ruta: '/api/reparaciones/R20260916_5', cuerpo: editar },
    ])
  })
  it('ninguna mutación abre el aviso global ante un 409 (meta.silenciarError): el literal lo pone la vista', async () => {
    const { wrapper } = envoltorio(SESION_SUPER)
    const conflicto = () => HttpResponse.json({ message: 'La asignación ya fue completada' }, { status: 409 })
    server.use(
      http.post('*/api/reparaciones/completa', conflicto),
      http.post('*/api/reparaciones/:idAsignacion/filas', conflicto),
      http.post('*/api/reparaciones/:idAsignacion/agotar-componente', conflicto),
      http.put('*/api/reparaciones/:idRep', conflicto),
    )
    const g = renderHook(() => useGuardarFila(), { wrapper })
    const a = renderHook(() => useAgotarComponente(), { wrapper })
    const c = renderHook(() => useCompleta(), { wrapper })
    const e = renderHook(() => useEditarReparacion(), { wrapper })
    const errores = await Promise.all([
      g.result.current.mutateAsync({ idAsignacion: 'A20260916_1', cuerpo: { filas: [fila], imei: '355400000000111', idTec: 4, idRepAnterior: null } }).catch((x: unknown) => x),
      a.result.current.mutateAsync({ idAsignacion: 'A20260916_1', cuerpo: { idCom: 121, cantidad: 0, descripcion: null } }).catch((x: unknown) => x),
      c.result.current.mutateAsync({ filas: [], imei: '355400000000111', idTec: 4, idRepAnterior: null, idAsignacion: 'A20260916_1', categoria: null }).catch((x: unknown) => x),
      e.result.current.mutateAsync({ idRep: 'R20260916_5', cuerpo: { idComNuevo: 101, esReutilizadoNuevo: false, observacionNueva: null, nNuevas: 1, updatedAt: '2026-09-16T07:02:00' } }).catch((x: unknown) => x),
    ])
    for (const err of errores) {
      expect(err).toBeInstanceOf(StaleDataError)
      expect((err as Error).message).toBe('La asignación ya fue completada')
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('borrador y verificación de filas guardadas', () => {
  it('guardarBorrador envía { contenido } y borrarBorrador hace DELETE, sobre la ruta de la asignación', async () => {
    guardarSesion(SESION_TEC)
    const { handlers, llamadas } = conRegistro()
    server.use(...handlers)
    await guardarBorrador('A20260916_1', BORRADOR_JAVAFX)
    await borrarBorrador('A20260916_1')
    expect(llamadas).toEqual([
      { metodo: 'PUT', ruta: '/api/reparaciones/A20260916_1/borrador', cuerpo: { contenido: BORRADOR_JAVAFX } },
      { metodo: 'DELETE', ruta: '/api/reparaciones/A20260916_1/borrador', cuerpo: null },
    ])
  })
  it('las dos LANZAN si fallan: el silencio lo decide quien llama', async () => {
    guardarSesion(SESION_TEC)
    server.use(
      http.put('*/api/reparaciones/:idRep/borrador', () => new HttpResponse(null, { status: 403 })),
      http.delete('*/api/reparaciones/:idRep/borrador', () => HttpResponse.text('boom', { status: 503 })),
    )
    await expect(guardarBorrador('A20260916_1', '{}')).rejects.toBeInstanceOf(PermisoError)
    await expect(borrarBorrador('A20260916_1')).rejects.toBeInstanceOf(ConexionError)
  })
  it('idsReparacionesDelImei devuelve los idRep', async () => {
    guardarSesion(SESION_TEC)
    server.use(...handlersFormulario({ reparacionesImei: [reparacion(), reparacion({ idRep: 'R20260916_6' })] }))
    await expect(idsReparacionesDelImei('355400000000111')).resolves.toEqual(['R20260916_5', 'R20260916_6'])
    server.use(http.get('*/api/reparaciones/imei/:imei', () => new HttpResponse(null, { status: 404 })))
    await expect(idsReparacionesDelImei('355400000000111')).rejects.toBeInstanceOf(NoEncontradoError)
  })
})

describe('useRecargarAlCerrar', () => {
  it('invalida asignaciones, contadores, historiales y notificaciones, y nada más', () => {
    const { wrapper, qc } = envoltorio(SESION_TEC)
    const claves = [
      [...claveAsignaciones('REPARACION'), 'propio'], [...claveAsignaciones('GLASS'), 'propio'], [...claveAsignaciones('PULIDO'), 'propio'],
      [...CLAVE_CONTADORES, 'propio'], claveHistorial('REPARACION'), claveHistorial('GLASS'), claveHistorial('PULIDO'),
      [...CLAVE_NOTIF, 'contador'], [...CLAVE_NOTIF, 'solicitudes'],
    ]
    for (const clave of claves) qc.setQueryData(clave, [])
    qc.setQueryData(['clientes', 'activos'], [])
    const h = renderHook(() => useRecargarAlCerrar(), { wrapper })
    h.result.current()
    for (const clave of claves) expect(qc.getQueryState(clave)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['clientes', 'activos'])?.isInvalidated).toBe(false)
  })
  it('la función es estable entre renders (sirve de dependencia de un efecto)', () => {
    const { wrapper } = envoltorio(SESION_TEC)
    const h = renderHook(() => useRecargarAlCerrar(), { wrapper })
    const primera = h.result.current
    h.rerender()
    expect(h.result.current).toBe(primera)
  })
})
