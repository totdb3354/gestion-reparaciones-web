import type { IdGrupoNav } from '@/shared/lib/enlaces'

/** Columna lateral plegada o abierta (0.9.10, spec «Columna lateral plegable» §2): preferencia de este navegador, no del
 *  usuario (en el taller se comparten PCs), y no es un filtro: `reiniciarStores` no la toca al cerrar sesión. Si no se
 *  puede leer (modo privado, almacenamiento bloqueado), abierta; si no se puede guardar, dura lo que la página. */
export const CLAVE_PLEGADA = 'columnaLateral.plegada'

export function leerPlegada(): boolean {
  try {
    return localStorage.getItem(CLAVE_PLEGADA) === 'si'
  } catch {
    return false
  }
}

export function guardarPlegada(plegada: boolean): void {
  try {
    localStorage.setItem(CLAVE_PLEGADA, plegada ? 'si' : 'no')
  } catch {
    // sin almacenamiento: la elección dura lo que la página
  }
}

/** Grupos plegados de la columna (0.9.12, spec «Navegación por grupos» §3): la misma preferencia del navegador. Un valor que
 *  no sea una lista equivale a ninguno plegado; los ids que no son de un grupo conocido se ignoran. */
export const CLAVE_GRUPOS_PLEGADOS = 'columnaLateral.gruposPlegados'
const IDS_GRUPOS: readonly IdGrupoNav[] = ['reparaciones', 'stock', 'estadisticas', 'clientes', 'gestion']
const esIdGrupo = (v: unknown): v is IdGrupoNav => typeof v === 'string' && (IDS_GRUPOS as readonly string[]).includes(v)

export function leerGruposPlegados(): Set<IdGrupoNav> {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(CLAVE_GRUPOS_PLEGADOS) ?? '[]')
    return new Set(Array.isArray(valor) ? valor.filter(esIdGrupo) : [])
  } catch {
    return new Set()
  }
}

export function guardarGruposPlegados(ids: ReadonlySet<IdGrupoNav>): void {
  try {
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, JSON.stringify([...ids]))
  } catch {
    // sin almacenamiento: la elección dura lo que la página
  }
}
