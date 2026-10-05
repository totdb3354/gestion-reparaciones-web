import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NoEncontradoError, StaleDataError } from '@/shared/api/errors'
import { crearQueryClient } from '@/shared/api/queryClient'
import { onError } from '@/shared/ui/alertas'
import { server } from '@/test/server'
import { consultarTieneReparaciones, useCambiarActivo, useEliminar, useRegistrar } from './api'
import { MSG_ERROR_REGISTRO } from './textos'

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  // Datos en caché de las consultas que una escritura debe marcar como caducadas (y una ajena que no).
  qc.setQueryData(['usuarios', 'tecnicos'], [])
  qc.setQueryData(['tecnicos'], [])
  qc.setQueryData(['tecnicos', 'activos'], [])
  qc.setQueryData(['clientes'], [])
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}
function caducadas(qc: ReturnType<typeof crearQueryClient>) {
  return {
    usuarios: qc.getQueryState(['usuarios', 'tecnicos'])?.isInvalidated,
    tecnicos: qc.getQueryState(['tecnicos'])?.isInvalidated,
    activos: qc.getQueryState(['tecnicos', 'activos'])?.isInvalidated,
    clientes: qc.getQueryState(['clientes'])?.isInvalidated,
  }
}
const RECARGADAS = { usuarios: true, tecnicos: true, activos: true, clientes: false }
const INTACTAS = { usuarios: false, tecnicos: false, activos: false, clientes: false }

type Peticion = { metodo: string; ruta: string; query: string; cuerpo: unknown; clave?: string }
function registrar(patron: string, respuesta: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const peticiones: Peticion[] = []
  server.use(
    http.all(patron, async ({ request }) => {
      const texto = await request.text()
      const url = new URL(request.url)
      peticiones.push({
        metodo: request.method, ruta: url.pathname, query: url.search, cuerpo: texto ? JSON.parse(texto) : null,
        clave: request.headers.get('Idempotency-Key') ?? undefined,
      })
      return respuesta()
    }),
  )
  return peticiones
}

describe('api de técnicos', () => {
  it('useRegistrar: POST /api/usuarios/tecnicos con el cuerpo tal cual y la Idempotency-Key recibida; devuelve la temporal y, si sale bien, recarga usuarios y técnicos', async () => {
    const peticiones = registrar('*/api/usuarios/tecnicos', () => HttpResponse.json({ value: 'Temporal23' }, { status: 201 }))
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useRegistrar(), { wrapper })
    const temporal = await result.current.mutateAsync({ cuerpo: { nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-c', rol: 'SUPERTECNICO' }, clave: 'clave-alta' })
    expect(temporal).toBe('Temporal23')
    expect(peticiones).toEqual([
      {
        metodo: 'POST', ruta: '/api/usuarios/tecnicos', query: '', clave: 'clave-alta',
        cuerpo: { nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-c', rol: 'SUPERTECNICO' },
      },
    ])
    expect(caducadas(qc)).toEqual(RECARGADAS)
  })
  it('useRegistrar con 409: rechaza con el message del servidor, sin diálogo global y sin recargar', async () => {
    const avisos = vi.fn()
    const quitar = onError(avisos)
    registrar('*/api/usuarios/tecnicos', () => HttpResponse.json({ message: 'Ese nombre de usuario ya existe.' }, { status: 409 }))
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useRegistrar(), { wrapper })
    const error = await result.current.mutateAsync({ cuerpo: { nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-a', rol: 'TECNICO' }, clave: 'clave-alta' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StaleDataError)
    expect((error as StaleDataError).message).toBe('Ese nombre de usuario ya existe.')
    expect(avisos).not.toHaveBeenCalled()
    expect(caducadas(qc)).toEqual(INTACTAS)
    quitar()
  })
  it('useRegistrar con 201 sin value: termina en error con MSG_ERROR_REGISTRO y sin recargar', async () => {
    registrar('*/api/usuarios/tecnicos', () => HttpResponse.json({}, { status: 201 }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useRegistrar(), { wrapper })
    const error = await result.current.mutateAsync({ cuerpo: { nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-c', rol: 'TECNICO' }, clave: 'clave-alta' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(MSG_ERROR_REGISTRO)
  })
  it.each([
    [true, '/api/usuarios/tecnicos/21/activar'],
    [false, '/api/usuarios/tecnicos/21/desactivar'],
  ])('useCambiarActivo(activar: %s) → PATCH %s sin cuerpo y recarga', async (activar, ruta) => {
    const peticiones = registrar('*/api/usuarios/tecnicos/21/*')
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useCambiarActivo(), { wrapper })
    await result.current.mutateAsync({ idTec: 21, activar })
    expect(peticiones).toEqual([{ metodo: 'PATCH', ruta, query: '', cuerpo: null }])
    expect(caducadas(qc)).toEqual(RECARGADAS)
  })
  it('useEliminar → DELETE /api/usuarios/tecnicos/21?idUsu=11 y recarga', async () => {
    const peticiones = registrar('*/api/usuarios/tecnicos/21')
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useEliminar(), { wrapper })
    await result.current.mutateAsync({ idTec: 21, idUsu: 11 })
    expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/api/usuarios/tecnicos/21', query: '?idUsu=11', cuerpo: null }])
    expect(caducadas(qc)).toEqual(RECARGADAS)
  })
  it('consultarTieneReparaciones lee value de GET …/{idTec}/tiene-reparaciones', async () => {
    server.use(http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', ({ params }) => HttpResponse.json({ value: params.idTec === '21' })))
    expect(await consultarTieneReparaciones(21)).toBe(true)
    expect(await consultarTieneReparaciones(22)).toBe(false)
  })
  it('consultarTieneReparaciones con 404 rechaza con NoEncontradoError', async () => {
    server.use(http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', () => HttpResponse.json({ message: 'Técnico no encontrado.' }, { status: 404 })))
    await expect(consultarTieneReparaciones(99)).rejects.toBeInstanceOf(NoEncontradoError)
  })
})
