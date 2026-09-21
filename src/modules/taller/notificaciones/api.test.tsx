import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { onError } from '@/shared/ui/alertas'
import { SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { componente, solicitudPreventiva, solicitudUrgente } from '../test/fabrica'
import {
  CLAVE_NOTIF, CLAVE_NOTIF_COMPONENTES, CLAVE_NOTIF_CONTADOR, CLAVE_NOTIF_SOLICITUDES, useCambiarEstadoSolicitud,
  useComponentesGestionados, useContadorNotificaciones, useQuitarSolicitud, useRechazarTodo, useSolicitudesPanel,
} from './api'
import { conRegistroNotificaciones, handlersNotificaciones } from './test/handlers'

function envoltorio() {
  guardarSesion(SESION_SUPER)
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
  return { qc, wrapper }
}

/** GET recibidos por el servidor simulado, como "ruta?consulta". */
function espiarGets(): string[] {
  const gets: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') return
    const url = new URL(request.url)
    gets.push(url.pathname + url.search)
  })
  return gets
}
afterEach(() => server.events.removeAllListeners())

const TRES_PENDIENTES = {
  urgPend: [solicitudUrgente({ idRc: 501 }), solicitudUrgente({ idRc: 502 })],
  prevPend: [solicitudPreventiva({ idSol: 701 })],
}

