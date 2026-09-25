import { describe, expect, it } from 'vitest'
import { COMPONENTES, preventiva, urgente } from './datosPrueba'
import {
  avisoOmitidas, cambiarLinea, cuerpoLoteCompras, cuerpoLoteOtros, lineaCompraVacia, lineaOtroVacia, precargaInicial,
  precargarComponentes, precargarSolicitudes, preseleccionDe, quitarLinea, siguienteId, validarLineasCompra, validarLineasOtro,
  type LineaCompra, type LineaOtro,
} from './lineas'

const completa = (cambio: Partial<LineaCompra> = {}): LineaCompra => ({ id: 1, idCom: 2, idProv: 1, cantidad: '2', precio: '12,5', urgente: false, ...cambio })
const otra = (cambio: Partial<LineaOtro> = {}): LineaOtro => ({ id: 1, concepto: 'Cinta de embalar', idProv: 1, cantidad: '3', precio: '1,5', urgente: false, ...cambio })

describe('líneas vacías', () => {
  it('cantidad 1, precio 0,00, sin proveedor ni urgente; la de compra admite un componente', () => {
    expect(lineaCompraVacia(3)).toEqual({ id: 3, idCom: null, idProv: null, cantidad: '1', precio: '0,00', urgente: false })
    expect(lineaCompraVacia(4, 2)).toEqual({ id: 4, idCom: 2, idProv: null, cantidad: '1', precio: '0,00', urgente: false })
    expect(lineaOtroVacia(1)).toEqual({ id: 1, concepto: '', idProv: null, cantidad: '1', precio: '0,00', urgente: false })
  })
})

describe('precargas', () => {
  it('precargarComponentes: una línea por id, en orden, con el componente y cantidad 1', () => {
    expect(precargarComponentes([2, 1, 5], COMPONENTES)).toEqual([lineaCompraVacia(1, 2), lineaCompraVacia(2, 1), lineaCompraVacia(3, 5)])
  })
  it('precargarComponentes: inactivo o desconocido → línea vacía (calco)', () => {
    expect(precargarComponentes([4, 99], COMPONENTES)).toEqual([lineaCompraVacia(1), lineaCompraVacia(2)])
  })
  it('preseleccionDe: solo con un único componente activo ("Pedir" de Stock o de una alerta)', () => {
    expect(preseleccionDe({ modo: 'componentes', idsCom: [2] }, COMPONENTES)).toBe(2)
    expect(preseleccionDe({ modo: 'componentes', idsCom: [4] }, COMPONENTES)).toBeNull()
    expect(preseleccionDe({ modo: 'componentes', idsCom: [1, 2] }, COMPONENTES)).toBeNull()
    expect(preseleccionDe({ modo: 'vacio' }, COMPONENTES)).toBeNull()
    expect(preseleccionDe({ modo: 'solicitudes', urgentes: [urgente(10, 2)], preventivas: [] }, COMPONENTES)).toBeNull()
  })
  it('precargarSolicitudes: agrupa por componente, urgentes primero y en su orden, cantidad = nº de solicitudes; cuenta las omitidas', () => {
    const r = precargarSolicitudes(
      [urgente(10, 2), urgente(11, 1), urgente(12, 2), urgente(13, 4)],
      [preventiva(20, 5), preventiva(21, 1), preventiva(22, 4)],
      COMPONENTES,
    )
    expect(r.lineas).toEqual([
      { ...lineaCompraVacia(1, 2), cantidad: '2' },
      { ...lineaCompraVacia(2, 1), cantidad: '2' },
      { ...lineaCompraVacia(3, 5), cantidad: '1' },
    ])
    expect(r.omitidas).toBe(2)
  })
  it('precargarSolicitudes: sin inactivos no omite nada; listas vacías → sin líneas', () => {
    expect(precargarSolicitudes([urgente(10, 1)], [], COMPONENTES)).toEqual({ lineas: [lineaCompraVacia(1, 1)], omitidas: 0 })
    expect(precargarSolicitudes([], [], COMPONENTES)).toEqual({ lineas: [], omitidas: 0 })
  })
  it('precargaInicial: vacío sin líneas; componentes y solicitudes delegan', () => {
    expect(precargaInicial({ modo: 'vacio' }, COMPONENTES)).toEqual({ lineas: [], omitidas: 0 })
    expect(precargaInicial({ modo: 'componentes', idsCom: [1] }, COMPONENTES)).toEqual({ lineas: [lineaCompraVacia(1, 1)], omitidas: 0 })
    expect(precargaInicial({ modo: 'solicitudes', urgentes: [urgente(10, 4)], preventivas: [preventiva(20, 2)] }, COMPONENTES))
      .toEqual({ lineas: [lineaCompraVacia(1, 2)], omitidas: 1 })
  })
  it('avisoOmitidas: texto de D10 con n > 0; null con 0', () => {
    expect(avisoOmitidas(2)).toBe('2 solicitud(es) de componentes desactivados no se han añadido y siguen pendientes.')
    expect(avisoOmitidas(0)).toBeNull()
  })
})

