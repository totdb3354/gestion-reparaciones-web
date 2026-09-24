import type { Componente, ComponentesAgrupados } from '@/shared/api/client'
import { estadoStock } from '@/shared/lib/semaforoStock'

/** Calco de Piezas: categoría legible a partir del prefijo del SKU (prefijos largos antes para no confundir cha/cam con g). */
const PREFIJOS = ['otro', 'cha', 'cam', 'bat', 'lcd', 'mc', 'g'] as const
const ETIQUETAS: Record<(typeof PREFIJOS)[number], string> = {
  bat: 'Batería', cha: 'Chasis', g: 'Glass', cam: 'Cámara', lcd: 'Pantalla', mc: 'Marco', otro: 'Otros',
}

export function categoriaPieza(sku: string | null | undefined): string {
  if (!sku) return ''
  const s = sku.toLowerCase()
  for (const p of PREFIJOS) if (s.startsWith(p)) return ETIQUETAS[p]
  return ''
}

// ── Formulario de reparación ─────────────────────────────────────────────────────────────────────────────────────────

/** El grupo 'otro' no es fila del formulario: alimenta OTRAS ACCIONES. */
export const PREFIJO_OTRO = 'otro'
/** Los dos tipos de la variante Glass. */
export const PREFIJOS_GLASS: readonly string[] = ['g', 'mc']

const NOMBRES_TIPO: Record<string, string> = { bat: 'Batería', cha: 'Chasis', g: 'Glass', cam: 'Cámara', lcd: 'Pantalla', mc: 'Marco' }

/** Nombre de la fila para un prefijo del servidor. Distinta de categoriaPieza a propósito: aquí se parte del prefijo exacto
 *  (no del SKU) y un prefijo desconocido se muestra tal cual. */
export function nombreTipo(prefijo: string): string {
  return NOMBRES_TIPO[prefijo] ?? prefijo
}

/** Prefijos que son fila, en el orden de claves del servidor, sin grupos vacíos ni 'otro'. glass=false → todos menos g/mc
 *  (formulario de reparación); glass=true → solo g/mc (variante Glass). */
export function prefijosDeFila(agrupados: ComponentesAgrupados, glass: boolean): string[] {
  return Object.keys(agrupados).filter(
    (prefijo) => prefijo !== PREFIJO_OTRO && agrupados[prefijo].length > 0 && PREFIJOS_GLASS.includes(prefijo) === glass,
  )
}

export type NivelStock = 'sinStock' | 'bajo' | 'normal'

/** stock 0 → 'sinStock'; 0 < stock ≤ mínimo → 'bajo'; resto 'normal'. El combo del formulario solo lista activos, así que
 *  el "Desactivado" del semáforo compartido no llega aquí; el negativo cae en 'bajo' como en estadoStock. */
export function nivelStock(c: Pick<Componente, 'stock' | 'stockMinimo'>): NivelStock {
  switch (estadoStock({ ...c, activo: true })) {
    case 'Sin stock': return 'sinStock'
    case 'Bajo': return 'bajo'
    default: return 'normal'
  }
}

const CLASES_STOCK: Record<NivelStock, string> = { sinStock: 'text-rojo-sin-stock', bajo: 'text-fila-solicitud-brd', normal: '' }

/** Clase Tailwind del SKU, en la lista y en el botón del combo: rojo (#B03040) sin stock, ámbar (#C07800) en stock bajo y el
 *  color normal en otro caso. Los dos tokens ya existen en tokens.css. */
export function claseStock(c: Pick<Componente, 'stock' | 'stockMinimo'>): string {
  return CLASES_STOCK[nivelStock(c)]
}
