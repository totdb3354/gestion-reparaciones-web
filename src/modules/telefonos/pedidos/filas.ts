import type { FilaVista } from '@/shared/api/client'

/** Las columnas de la tabla, con los nombres de la hoja (sin letras). */
export const COLUMNAS = ['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Fecha compra'] as const

/** Lo que cada recomendado dice de sí mismo respecto al pedido (nivel 1 = el mejor). */
export const TEXTO_NIVEL: Record<1 | 2 | 3, string> = {
  1: 'igual que el pedido',
  2: 'en el taller, acabará igual',
  3: 'hay que transformarlo',
}

/** El motivo del aviso de una fila en palabras; con `skuMovil`, dice qué es el móvil. Sin motivo conocido, null. */
export function textoMotivo(f: FilaVista): string | null {
  const es = f.skuMovil ? `: es ${f.skuMovil}` : ''
  switch (f.motivo) {
    case 'NO_EN_NSYS': return 'no está en NSYS'
    case 'EN_OTRA_FILA': return 'ya está en otro pedido'
    case 'MODELO': return `otro modelo, capacidad o eSIM${es}`
    case 'COLOR_O_GRADO': return `otro color o grado${es}`
    case 'GRADO_NO_VENDIBLE': return 'ese grado no se vende'
    case 'SKU_DESCONOCIDO': return 'el maestro no conoce este SKU'
    case 'EN_TALLER': return 'en el taller'
    case 'MS': return 'es un Ms'
    case 'B_POR_A': return 'B por A'
    default: return null
  }
}

/** Cómo se pinta la celda del IMEI: enviada (gris), vacía, o por el nivel que dice el servidor. */
export function claseCelda(f: FilaVista): 'vacia' | 'ok' | 'aviso' | 'mal' | 'enviada' {
  if (f.enviada) return 'enviada'
  if (!f.imei) return 'vacia'
  if (f.nivel === 'AVISO') return 'aviso'
  if (f.nivel === 'MAL') return 'mal'
  return 'ok'
}

/** El contador de la cabecera: todas las filas, las sin enviar y, de estas, las que aún no tienen IMEI. */
export function recuento(filas: FilaVista[]): { total: number; sinEnviar: number; sinImei: number } {
  const vivas = filas.filter((f) => !f.enviada)
  return { total: filas.length, sinEnviar: vivas.length, sinImei: vivas.filter((f) => !f.imei).length }
}

/** El primer día del periodo «el último mes» que acaba en `hoy` (`YYYY-MM-DD`): el mismo día del mes anterior, o el último de
 *  ese mes si no existe (31 de marzo → 28 o 29 de febrero). */
export function haceUnMes(hoy: string): string {
  const [a, m, d] = hoy.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m - 1, 0)).getUTCDate()
  const f = new Date(Date.UTC(a, m - 2, Math.min(d, ultimo)))
  return f.toISOString().slice(0, 10)
}

