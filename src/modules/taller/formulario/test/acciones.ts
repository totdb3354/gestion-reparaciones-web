import type { AccionFormulario, EstadoFormulario } from '../estado'

/** «+» como lo pulsaban los tests de antes de la 0.9.19: si la fila está sin elegir, primero «Nueva» (que ya pone 1); si ya es
 *  Nueva, «+». Solo para arneses que reparten varios clics sobre la misma fila. */
export function sumarOElegir(estado: EstadoFormulario, prefijo: string): AccionFormulario {
  const fila = estado.filas.find((f) => f.prefijo === prefijo)
  return fila?.eleccion === 'nueva' ? { tipo: 'SUMAR', prefijo } : { tipo: 'ELEGIR', prefijo, eleccion: 'nueva' }
}
