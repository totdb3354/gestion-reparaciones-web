import { beforeEach, describe, expect, it } from 'vitest'
import { guardarSesion } from '@/shared/session/storage'
import { SESION_SUPER } from '@/test/render'
import { fila } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { CADUCIDAD_NO_VALIDO_MS, cargarNoValidos, leerNoValidos, limpiarNoValidos, marcarNoValido, quitarNoValido, textoNoValido } from './noValidos'

const CLAVE = `pedidos.imeiNoValidos.${SESION_SUPER.nombreUsuario}`

beforeEach(() => { localStorage.clear(); estadoPedidos.reset(); guardarSesion(SESION_SUPER) })

describe('noValidos', () => {
  it('marcar lo pone en el store y en localStorage del usuario; quitar lo borra de los dos', () => {
    marcarNoValido(7, { imei: '350000000000017', motivo: 'luhn', imeiFila: null }, 1000)
    expect(estadoPedidos.get().noValidos[7]).toEqual({ imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: 1000 })
    expect(JSON.parse(localStorage.getItem(CLAVE)!)).toEqual({ 7: { imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: 1000 } })
    quitarNoValido(7)
    expect(estadoPedidos.get().noValidos).toEqual({})
    expect(localStorage.getItem(CLAVE)).toBeNull()
  })

  it('al cargar se descartan las de más de 24 h, las mal formadas y las de otro usuario', () => {
    const ahora = 10 * CADUCIDAD_NO_VALIDO_MS
    localStorage.setItem(CLAVE, JSON.stringify({
      1: { imei: '3500000000000171', motivo: 'mas', imeiFila: null, en: ahora - 1000 },
      2: { imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: ahora - CADUCIDAD_NO_VALIDO_MS - 1 },
      3: { imei: 5, motivo: 'luhn', en: ahora },
    }))
    localStorage.setItem('pedidos.imeiNoValidos.otro', JSON.stringify({ 4: { imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: ahora } }))
    expect(Object.keys(leerNoValidos(ahora))).toEqual(['1'])
  })

  it('cargarNoValidos lleva lo guardado al store; sin sesión no lee nada', () => {
    localStorage.setItem(CLAVE, JSON.stringify({ 5: { imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: Date.now() } }))
    cargarNoValidos()
    expect(Object.keys(estadoPedidos.get().noValidos)).toEqual(['5'])
    localStorage.clear()
    expect(leerNoValidos()).toEqual({})
  })

  it('limpiar quita las de filas cuyo IMEI ya no es el que tenían al leer; las que no llegan se quedan', () => {
    marcarNoValido(1, { imei: '350000000000017', motivo: 'luhn', imeiFila: null })
    marcarNoValido(2, { imei: '350000000000017', motivo: 'luhn', imeiFila: null })
    marcarNoValido(3, { imei: '350000000000017', motivo: 'luhn', imeiFila: '350000000000025' })
    limpiarNoValidos([fila({ idFila: 1, imei: '350000000000033' }), fila({ idFila: 3, imei: '350000000000025' })])
    expect(Object.keys(estadoPedidos.get().noValidos).sort()).toEqual(['2', '3'])
  })

  it('marcar no pisa lo que otra pestaña escribió en localStorage; quitar deja las demás entradas', () => {
    const otra = { imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: Date.now() }
    marcarNoValido(1, { imei: '350000000000017', motivo: 'luhn', imeiFila: null })
    localStorage.setItem(CLAVE, JSON.stringify({ ...JSON.parse(localStorage.getItem(CLAVE)!), 9: otra }))
    marcarNoValido(2, { imei: '350000000000017', motivo: 'luhn', imeiFila: null })
    expect(Object.keys(JSON.parse(localStorage.getItem(CLAVE)!)).sort()).toEqual(['1', '2', '9'])
    expect(Object.keys(estadoPedidos.get().noValidos).sort()).toEqual(['1', '2', '9'])
    localStorage.setItem(CLAVE, JSON.stringify({ ...JSON.parse(localStorage.getItem(CLAVE)!), 8: otra }))
    quitarNoValido(1)
    expect(Object.keys(JSON.parse(localStorage.getItem(CLAVE)!)).sort()).toEqual(['2', '8', '9'])
  })

  it('limpiar solo quita las que decide quitar, no las que solo están en localStorage', () => {
    marcarNoValido(1, { imei: '350000000000017', motivo: 'luhn', imeiFila: null })
    localStorage.setItem(CLAVE, JSON.stringify({ ...JSON.parse(localStorage.getItem(CLAVE)!), 9: { imei: '350000000000017', motivo: 'luhn', imeiFila: null, en: Date.now() } }))
    limpiarNoValidos([fila({ idFila: 1, imei: '350000000000033' })])
    expect(Object.keys(JSON.parse(localStorage.getItem(CLAVE)!))).toEqual(['9'])
  })

  it('limpiar quita las caducadas (más de 24 h) aunque la pestaña siga abierta', () => {
    marcarNoValido(2, { imei: '350000000000017', motivo: 'luhn', imeiFila: null })
    const vieja = { imei: '350000000000017', motivo: 'luhn' as const, imeiFila: null, en: Date.now() - CADUCIDAD_NO_VALIDO_MS - 1 }
    estadoPedidos.set((s) => ({ ...s, noValidos: { ...s.noValidos, 1: vieja } }))
    localStorage.setItem(CLAVE, JSON.stringify({ ...JSON.parse(localStorage.getItem(CLAVE)!), 1: vieja }))
    limpiarNoValidos([])
    expect(Object.keys(estadoPedidos.get().noValidos)).toEqual(['2'])
    expect(Object.keys(JSON.parse(localStorage.getItem(CLAVE)!))).toEqual(['2'])
  })

  it('textos corto y largo', () => {
    expect(textoNoValido({ imei: '350000000006537', motivo: 'luhn', imeiFila: null, en: 0 })).toEqual({
      corto: 'IMEI no válido · …6537', largo: 'IMEI no válido: 350000000006537 (la cifra de control no cuadra). No se ha guardado.' })
    expect(textoNoValido({ imei: '3500000000065371', motivo: 'mas', imeiFila: null, en: 0 })).toEqual({
      corto: 'IMEI no válido · 16 cifras', largo: 'IMEI no válido: 16 cifras (3500000000065371). No se ha guardado.' })
  })
})
