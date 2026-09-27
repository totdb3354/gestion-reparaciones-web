import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, render } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { crearStore } from '@/shared/lib/store'
import { server } from '@/test/server'
import { SessionProvider, useSession } from './SessionProvider'
import { escribirLatido, guardarSesion, leerSesion, type Sesion } from './storage'

const TECNICO: Sesion = { idUsu: 90, nombreUsuario: 'tecnico1', rol: 'TECNICO', idTec: 1, token: 'jwt-tecnico1' }

type Contexto = ReturnType<typeof useSession>

/** Expone en cada render el contexto de sesión (mismo patrón que ProbeSesion de LoginPage.test.tsx). */
function Sonda({ exponer }: { exponer: (ctx: Contexto) => void }) {
  exponer(useSession())
  return null
}

/** Monta el provider con una sesión guardada y devuelve el contexto vivo (login/logout). */
function montar({ sesion = TECNICO, qc = crearQueryClient() }: { sesion?: Sesion | null; qc?: QueryClient } = {}) {
  if (sesion) guardarSesion(sesion)
  const ctx: { actual?: Contexto } = {}
  render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <Sonda exponer={(c) => { ctx.actual = c }} />
      </SessionProvider>
    </QueryClientProvider>,
  )
  return ctx
}

// Calco del JavaFX, que al volver al login descarta las vistas y con ellas sus filtros: el estado que sobrevive al cambio
// de ruta (crearStore) no sobrevive al cambio de usuario en la misma pestaña.
describe('SessionProvider: los stores de estado no pasan de una sesión a otra', () => {
  it('cerrar sesión vuelve los stores a su valor inicial', () => {
    const filtro = crearStore('')
    const ctx = montar()
    filtro.set('350000000000011')
    act(() => ctx.actual!.logout())
    expect(filtro.get()).toBe('')
  })

  it('entrar vuelve los stores a su valor inicial', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(TECNICO)))
    const filtro = crearStore('')
    const ctx = montar()
    filtro.set('350000000000011')
    await act(() => ctx.actual!.login('tecnico1', 'clave'))
    expect(filtro.get()).toBe('')
  })
})

/** Otra pestaña guarda su sesión: escribe en el almacenamiento compartido, pero esta pestaña no la adopta. */
function escribirDesdeOtraPestana(s: Sesion) {
  localStorage.setItem('fsgr.sesion', JSON.stringify(s))
}

/** Lo que ve esta pestaña cuando OTRA cambia el almacenamiento: el cambio ya está hecho y llega el evento `storage`. */
function cambioEnOtraPestana(clave: string, cambiar: () => void) {
  const antes = localStorage.getItem(clave)
  cambiar()
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: clave, oldValue: antes, newValue: localStorage.getItem(clave), storageArea: localStorage }))
  })
}

describe('SessionProvider: una sesión para todas las pestañas (evento storage)', () => {
  function espiarRecarga() {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    return replace
  }
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('Cerrar Sesión en otra pestaña: esta queda sin sesión y con la caché de datos limpia, sin recargar', () => {
    const replace = espiarRecarga()
    const qc = crearQueryClient()
    qc.setQueryData(['x'], 1)
    const ctx = montar({ qc })
    cambioEnOtraPestana('fsgr.sesion', () => localStorage.removeItem('fsgr.sesion'))
    expect(ctx.actual!.sesion).toBeNull()
    expect(qc.getQueryCache().getAll()).toHaveLength(0)
    expect(replace).not.toHaveBeenCalled()
  })

  it('la misma sesión escrita de nuevo en otra pestaña no hace nada', () => {
    const replace = espiarRecarga()
    const ctx = montar()
    cambioEnOtraPestana('fsgr.sesion', () => escribirDesdeOtraPestana({ ...TECNICO }))
    expect(ctx.actual!.sesion).toEqual(TECNICO)
    expect(replace).not.toHaveBeenCalled()
  })

  it('otro usuario entra en otra pestaña: recarga completa hacia la raíz', () => {
    const replace = espiarRecarga()
    montar()
    cambioEnOtraPestana('fsgr.sesion', () => escribirDesdeOtraPestana({ idUsu: 91, nombreUsuario: 'tecnico2', rol: 'TECNICO', idTec: 2, token: 'jwt-tecnico2' }))
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('el mismo usuario con otro token (entró de nuevo en otra pestaña): recarga completa hacia la raíz', () => {
    const replace = espiarRecarga()
    montar()
    cambioEnOtraPestana('fsgr.sesion', () => escribirDesdeOtraPestana({ ...TECNICO, token: 'jwt-nuevo' }))
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('una pestaña sin sesión (en el login) que recibe una sesión entra recargando hacia la raíz', () => {
    const replace = espiarRecarga()
    const ctx = montar({ sesion: null })
    expect(ctx.actual!.sesion).toBeNull()
    cambioEnOtraPestana('fsgr.sesion', () => escribirDesdeOtraPestana(TECNICO))
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('los cambios de la señal de actividad (fsgr.latido) no hacen nada', () => {
    const replace = espiarRecarga()
    const ctx = montar()
    cambioEnOtraPestana('fsgr.latido', () => escribirLatido(123))
    expect(ctx.actual!.sesion).toEqual(TECNICO)
    expect(replace).not.toHaveBeenCalled()
  })

  it('una sesión corrupta escrita por otra pestaña cuenta como cerrar sesión', () => {
    espiarRecarga()
    const ctx = montar()
    cambioEnOtraPestana('fsgr.sesion', () => localStorage.setItem('fsgr.sesion', '{no-json'))
    expect(ctx.actual!.sesion).toBeNull()
  })

  it('al desmontar deja de escuchar', () => {
    const replace = espiarRecarga()
    const ctx = montar()
    cleanup()
    cambioEnOtraPestana('fsgr.sesion', () => escribirDesdeOtraPestana({ ...TECNICO, token: 'jwt-nuevo' }))
    expect(replace).not.toHaveBeenCalled()
    expect(ctx.actual!.sesion).toEqual(TECNICO)
  })

  it('iniciar sesión en esta pestaña deja el estado igual que lo guardado', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(TECNICO)))
    const ctx = montar({ sesion: null })
    await act(() => ctx.actual!.login('tecnico1', 'clave'))
    expect(ctx.actual!.sesion).toEqual(TECNICO)
    expect(leerSesion()).toEqual(TECNICO)
  })

  it('si el almacenamiento no acepta la sesión al iniciar sesión, la pestaña queda sin sesión', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(TECNICO)))
    const ctx = montar({ sesion: null })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    await act(() => ctx.actual!.login('tecnico1', 'clave'))
    expect(ctx.actual!.sesion).toBeNull()
  })
})
