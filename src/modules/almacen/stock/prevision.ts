/** Formato de la previsión de pedidos (spec 0.9.5 §3.4). Sin previsión (pieza desactivada, o TECNICO), "—". */
export function formatearConsumo(v: number | null | undefined): string {
  return typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '—'
}

export function formatearPedir(v: number | null | undefined): string {
  return typeof v === 'number' ? String(v) : '—'
}