describe('validarLineasCompra', () => {
  it('sin líneas: "Añade al menos una línea."', () => {
    expect(validarLineasCompra([])).toBe('Añade al menos una línea.')
  })
  it('por línea, en orden: componente → proveedor → cantidad → precio', () => {
    const mala: LineaCompra = { id: 1, idCom: null, idProv: null, cantidad: '0', precio: '-1', urgente: false }
    expect(validarLineasCompra([mala])).toBe('Línea 1: selecciona un componente.')
    expect(validarLineasCompra([{ ...mala, idCom: 2 }])).toBe('Línea 1: selecciona un proveedor.')
    expect(validarLineasCompra([{ ...mala, idCom: 2, idProv: 1 }])).toBe('Línea 1: la cantidad debe ser mayor que 0.')
    expect(validarLineasCompra([{ ...mala, idCom: 2, idProv: 1, cantidad: '2' }])).toBe('Línea 1: el precio no puede ser negativo.')
    expect(validarLineasCompra([completa()])).toBeNull()
  })
  it('cantidad: "0", "abc", "" y "1,5" fallan; precio: "-1" y "abc" fallan, "0" y "12,5" pasan', () => {
    for (const cantidad of ['0', 'abc', '', '1,5']) expect(validarLineasCompra([completa({ cantidad })])).toBe('Línea 1: la cantidad debe ser mayor que 0.')
    for (const precio of ['-1', 'abc']) expect(validarLineasCompra([completa({ precio })])).toBe('Línea 1: el precio no puede ser negativo.')
    for (const precio of ['0', '12,5', '12.5', '0,00']) expect(validarLineasCompra([completa({ precio })])).toBeNull()
  })
  it('para en la primera línea que falla, con su número (1-based)', () => {
    expect(validarLineasCompra([completa(), completa({ id: 2, idProv: null }), completa({ id: 3, idCom: null })])).toBe('Línea 2: selecciona un proveedor.')
  })
})

describe('validarLineasOtro', () => {
  it('concepto en blanco (tras trim) primero; después proveedor, cantidad y precio con los textos de siempre', () => {
    expect(validarLineasOtro([])).toBe('Añade al menos una línea.')
    expect(validarLineasOtro([otra({ concepto: '   ', idProv: null })])).toBe('Línea 1: el concepto no puede estar vacío.')
    expect(validarLineasOtro([otra({ idProv: null })])).toBe('Línea 1: selecciona un proveedor.')
    expect(validarLineasOtro([otra({ cantidad: '0' })])).toBe('Línea 1: la cantidad debe ser mayor que 0.')
    expect(validarLineasOtro([otra({ precio: '-0,5' })])).toBe('Línea 1: el precio no puede ser negativo.')
    expect(validarLineasOtro([otra()])).toBeNull()
  })
})

describe('cuerpos de lote', () => {
  it('cuerpoLoteCompras: convierte los textos ("12,5" → 12.5, "3" → 3) y lleva solo las solicitudes cuyo componente tiene línea', () => {
    const lineas = [completa({ idCom: 2, cantidad: '3', urgente: true }), completa({ id: 2, idCom: 5, idProv: 2, cantidad: '1', precio: '0' })]
    const origen = { urgentes: [urgente(10, 2), urgente(11, 1), urgente(12, 2)], preventivas: [preventiva(20, 5), preventiva(21, 1)] }
    expect(cuerpoLoteCompras(lineas, origen)).toEqual({
      lineas: [
        { idCom: 2, idProv: 1, cantidad: 3, esUrgente: true, precioUnidad: 12.5 },
        { idCom: 5, idProv: 2, cantidad: 1, esUrgente: false, precioUnidad: 0 },
      ],
      solicitudes: { urgentes: [10, 12], preventivas: [20] },
    })
  })
  it('cuerpoLoteCompras: sin origen, solicitudes vacías', () => {
    expect(cuerpoLoteCompras([completa()], null).solicitudes).toEqual({ urgentes: [], preventivas: [] })
  })
  it('cuerpoLoteOtros: concepto recortado y números convertidos', () => {
    expect(cuerpoLoteOtros([otra({ concepto: '  Cinta de embalar  ', urgente: true })])).toEqual({
      lineas: [{ idProv: 1, concepto: 'Cinta de embalar', cantidad: 3, esUrgente: true, precioUnidad: 1.5 }],
    })
  })
})

describe('edición de la lista', () => {
  it('cambiarLinea cambia solo esa línea; quitarLinea la quita; siguienteId = máximo + 1 (1 con la lista vacía)', () => {
    const ls = [lineaCompraVacia(1), lineaCompraVacia(3)]
    expect(cambiarLinea(ls, 3, { idProv: 2 })).toEqual([lineaCompraVacia(1), { ...lineaCompraVacia(3), idProv: 2 }])
    expect(quitarLinea(ls, 1)).toEqual([lineaCompraVacia(3)])
    expect(siguienteId(ls)).toBe(4)
    expect(siguienteId([])).toBe(1)
  })
})
