import type { MovilComprobado } from '@/shared/api/client'
import { descripcionMovil, diaNsys, nombreModeloNsys, textoEstadoMovil } from '@/shared/lib/telefonoNsys'
import { quienLoTiene } from './quien'

/** «Pegar varios IMEIs» (0.9.18, spec «Columna compacta, SKU, Quién lo tiene y Revisado» §4.9): partir lo pegado, marcar
 *  cada línea, juntarla con la respuesta del servidor y resumir. */

/** Un IMEI son 15 cifras; un número de serie, de 8 a 20 letras y cifras con alguna de cada (así «pendiente» o un IMEI al
 *  que le falta una cifra no pasan por número de serie). */
export function esImei(texto: string): boolean {
  return /^\d{15}$/.test(texto) || /^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9]{8,20}$/.test(texto)
}

/** Los trozos de lo pegado: uno por línea o separados por comas, puntos y comas, tabuladores o espacios (una columna de
 *  Excel llega con un salto de línea por celda). */
export function trocear(texto: string): string[] {
  return texto.split(/[\s,;]+/).filter(Boolean)
}

/** Cuántos IMEIs (o números de serie) hay en un texto: con más de uno, el buscador abre el diálogo. */
export const imeisEn = (texto: string): number => trocear(texto).filter(esImei).length

export type Linea =
  | { n: number; texto: string; tipo: 'NO_IMEI' }
  | { n: number; texto: string; tipo: 'REPETIDO'; de: number }
  | { n: number; texto: string; tipo: 'IMEI'; imei: string }
export type Fila = { linea: Linea; movil: MovilComprobado | null }
export type Cifra = { texto: string; tono: 'ok' | 'aviso' | 'mal' | 'neutro' }

/** Marca cada trozo: no es un IMEI, repetido (con la línea del primero) o un IMEI que preguntar, en mayúsculas para que un
 *  número de serie en minúsculas cuente igual. `imeis`: los que se preguntan, sin repetir y en orden. */
export function analizar(texto: string): { lineas: Linea[]; imeis: string[] } {
  const vistos = new Map<string, number>()
  const lineas = trocear(texto).map((t, i): Linea => {
    const n = i + 1
    if (!esImei(t)) return { n, texto: t, tipo: 'NO_IMEI' }
    const imei = t.toUpperCase()
    const primero = vistos.get(imei)
    if (primero !== undefined) return { n, texto: t, tipo: 'REPETIDO', de: primero }
    vistos.set(imei, n)
    return { n, texto: t, tipo: 'IMEI', imei }
  })
  return { lineas, imeis: [...vistos.keys()] }
}

/** Junta las líneas con la respuesta del servidor, que trae una entrada por IMEI pedido. */
export function cruzar(lineas: Linea[], respuesta: MovilComprobado[]): Fila[] {
  const porImei = new Map(respuesta.map((m) => [m.imei.toUpperCase(), m]))
  return lineas.map((linea) => ({ linea, movil: linea.tipo === 'IMEI' ? porImei.get(linea.imei) ?? null : null }))
}

export function textoEstado({ linea, movil }: Fila): string {
  if (linea.tipo === 'NO_IMEI') return 'No es un IMEI'
  if (linea.tipo === 'REPETIDO') return `Repetido (línea ${linea.de})`
  if (!movil?.encontrado) return 'No está en NSYS'
  if (movil.estado === 'VENDIDO') return movil.fechaVenta ? `Vendido ${diaNsys(movil.fechaVenta)}` : 'Vendido'
  if (movil.estado === 'NO_CUENTA') return 'No cuenta'
  return textoEstadoMovil(movil.estado ?? '')
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** El resumen de arriba: siempre «N en stock» y lo demás solo si lo hay. */
export function resumen(filas: Fila[]): Cifra[] {
  const k = { stock: 0, pedido: 0, noCuenta: 0, vendidos: 0, baja: 0, noEstan: 0, repetidos: 0, noImei: 0 }
  for (const { linea, movil } of filas) {
    if (linea.tipo === 'NO_IMEI') k.noImei++
    else if (linea.tipo === 'REPETIDO') k.repetidos++
    else if (!movil?.encontrado) k.noEstan++
    else if (movil.estado === 'STOCK') k.stock++
    else if (movil.estado === 'DE_PEDIDO') k.pedido++
    else if (movil.estado === 'NO_CUENTA') k.noCuenta++
    else if (movil.estado === 'VENDIDO') k.vendidos++
    else k.baja++
  }
  const cifras: (Cifra | null)[] = [
    { texto: `${k.stock} en stock`, tono: 'ok' },
    k.pedido > 0 ? { texto: `${k.pedido} de pedido`, tono: 'aviso' } : null,
    k.noCuenta > 0 ? { texto: plural(k.noCuenta, 'no cuenta', 'no cuentan'), tono: 'aviso' } : null,
    k.vendidos > 0 ? { texto: plural(k.vendidos, 'vendido', 'vendidos'), tono: 'aviso' } : null,
    k.baja > 0 ? { texto: `${k.baja} de baja`, tono: 'neutro' } : null,
    k.noEstan > 0 ? { texto: plural(k.noEstan, 'no está en NSYS', 'no están en NSYS'), tono: 'mal' } : null,
    k.repetidos > 0 ? { texto: plural(k.repetidos, 'repetido', 'repetidos'), tono: 'neutro' } : null,
    k.noImei > 0 ? { texto: plural(k.noImei, 'no es un IMEI', 'no son un IMEI'), tono: 'neutro' } : null,
  ]
  return cifras.filter((c): c is Cifra => c !== null)
}

/** «iPhone 13 128GB». */
export const modeloYCapacidad = (m: MovilComprobado): string => descripcionMovil(nombreModeloNsys(m.modelo, m.modeloMaestro), m.capacidad)

const CABECERA_EXCEL = ['#', 'IMEI', 'Modelo', 'Color', 'Grado', 'Ubicación', 'Quién lo tiene', 'Estado']
const celda = (t: string) => t.replace(/[\t\r\n]+/g, ' ')

/** El resultado como tabla separada por tabuladores, para pegarlo en Excel. `ahora`: la hora de la respuesta (ms), para
 *  «Quién lo tiene». */
export function paraExcel(filas: Fila[], ahora: number): string {
  const lineas = filas.map((f) => {
    const m = f.movil?.encontrado ? f.movil : null
    const quien = m ? quienLoTiene({ ubicacion: m.ubicacion, estado: m.estado ?? '', trabajos: m.trabajos }, ahora).texto : ''
    return [String(f.linea.n), f.linea.texto, m ? modeloYCapacidad(m) : '', m?.color ?? '', m?.grado ?? '', m?.ubicacion ?? '', quien, textoEstado(f)]
  })
  return [CABECERA_EXCEL, ...lineas].map((columnas) => columnas.map(celda).join('\t')).join('\n')
}
