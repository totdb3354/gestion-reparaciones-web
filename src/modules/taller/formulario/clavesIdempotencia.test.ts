import { describe, expect, it } from 'vitest'
import { crearClavesIdempotencia } from './clavesIdempotencia'

/** Generador determinista para los tests: una clave nueva cada vez que se llama, en orden. */
function generadorSecuencial() {
  let n = 0
  return () => `clave-${++n}`
}

describe('crearClavesIdempotencia', () => {
  it('mismaOperacionYMismoCuerpoReutilizaLaClave', () => {
    const claves = crearClavesIdempotencia(generadorSecuencial())
    const primera = claves.para('fila:bat', { idCom: 101, cantidad: 1 })
    const segunda = claves.para('fila:bat', { idCom: 101, cantidad: 1 })
    expect(segunda).toBe(primera)
  })

  it('cuerpoDistintoGeneraClaveNueva', () => {
    const claves = crearClavesIdempotencia(generadorSecuencial())
    const primera = claves.para('fila:bat', { idCom: 101, cantidad: 1 })
    const segunda = claves.para('fila:bat', { idCom: 101, cantidad: 2 })
    expect(segunda).not.toBe(primera)
  })

  it('hechaOlvidaLaClave', () => {
    const claves = crearClavesIdempotencia(generadorSecuencial())
    const primera = claves.para('fila:bat', { idCom: 101, cantidad: 1 })
    claves.hecha('fila:bat')
    const segunda = claves.para('fila:bat', { idCom: 101, cantidad: 1 })
    expect(segunda).not.toBe(primera)
  })

  it('operacionesDistintasNoCompartenClave', () => {
    const claves = crearClavesIdempotencia(generadorSecuencial())
    const cuerpo = { idCom: 101, cantidad: 1 }
    const fila = claves.para('fila:bat', cuerpo)
    const accion = claves.para('accion:1', cuerpo)
    expect(accion).not.toBe(fila)
  })

  it('sin generador explícito usa claveUnica (formato UUID v4) por defecto', () => {
    const claves = crearClavesIdempotencia()
    expect(claves.para('completa', { a: 1 })).toMatch(/^[0-9a-f-]{36}$/i)
  })
})
