import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { crearQueryClient } from '@/shared/api/queryClient'
import { server } from '@/test/server'
import {
  CLAVE_ASIGNACIONES_TODAS,
  useAsignacionesTodas,
  useBorrarAsignacion,
  useCargaTecnicos,
  useChasis,
  useEditarComentario,
  useReasignar,
  useUrgente,
} from './api'

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

/** Como envoltorio(), pero devuelve también el queryClient: hace falta para leer la caché directamente (el pintado
 *  optimista de useReasignar, antes de que conteste el servidor). */
function envoltorioConQc() {
  const qc = crearQueryClient({ retry: false })
  return { qc, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> }
}

const fila = (p: Partial<ReparacionResumen>) =>
  ({
    idRep: 'A1',
    imei: '000000000000001',
    idTec: 4,
    cliente: null,
    urgente: false,
    esIncidencia: false,
    comentarioAsignacion: null,
    updatedAt: '2026-09-22T10:00:00',
    ...p,
  }) as unknown as ReparacionResumen

const ids = (fs: ReparacionResumen[] | undefined) => (fs ?? []).map((f) => f.idRep)

type Peticion = { ruta: string; cuerpo: unknown }

/** Anota lo que se envía a cada endpoint de escritura y responde 204, para poder afirmar sobre la petición. */
function espiarEscrituras(): Peticion[] {
  const peticiones: Peticion[] = []
  const anotar = async ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    const texto = await request.text()
    peticiones.push({ ruta: url.pathname + url.search, cuerpo: texto === '' ? undefined : JSON.parse(texto) })
    return new HttpResponse(null, { status: 204 })
  }
  server.use(
    http.patch('*/api/reparaciones/asignaciones/:idRep', anotar),
    http.patch('*/api/reparaciones/asignaciones/:idRep/urgente', anotar),
    http.patch('*/api/reparaciones/asignaciones/:idRep/chasis', anotar),
    http.patch('*/api/pulidos/asignaciones/:idAP', anotar),
    http.delete('*/api/reparaciones/asignaciones/:idAsig', anotar),
    http.delete('*/api/pulidos/asignaciones/:idAP', anotar),
    http.delete('*/api/reparaciones/imei/:imei/incidencia-activa', anotar),
  )
  return peticiones
}

/** Las tres listas con el contenido que se le pase; devuelve cuántas veces se ha pedido cada una. */
function servirListas(rep: ReparacionResumen[], glass: ReparacionResumen[], pul: ReparacionResumen[]) {
  const buscadas: string[] = []
  server.use(
    http.get('*/api/reparaciones/asignaciones', ({ request }) => { buscadas.push('rep' + new URL(request.url).search); return HttpResponse.json(rep) }),
    http.get('*/api/glass/asignaciones', ({ request }) => { buscadas.push('glass' + new URL(request.url).search); return HttpResponse.json(glass) }),
    http.get('*/api/pulidos/asignaciones', ({ request }) => { buscadas.push('pul' + new URL(request.url).search); return HttpResponse.json(pul) }),
  )
  return buscadas
}

