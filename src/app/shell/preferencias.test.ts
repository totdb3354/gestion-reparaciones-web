import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_GRUPOS_PLEGADOS, CLAVE_PLEGADA, guardarGruposPlegados, guardarPlegada, leerGruposPlegados, leerPlegada } from './preferencias'

describe('preferencia de la columna lateral plegada (0.9.10)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin nada guardado, abierta', () => {
    expect(leerPlegada()).toBe(false)
  })

  it('guarda «si» y «no» y los lee', () => {
    guardarPlegada(true)
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('si')
    expect(leerPlegada()).toBe(true)
    guardarPlegada(false)
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('no')
    expect(leerPlegada()).toBe(false)
  })

  it('si no se puede leer (modo privado, almacenamiento bloqueado), abierta', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    expect(leerPlegada()).toBe(false)
  })

  it('si no se puede guardar, no rompe', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    expect(() => guardarPlegada(true)).not.toThrow()
  })
})

describe('grupos plegados de la columna lateral (0.9.12)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin nada guardado, ninguno plegado', () => {
    expect(leerGruposPlegados()).toEqual(new Set())
  })

  it('guarda la lista y la lee', () => {
    guardarGruposPlegados(new Set(['stock', 'gestion']))
    expect(JSON.parse(localStorage.getItem(CLAVE_GRUPOS_PLEGADOS) ?? 'null')).toEqual(['stock', 'gestion'])
    expect(leerGruposPlegados()).toEqual(new Set(['stock', 'gestion']))
  })

  it('JSON roto o que no es una lista: ninguno plegado', () => {
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '{roto')
    expect(leerGruposPlegados()).toEqual(new Set())
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '{"stock":true}')
    expect(leerGruposPlegados()).toEqual(new Set())
  })

  it('ignora los ids que no son de un grupo', () => {
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '["stock","inventado",3]')
    expect(leerGruposPlegados()).toEqual(new Set(['stock']))
  })

  it('sin almacenamiento, ni leer ni guardar rompen', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    expect(leerGruposPlegados()).toEqual(new Set())
    expect(() => guardarGruposPlegados(new Set(['stock']))).not.toThrow()
  })
})
