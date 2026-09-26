import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Usuario } from '@/shared/api/client'
import { crearQueryClient } from '@/shared/api/queryClient'
import { onError } from '@/shared/ui/alertas'
import { server } from '@/test/server'
import { CLAVE_TECNICOS_LITERAL, CLAVE_USUARIOS, CLAVE_USUARIOS_TECNICOS, useUsuariosTecnicos } from './api'

const usuarios: Usuario[] = [
  { idUsu: 11, nombreUsuario: 'usuario-a', rol: 'TECNICO', idTec: 21, nombreTecnico: 'tecnico-a', activo: true },
  { idUsu: 12, nombreUsuario: 'usuario-b', rol: 'SUPERTECNICO', idTec: 22, nombreTecnico: 'tecnico-b', activo: false },
]

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('api de gestión', () => {
  it('claves: usuarios, usuarios/tecnicos (colgada de usuarios) y el literal de técnicos del taller', () => {
    expect(CLAVE_USUARIOS).toEqual(['usuarios'])
    expect(CLAVE_USUARIOS_TECNICOS).toEqual(['usuarios', 'tecnicos'])
    expect(CLAVE_TECNICOS_LITERAL).toEqual(['tecnicos'])
  })
  it('useUsuariosTecnicos lee GET /api/usuarios/tecnicos en el orden del servidor y no recarga por foco', async () => {
    let peticiones = 0
    server.use(http.get('*/api/usuarios/tecnicos', () => { peticiones += 1; return HttpResponse.json(usuarios) }))
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useUsuariosTecnicos(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual(usuarios))
    expect(peticiones).toBe(1)
    // `Query.options` es `QueryOptions` (sin las opciones de observer: tsc -b fallaría con TS2339); se lee del observer.
    expect(qc.getQueryCache().find({ queryKey: CLAVE_USUARIOS_TECNICOS })?.observers[0]?.options.refetchOnWindowFocus).toBe(false)
  })
  it('con habilitada: false no pide nada', () => {
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useUsuariosTecnicos({ habilitada: false }), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
  it('un fallo de carga no abre el diálogo global: lo pinta la página de técnicos o lo calla el filtro de logs', async () => {
    const avisos = vi.fn()
    const quitar = onError(avisos)
    server.use(http.get('*/api/usuarios/tecnicos', () => HttpResponse.json({ message: 'Fallo de prueba' }, { status: 400 })))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useUsuariosTecnicos(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(avisos).not.toHaveBeenCalled()
    quitar()
  })
})
