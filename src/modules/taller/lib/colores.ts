import { extraerModelo } from './modelos'

/** Tipos de pieza que van por color (spec 0.9.7 §9): sin SKU preseleccionado, con muestra de color y enlazados entre sí. */
export const PREFIJO_CHASIS = 'cha'
export const PREFIJO_TAPA = 'tapa'
export const PREFIJOS_CON_COLOR: readonly string[] = [PREFIJO_CHASIS, PREFIJO_TAPA]

export type LecturaSku = { modelo: string | null; esim: boolean; token: string }
export type ColorSku = LecturaSku & { nombre: string; tono: string | null }

type Color = { nombre: string; tono: string; porModelo?: Record<string, string> }

/** Nombre oficial de Apple y tono aproximado de cada color de SKU (spec 0.9.7 §9.2). Solo orientativo: sirve para
 *  distinguir los colores de un mismo modelo. `porModelo` corrige los nombres que Apple repite con otro tono. */
const TABLA: Record<string, Color> = {
  black: { nombre: 'Black', tono: '#232426', porModelo: { '15': '#3B3D3F', '15plus': '#3B3D3F', '16': '#3C3C3E', '16plus': '#3C3C3E', '16e': '#3C3C3E' } },
  white: { nombre: 'White', tono: '#F4F4F0' },
  red: { nombre: '(PRODUCT)RED', tono: '#BF0013' },
  blue: { nombre: 'Blue', tono: '#2C5A84', porModelo: { '12': '#11416B', '12mini': '#11416B', '13': '#2F6585', '13mini': '#2F6585', '14': '#A0B4C7', '14plus': '#A0B4C7', '15': '#D3E0EA', '15plus': '#D3E0EA' } },
  green: { nombre: 'Green', tono: '#4E6B4F', porModelo: { '12': '#D8EFD5', '12mini': '#D8EFD5', '13': '#394C38', '13mini': '#394C38', '15': '#D0DCC9', '15plus': '#D0DCC9' } },
  purple: { nombre: 'Purple', tono: '#B9AEDC', porModelo: { '14': '#E3DAEA', '14plus': '#E3DAEA' } },
  pink: { nombre: 'Pink', tono: '#F4C7D4', porModelo: { '13': '#F9E0DA', '13mini': '#F9E0DA', '15': '#F6D7DC', '15plus': '#F6D7DC', '16': '#F0A6CF', '16plus': '#F0A6CF' } },
  yellow: { nombre: 'Yellow', tono: '#F6E58D', porModelo: { '15': '#F2E9C4', '15plus': '#F2E9C4' } },
  midnight: { nombre: 'Midnight', tono: '#232A31' },
  starlight: { nombre: 'Starlight', tono: '#F7F1E7' },
  gold: { nombre: 'Gold', tono: '#F3E2C7' },
  graphite: { nombre: 'Graphite', tono: '#54524F' },
  silver: { nombre: 'Silver', tono: '#E3E4E3' },
  pacificblue: { nombre: 'Pacific Blue', tono: '#2E4A5C' },
  sierrablue: { nombre: 'Sierra Blue', tono: '#A7C1D9' },
  alpinegreen: { nombre: 'Alpine Green', tono: '#576856' },
  deeppurple: { nombre: 'Deep Purple', tono: '#594F63' },
  spaceblack: { nombre: 'Space Black', tono: '#3B3A39', porModelo: { air: '#1E1E20' } },
  blacktitanium: { nombre: 'Black Titanium', tono: '#3C3C3D' },
  bluetitanium: { nombre: 'Blue Titanium', tono: '#3D4555' },
  naturaltitanium: { nombre: 'Natural Titanium', tono: '#BAB4A9' },
  whitetitanium: { nombre: 'White Titanium', tono: '#F2F1ED' },
  deserttitanium: { nombre: 'Desert Titanium', tono: '#BFA48F' },
  teal: { nombre: 'Teal', tono: '#B0D4D2' },
  ultramarine: { nombre: 'Ultramarine', tono: '#9AADF6' },
  sage: { nombre: 'Sage', tono: '#A9B693' },
  mistblue: { nombre: 'Mist Blue', tono: '#9DB3D1' },
  lavender: { nombre: 'Lavender', tono: '#DCCBE8' },
  cloudwhite: { nombre: 'Cloud White', tono: '#F5F5F2' },
  lightgold: { nombre: 'Light Gold', tono: '#E6D5B5' },
  skyblue: { nombre: 'Sky Blue', tono: '#C5DCEF' },
  deepblue: { nombre: 'Deep Blue', tono: '#2F3B57' },
  cosmicorange: { nombre: 'Cosmic Orange', tono: '#F2782F' },
}
const COLORES = new Map<string, Color>(Object.entries(TABLA))

/** Modelo, variante eSIM y token de color de un SKU de chasis o tapa: lo que queda entre el modelo y un `esim` final
 *  (`chai16ultramarineesim` → 16, eSIM, `ultramarine`). */
export function leerSku(sku: string, prefijo: string): LecturaSku {
  const modelo = extraerModelo(sku, prefijo)
  let resto = sku.toLowerCase().slice(prefijo.length)
  if (resto.startsWith('i')) resto = resto.slice(1)
  if (modelo !== null) resto = resto.slice(modelo.length)
  const esim = resto.endsWith('esim')
  return { modelo, esim, token: esim ? resto.slice(0, -'esim'.length) : resto }
}

/** Nombre oficial y tono del color de un SKU. Un color que no está en la tabla devuelve el token como nombre y tono
 *  null (el combo lo pinta con un círculo gris discontinuo). */
export function colorDeSku(sku: string, prefijo: string): ColorSku {
  const lectura = leerSku(sku, prefijo)
  const color = COLORES.get(lectura.token)
  if (color === undefined) return { ...lectura, nombre: lectura.token || sku, tono: null }
  const tono = (lectura.modelo !== null ? color.porModelo?.[lectura.modelo] : undefined) ?? color.tono
  return { ...lectura, nombre: color.nombre, tono }
}

/** Chasis y tapa «coinciden»: mismo modelo y mismo color (sin mirar SIM/eSIM). */
export function mismoColor(a: LecturaSku, b: LecturaSku): boolean {
  return a.modelo !== null && a.modelo === b.modelo && a.token === b.token
}