describe('useAsignacionesTodas', () => {
  it('pide las tres listas sin el parámetro tecnico (es la lista completa del supertécnico)', async () => {
    const buscadas = servirListas([], [], [])
    const { result } = renderHook(() => useAsignacionesTodas(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect([...buscadas].sort()).toEqual(['glass', 'pul', 'rep'])
  })

  it('devuelve las tres categorías juntas y ordenadas por prioridad', async () => {
    // La urgente llega en la última respuesta y la de cliente en la segunda: el orden lo pone ordenarPendientes.
    servirListas(
      [fila({ idRep: 'A1' })],
      [fila({ idRep: 'AG2', cliente: 'CLI_A' })],
      [fila({ idRep: 'AP3', urgente: true })],
    )
    const { result } = renderHook(() => useAsignacionesTodas(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(result.current.data)).toEqual(['AP3', 'AG2', 'A1'])
  })
})

describe('useCargaTecnicos', () => {
  it('no consulta si no está habilitada, y sí en cuanto lo está', async () => {
    let llamadas = 0
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => { llamadas++; return HttpResponse.json({ pedidos: [], total: [] }) }))
    const cerrada = renderHook(() => useCargaTecnicos(false), { wrapper: envoltorio() })
    expect(cerrada.result.current.fetchStatus).toBe('idle')
    expect(llamadas).toBe(0)
    // Con la ventana abierta sí pide: si no, el caso anterior pasaría sin probar nada.
    const abierta = renderHook(() => useCargaTecnicos(true), { wrapper: envoltorio() })
    await waitFor(() => expect(abierta.result.current.isSuccess).toBe(true))
    expect(llamadas).toBe(1)
  })
})

describe('useReasignar', () => {
  it('una reparación va al PATCH de reparaciones con el técnico nuevo', async () => {
    const peticiones = espiarEscrituras()
    const { result } = renderHook(() => useReasignar(), { wrapper: envoltorio() })
    await result.current.mutateAsync({ fila: fila({ idRep: 'A1' }), idTec: 9 })
    expect(peticiones[0].ruta).toBe('/api/reparaciones/asignaciones/A1')
    expect(peticiones[0].cuerpo).toMatchObject({ idTec: 9 })
  })

  it('un pulido va al PATCH de pulidos, no al de reparaciones', async () => {
    const peticiones = espiarEscrituras()
    const { result } = renderHook(() => useReasignar(), { wrapper: envoltorio() })
    await result.current.mutateAsync({ fila: fila({ idRep: 'AP3' }), idTec: 9 })
    expect(peticiones[0].ruta).toBe('/api/pulidos/asignaciones/AP3')
    // El pulido llama `comentario` a lo que las reparaciones llaman `comentarioAsignacion`.
    expect(peticiones[0].cuerpo).toEqual({ idTec: 9, comentario: '', updatedAt: '2026-09-22T10:00:00' })
  })

  it('conserva el comentario actual de la fila y manda su updatedAt (bloqueo optimista)', async () => {
    const peticiones = espiarEscrituras()
    const { result } = renderHook(() => useReasignar(), { wrapper: envoltorio() })
    const f = fila({ idRep: 'A1', comentarioAsignacion: 'pantalla pedida', updatedAt: '2026-09-21T08:30:00' })
    await result.current.mutateAsync({ fila: f, idTec: 9 })
    expect(peticiones[0].cuerpo).toEqual({ idTec: 9, comentarioAsignacion: 'pantalla pedida', updatedAt: '2026-09-21T08:30:00' })
  })

  // Paridad con el ComboBox del JavaFX (D2, "reasigna al instante"): el combo va controlado por `fila.idTec`, así que
  // sin pintado optimista el usuario vería la celda volver al técnico anterior hasta que aterrizase la recarga.
  it('pinta el técnico nuevo en la caché de la lista al lanzar la mutación, antes de que conteste el servidor', async () => {
    servirListas([fila({ idRep: 'A1', idTec: 4 })], [], [])
    let liberar: () => void = () => {}
    const retenido = new Promise<void>((resolve) => { liberar = resolve })
    server.use(http.patch('*/api/reparaciones/asignaciones/:idRep', async () => { await retenido; return new HttpResponse(null, { status: 204 }) }))
    const { qc, Wrapper } = envoltorioConQc()
    const lista = renderHook(() => useAsignacionesTodas(), { wrapper: Wrapper })
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true))
    const reasignar = renderHook(() => useReasignar(), { wrapper: Wrapper })
    const enVuelo = reasignar.result.current.mutateAsync({ fila: fila({ idRep: 'A1', idTec: 4 }), idTec: 9 })
    // El PATCH sigue retenido (sin contestar): si esto pasa, es porque la caché se pintó al lanzar, no al recargar.
    await waitFor(() => {
      const enCache = qc.getQueryData<ReparacionResumen[]>(CLAVE_ASIGNACIONES_TODAS)?.find((f) => f.idRep === 'A1')
      expect(enCache?.idTec).toBe(9)
    })
    liberar()
    await enVuelo
  })

  it('si la mutación falla, revierte la caché al técnico de antes', async () => {
    servirListas([fila({ idRep: 'A1', idTec: 4 })], [], [])
    server.use(http.patch('*/api/reparaciones/asignaciones/:idRep', () => new HttpResponse(null, { status: 500 })))
    const { qc, Wrapper } = envoltorioConQc()
    const lista = renderHook(() => useAsignacionesTodas(), { wrapper: Wrapper })
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true))
    const reasignar = renderHook(() => useReasignar(), { wrapper: Wrapper })
    await expect(reasignar.result.current.mutateAsync({ fila: fila({ idRep: 'A1', idTec: 4 }), idTec: 9 })).rejects.toBeTruthy()
    const enCache = qc.getQueryData<ReparacionResumen[]>(CLAVE_ASIGNACIONES_TODAS)?.find((f) => f.idRep === 'A1')
    expect(enCache?.idTec).toBe(4)
  })
})

