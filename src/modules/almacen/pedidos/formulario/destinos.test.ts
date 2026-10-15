import { describe, expect, it } from 'vitest'
import { lineaDePrueba as l } from '../bloques/datosPrueba'
import { agruparEnBloques } from '../bloques/reglas'
import { destinoElegido, destinosDelCuerpo, opcionesDestino, opcionesBloqueEdicion, proveedoresDeLineas, VALOR_NUEVO } from './destinos'
import { lineaCompraVacia } from './lineas'

const bloques = agruparEnBloques([
  l({ idCompra: 1, idProv: 1, idBloque: 41, fechaBloque: '2026-10-09T10:00:00' }),
  l({ idCompra: 2, idProv: 1, idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }),
  l({ idCompra: 3, idProv: 1, idBloque: 39, fechaBloque: '2026-10-07T10:00:00', estado: 'en_camino' }),
])
const linea = (id: number, idProv: number | null) => ({ ...lineaCompraVacia(id, 11), idProv })

describe('destinos de «Nuevo pedido» (spec §6.6)', () => {
  it('proveedores en orden de aparición con sus líneas', () => {
    expect(proveedoresDeLineas([linea(1, 2), linea(2, 1), linea(3, 2), linea(4, null)])).toEqual([{ idProv: 2, n: 2 }, { idProv: 1, n: 1 }])
  })
  it('opciones: los abiertos del más reciente al más antiguo y «Bloque nuevo»; sin abiertos, ninguna', () => {
    expect(opcionesDestino(bloques, 1)).toEqual([
      { valor: '41', etiqueta: 'Añadir a Bloque 41 · 09/10 · 1 línea' },
      { valor: '40', etiqueta: 'Añadir a Bloque 40 · 08/10 · 1 línea' },
      { valor: VALOR_NUEVO, etiqueta: 'Bloque nuevo' },
    ])
    expect(opcionesDestino(bloques, 2)).toEqual([])
  })
  it('elegido: lo de a mano si sigue siendo opción; si no, el abierto más reciente; sin abiertos, nuevo', () => {
    expect(destinoElegido(bloques, 1, {})).toBe(41)
    expect(destinoElegido(bloques, 1, { 1: 40 })).toBe(40)
    expect(destinoElegido(bloques, 1, { 1: null })).toBeNull()
    expect(destinoElegido(bloques, 1, { 1: 39 })).toBe(41)
    expect(destinoElegido(bloques, 2, {})).toBeNull()
  })
  it('cuerpo: solo los proveedores con desplegable; ninguno → null', () => {
    expect(destinosDelCuerpo([linea(1, 1), linea(2, 2)], bloques, { 1: null })).toEqual([{ idProv: 1, idBloque: null }])
    expect(destinosDelCuerpo([linea(1, 2)], bloques, {})).toBeNull()
  })
  it('opcionesBloqueEdicion: los bloques vivos del proveedor nuevo (abiertos y en curso) y «Bloque nuevo»', () => {
    expect(opcionesBloqueEdicion(bloques, 1)).toEqual([
      { valor: '41', etiqueta: 'Bloque 41 · 09/10 · 1 línea · abierto' },
      { valor: '40', etiqueta: 'Bloque 40 · 08/10 · 1 línea · abierto' },
      { valor: '39', etiqueta: 'Bloque 39 · 07/10 · 1 línea · en curso' },
      { valor: VALOR_NUEVO, etiqueta: 'Bloque nuevo' },
    ])
    expect(opcionesBloqueEdicion(bloques, 2)).toEqual([{ valor: VALOR_NUEVO, etiqueta: 'Bloque nuevo' }])
  })
})
