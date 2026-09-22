import { describe, expect, it } from 'vitest'
import type { CargaTecnicosRespuesta } from '@/shared/api/client'
import { desglose, filaCarga } from '../test/fabrica'
import { anchoBarra, formatearPct, nivelCarga, ordenarPorCarga, pctTotal, textoDesglose, textoTramo } from './carga'

describe('pctTotal y nivelCarga', () => {
  it('el total del día es lo hecho más lo pendiente y puede pasar de 100', () => {
    expect(pctTotal(filaCarga({ pctHecho: 70, pctPendiente: 45 }))).toBe(115)
  })

  it('los tres niveles son 90 y 70 (calco de colorNivelVivo)', () => {
    expect(nivelCarga(90)).toBe('alta')
    expect(nivelCarga(89.9)).toBe('media')
    expect(nivelCarga(70)).toBe('media')
    expect(nivelCarga(69.9)).toBe('baja')
  })

  it('la barra se satura al 100 aunque la cifra se pase, y sin jornada no pinta nada', () => {
    expect(anchoBarra(115, false)).toBe(100)
    expect(anchoBarra(42.5, false)).toBe(42.5)
    expect(anchoBarra(0, true)).toBe(0)
    expect(formatearPct(42.5)).toBe('43%')
  })
})

describe('ordenarPorCarga', () => {
  const filas: CargaTecnicosRespuesta['pedidos'] = [
    filaCarga({ idTec: 1, nombre: 'Técnico A', pctHecho: 10, pctPendiente: 10 }),
    filaCarga({ idTec: 2, nombre: 'Técnico C', pctHecho: 50, pctPendiente: 45 }),
    filaCarga({ idTec: 3, nombre: 'Técnico B', pctHecho: 30, pctPendiente: 25 }),
  ]

  it('ordena de mayor a menor carga del día', () => {
    expect(ordenarPorCarga(filas).map((f) => f.nombre)).toEqual(['Técnico C', 'Técnico B', 'Técnico A'])
  })

  it('a igualdad de carga desempata por nombre, así la lista no baila entre refrescos', () => {
    const empatadas = filas.map((f) => ({ ...f, pctHecho: 0, pctPendiente: 0 }))
    expect(ordenarPorCarga(empatadas).map((f) => f.nombre)).toEqual(['Técnico A', 'Técnico B', 'Técnico C'])
  })

  it('no toca la lista recibida', () => {
    const copia = [...filas]
    ordenarPorCarga(filas)
    expect(filas).toEqual(copia)
  })
})

describe('textoTramo y textoDesglose', () => {
  it('el tramo omite los ceros y une con punto medio', () => {
    expect(textoTramo(desglose({ normales: 3, chasis: 1, enEsperaPieza: 2 }))).toBe('3 normales · 1 chasis · 2 en espera de pieza')
    expect(textoTramo(desglose({ porCerrar: 4, glass: 5 }))).toBe('4 por cerrar · 5 glass')
    expect(textoTramo(desglose())).toBe('')
  })

  it('los dos tramos se unen con raya, y el vacío se omite', () => {
    const fila = filaCarga({ pendiente: desglose({ normales: 3 }), hecho: desglose({ glass: 1 }) })
    expect(textoDesglose(fila, 'pedidos')).toBe('Pendiente: 3 normales — Hecho hoy: 1 glass')
    expect(textoDesglose(filaCarga({ hecho: desglose({ glass: 1 }) }), 'total')).toBe('Hecho hoy: 1 glass')
  })

  it('sin nada en ninguno de los dos tramos, el texto depende del alcance', () => {
    expect(textoDesglose(filaCarga({}), 'pedidos')).toBe('sin carga de cliente')
    expect(textoDesglose(filaCarga({}), 'total')).toBe('sin carga')
  })
})