describe('useEditarComentario', () => {
  it('conserva el idTec actual de la fila y manda su updatedAt', async () => {
    const peticiones = espiarEscrituras()
    const { result } = renderHook(() => useEditarComentario(), { wrapper: envoltorio() })
    const f = fila({ idRep: 'A1', idTec: 4, comentarioAsignacion: 'viejo', updatedAt: '2026-09-21T08:30:00' })
    await result.current.mutateAsync({ fila: f, comentario: 'nuevo' })
    expect(peticiones[0].ruta).toBe('/api/reparaciones/asignaciones/A1')
    expect(peticiones[0].cuerpo).toEqual({ idTec: 4, comentarioAsignacion: 'nuevo', updatedAt: '2026-09-21T08:30:00' })
  })
})

describe('useUrgente y useChasis', () => {
  it('escriben en sus dos endpoints de reparaciones, por id', async () => {
    const peticiones = espiarEscrituras()
    const wrapper = envoltorio()
    const urgente = renderHook(() => useUrgente(), { wrapper })
    await urgente.result.current.mutateAsync({ idRep: 'A1', urgente: true })
    const chasis = renderHook(() => useChasis(), { wrapper })
    await chasis.result.current.mutateAsync({ idRep: 'A1', esChasis: false })
    expect(peticiones).toEqual([
      { ruta: '/api/reparaciones/asignaciones/A1/urgente', cuerpo: { urgente: true } },
      { ruta: '/api/reparaciones/asignaciones/A1/chasis', cuerpo: { esChasis: false } },
    ])
  })
})

describe('useBorrarAsignacion', () => {
  it('el pulido, la incidencia y la asignación normal van a tres endpoints distintos', async () => {
    const peticiones = espiarEscrituras()
    const { result } = renderHook(() => useBorrarAsignacion(), { wrapper: envoltorio() })
    await result.current.mutateAsync({ fila: fila({ idRep: 'AP3' }) })
    await result.current.mutateAsync({ fila: fila({ idRep: 'AG2', imei: '000000000000002', esIncidencia: true }) })
    await result.current.mutateAsync({ fila: fila({ idRep: 'A1' }) })
    expect(peticiones.map((p) => p.ruta)).toEqual([
      '/api/pulidos/asignaciones/AP3',
      '/api/reparaciones/imei/000000000000002/incidencia-activa?tipo=G',
      '/api/reparaciones/asignaciones/A1',
    ])
    // La vista no pide motivo: ninguna de las tres manda cuerpo.
    expect(peticiones.map((p) => p.cuerpo)).toEqual([undefined, undefined, undefined])
  })

  it('la incidencia de una reparación se borra con tipo=R', async () => {
    const peticiones = espiarEscrituras()
    const { result } = renderHook(() => useBorrarAsignacion(), { wrapper: envoltorio() })
    await result.current.mutateAsync({ fila: fila({ idRep: 'A1', esIncidencia: true }) })
    expect(peticiones[0].ruta).toBe('/api/reparaciones/imei/000000000000001/incidencia-activa?tipo=R')
  })
})

describe('las escrituras recargan la vista', () => {
  it('una mutación invalida la lista unificada y la carga de técnicos', async () => {
    espiarEscrituras()
    const buscadas = servirListas([], [], [])
    let cargas = 0
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => { cargas++; return HttpResponse.json({ pedidos: [], total: [] }) }))
    const wrapper = envoltorio()
    const lista = renderHook(() => useAsignacionesTodas(), { wrapper })
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true))
    const carga = renderHook(() => useCargaTecnicos(true), { wrapper })
    await waitFor(() => expect(carga.result.current.isSuccess).toBe(true))
    expect(buscadas).toHaveLength(3)
    expect(cargas).toBe(1)

    const urgente = renderHook(() => useReasignar(), { wrapper })
    await urgente.result.current.mutateAsync({ fila: fila({ idRep: 'A1' }), idTec: 9 })
    await waitFor(() => expect(buscadas).toHaveLength(6))
    await waitFor(() => expect(cargas).toBe(2))
  })
})