describe('api de notificaciones', () => {
  it('las claves cuelgan de CLAVE_NOTIF (invalidar el prefijo las recarga todas)', () => {
    for (const clave of [CLAVE_NOTIF_CONTADOR, CLAVE_NOTIF_SOLICITUDES, CLAVE_NOTIF_COMPONENTES]) expect(clave[0]).toBe(CLAVE_NOTIF[0])
  })
  it('contador = suma de los dos count; inactivo no pide nada', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones(TRES_PENDIENTES))
    const { wrapper } = envoltorio()
    const inactivo = renderHook(() => useContadorNotificaciones(false), { wrapper })
    expect(inactivo.result.current.fetchStatus).toBe('idle')
    expect(gets).toEqual([])
    const activo = renderHook(() => useContadorNotificaciones(true), { wrapper })
    await waitFor(() => expect(activo.result.current.data).toBe(3))
  })
  it('fallo al contar: sin aviso y el dato anterior se conserva', async () => {
    const avisos: string[] = []
    const quitar = onError((m) => avisos.push(m))
    server.use(...handlersNotificaciones(TRES_PENDIENTES))
    const { wrapper } = envoltorio()
    const h = renderHook(() => useContadorNotificaciones(true), { wrapper })
    await waitFor(() => expect(h.result.current.data).toBe(3))
    // Lee `isError` una vez para que TanStack Query lo "trackee" (query "tracked": solo re-renderiza por props ya
    // leídas); si no, con `data` sin cambiar de valor (3 antes y después) el observer no tendría ninguna prop
    // trackeada distinta que notificar. El `waitFor` de después cubre que la notificación llega en un microtask
    // posterior al `act()` del refetch.
    expect(h.result.current.isError).toBe(false)
    server.use(http.get('*/api/solicitudes/count', () => HttpResponse.json({ message: 'no' }, { status: 403 })))
    await act(async () => { await h.result.current.refetch() })
    await waitFor(() => expect(h.result.current.isError).toBe(true))
    expect(h.result.current.data).toBe(3)
    expect(avisos).toEqual([])
    quitar()
  })
  it('useSolicitudesPanel pide las cuatro listas por estado y las compone; cerrado no pide', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones({ ...TRES_PENDIENTES, urgRech: [solicitudUrgente({ idRc: 503 })], prevRech: [solicitudPreventiva({ idSol: 702 })] }))
    const { wrapper } = envoltorio()
    const cerrado = renderHook(() => useSolicitudesPanel(false), { wrapper })
    expect(cerrado.result.current.fetchStatus).toBe('idle')
    const abierto = renderHook(() => useSolicitudesPanel(true), { wrapper })
    await waitFor(() => expect(abierto.result.current.isSuccess).toBe(true))
    expect([...gets].sort()).toEqual([
      '/api/solicitudes-stock?estado=PENDIENTE', '/api/solicitudes-stock?estado=RECHAZADA',
      '/api/solicitudes?estado=PENDIENTE', '/api/solicitudes?estado=RECHAZADA',
    ])
    expect(abierto.result.current.data?.pendientes.map((t) => `${t.clase}${t.id}`)).toEqual(['U501', 'U502', 'P701'])
    expect(abierto.result.current.data?.rechazadas.map((t) => `${t.clase}${t.id}`)).toEqual(['U503', 'P702'])
  })
  it('componentes: el primer fallo sin datos avisa una sola vez; los siguientes, no', async () => {
    const avisos: string[] = []
    const quitar = onError((m) => avisos.push(m))
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json({ message: 'no' }, { status: 403 })))
    const { wrapper } = envoltorio()
    const h = renderHook(() => useComponentesGestionados(false), { wrapper })
    await waitFor(() => expect(h.result.current.isError).toBe(true))
    expect(avisos).toEqual(['No tienes permisos para realizar esta acción.'])
    await act(async () => { await h.result.current.refetch() })
    expect(avisos).toHaveLength(1)
    quitar()
  })
  it('componentes: un fallo con datos ya cargados es silencioso y conserva la última lista buena', async () => {
    const avisos: string[] = []
    const quitar = onError((m) => avisos.push(m))
    server.use(...handlersNotificaciones({ gestionados: [componente({ idCom: 102, tipo: 'bati14', stock: 0 })] }))
    const { wrapper } = envoltorio()
    const h = renderHook(() => useComponentesGestionados(true), { wrapper })
    await waitFor(() => expect(h.result.current.data).toHaveLength(1))
    server.use(http.get('*/api/componentes/gestionados', () => new HttpResponse(null, { status: 500 })))
    await act(async () => { await h.result.current.refetch() })
    expect(h.result.current.data).toHaveLength(1)
    expect(avisos).toEqual([])
    quitar()
  })
  it('cambiar estado: PATCH …/estado de la clase que toca y recarga de contador, solicitudes y alertas', async () => {
    const gets = espiarGets()
    const { handlers, llamadas } = conRegistroNotificaciones(TRES_PENDIENTES)
    server.use(...handlers)
    const { wrapper } = envoltorio()
    const contador = renderHook(() => useContadorNotificaciones(true), { wrapper })
    const listas = renderHook(() => useSolicitudesPanel(true), { wrapper })
    const componentes = renderHook(() => useComponentesGestionados(true), { wrapper })
    await waitFor(() => expect(contador.result.current.data).toBe(3))
    await waitFor(() => expect(listas.result.current.isSuccess && componentes.result.current.isSuccess).toBe(true))
    // Trackea `data` de `listas` (como ya lo está `contador.data`): si no, el observer no notifica el cambio tras la
    // mutación porque solo `isSuccess` (que no cambia) estaba trackeado, y `listas.result.current` se quedaría obsoleto.
    expect(listas.result.current.data?.pendientes.length).toBe(3)
    const m = renderHook(() => useCambiarEstadoSolicitud(), { wrapper })
    await act(async () => { await m.result.current.mutateAsync({ clase: 'U', id: 501, estado: 'RECHAZADA' }) })
    await act(async () => { await m.result.current.mutateAsync({ clase: 'P', id: 701, estado: 'RECHAZADA' }) })
    expect(llamadas).toEqual([
      { metodo: 'PATCH', ruta: '/api/solicitudes/501/estado', cuerpo: { estado: 'RECHAZADA' } },
      { metodo: 'PATCH', ruta: '/api/solicitudes-stock/701/estado', cuerpo: { estado: 'RECHAZADA' } },
    ])
    await waitFor(() => expect(contador.result.current.data).toBe(1))
    await waitFor(() => expect(listas.result.current.data?.rechazadas.map((t) => `${t.clase}${t.id}`)).toEqual(['U501', 'P701']))
    expect(gets.filter((g) => g === '/api/componentes/gestionados').length).toBeGreaterThanOrEqual(2)
  })
  it('quitar: urgente → PATCH limpiar sin cuerpo; preventiva → DELETE', async () => {
    const { handlers, llamadas } = conRegistroNotificaciones({ urgRech: [solicitudUrgente({ idRc: 503 })], prevRech: [solicitudPreventiva({ idSol: 702 })] })
    server.use(...handlers)
    const { wrapper } = envoltorio()
    const m = renderHook(() => useQuitarSolicitud(), { wrapper })
    await act(async () => { await m.result.current.mutateAsync({ clase: 'U', id: 503 }) })
    await act(async () => { await m.result.current.mutateAsync({ clase: 'P', id: 702 }) })
    expect(llamadas).toEqual([
      { metodo: 'PATCH', ruta: '/api/solicitudes/503/limpiar', cuerpo: null },
      { metodo: 'DELETE', ruta: '/api/solicitudes-stock/702', cuerpo: null },
    ])
  })
  it('rechazar todo: pide las pendientes y las rechaza una a una, urgentes y luego preventivas; no recarga las alertas', async () => {
    const gets = espiarGets()
    const { handlers, llamadas } = conRegistroNotificaciones(TRES_PENDIENTES)
    server.use(...handlers)
    const { wrapper } = envoltorio()
    const componentes = renderHook(() => useComponentesGestionados(true), { wrapper })
    await waitFor(() => expect(componentes.result.current.isSuccess).toBe(true))
    const m = renderHook(() => useRechazarTodo(), { wrapper })
    await act(async () => { await m.result.current.mutateAsync() })
    expect(llamadas.map((l) => l.ruta)).toEqual(['/api/solicitudes/501/estado', '/api/solicitudes/502/estado', '/api/solicitudes-stock/701/estado'])
    expect(llamadas.every((l) => JSON.stringify(l.cuerpo) === '{"estado":"RECHAZADA"}')).toBe(true)
    expect(gets.filter((g) => g === '/api/componentes/gestionados')).toHaveLength(1)
  })
  it('rechazar todo se detiene en el primer error y lanza; con la lista vacía no escribe nada', async () => {
    const { handlers, llamadas } = conRegistroNotificaciones(TRES_PENDIENTES)
    server.use(http.patch('*/api/solicitudes/502/estado', () => HttpResponse.json({ message: 'La solicitud ya no está pendiente' }, { status: 409 })), ...handlers)
    const { wrapper } = envoltorio()
    const m = renderHook(() => useRechazarTodo(), { wrapper })
    await act(async () => { await expect(m.result.current.mutateAsync()).rejects.toThrow('La solicitud ya no está pendiente') })
    expect(llamadas.map((l) => l.ruta)).toEqual(['/api/solicitudes/501/estado'])

    server.resetHandlers()
    const vacio = conRegistroNotificaciones()
    server.use(...vacio.handlers)
    const otro = envoltorio()
    const m2 = renderHook(() => useRechazarTodo(), { wrapper: otro.wrapper })
    await act(async () => { await m2.result.current.mutateAsync() })
    expect(vacio.llamadas).toEqual([])
  })
})
