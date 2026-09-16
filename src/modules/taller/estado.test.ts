import { describe, expect, it } from 'vitest'
import { FILTROS_IMEIS_VACIOS, filtrosImeis, reiniciarEstadoTaller } from './estado'

describe('estado del taller', () => {
  // "Limpiar filtros" (Task 18) hace filtrosImeis.set(FILTROS_IMEIS_VACIOS): a partir de ahí el valor vivo del
  // store ES esa constante exportada. Si algo mutara ese valor en sitio en vez de reemplazarlo, no debe dejar
  // corrupto el valor al que vuelve reiniciarEstadoTaller() (que restaura por referencia, ver crearStore/reset).
  it('mutar en sitio el valor vivo tras "Limpiar filtros" no corrompe el reset', () => {
    filtrosImeis.set(FILTROS_IMEIS_VACIOS)
    filtrosImeis.get().tecnicos.add(1)
    reiniciarEstadoTaller()
    expect(filtrosImeis.get().tecnicos.size).toBe(0)
  })
})
