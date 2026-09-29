import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTERVALO_VERSION_MS, RUTA_VERSION, leerVersionPublicada } from './versionPublicada'

describe('versión publicada', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    // El `fetch` de la suite lo pone msw: sin deshacer el doble, el siguiente test de este fichero heredaría el anterior.
    vi.unstubAllGlobals()
  })

  it('sondea cada cinco minutos el fichero publicado junto al bundle', () => {
    expect(INTERVALO_VERSION_MS).toBe(5 * 60 * 1000)
    expect(RUTA_VERSION).toBe('/version.json')
  })

  it('pide el fichero sin caché', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '0.9.1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchFalso)
    expect(await leerVersionPublicada()).toBe('0.9.1')
    expect(fetchFalso).toHaveBeenCalledWith(RUTA_VERSION, { cache: 'no-store' })
  })

  it('un 404 no es un error: devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    expect(await leerVersionPublicada()).toBeNull()
  })

  it('un fallo de red devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    expect(await leerVersionPublicada()).toBeNull()
  })

  it('un cuerpo que no es el esperado devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"otra":1}', { status: 200 })))
    expect(await leerVersionPublicada()).toBeNull()
  })

  it('un cuerpo que no es JSON devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })))
    expect(await leerVersionPublicada()).toBeNull()
  })
})
