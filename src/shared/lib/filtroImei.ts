/** Calco de FiltroImei: campo multi-IMEI con pegado en lote (spec filtro-imei-pegado 2026-06-29). */
export type EstadoFiltroImei = 'vacio' | 'incompleto' | 'valido'

/** Solo dígitos y comas, separador ", ", troceo de tokens largos cada 15 y ", " tras un IMEI completo. Idempotente. */
export function canonicalizarImei(texto: string | null | undefined): string {
  if (!texto) return ''
  const limpio = texto.replace(/, /g, ',').replace(/[^\d,]/g, '').replace(/,+/g, ',').replace(/^,/, '')
  const partes: string[] = []
  for (const token of limpio.split(',')) {
    if (token.length > 15) {
      for (let i = 0; i < token.length; i += 15) partes.push(token.slice(i, i + 15))
    } else {
      partes.push(token)
    }
  }
  const unido = partes.join(',')
  let visible = unido.replace(/,/g, ', ')
  const ultimo = unido.split(',').at(-1) ?? ''
  if (ultimo.length === 15 && !visible.endsWith(', ')) visible += ', '
  return visible
}

export function imeisValidos(texto: string | null | undefined): Set<string> {
  if (!texto || texto.trim() === '') return new Set()
  return new Set(texto.split(',').map((t) => t.trim()).filter((t) => t.length === 15))
}

export function estadoFiltroImei(texto: string | null | undefined): EstadoFiltroImei {
  if (!texto || texto.trim() === '') return 'vacio'
  const tokens = texto.split(',').map((t) => t.trim()).filter((t) => t !== '')
  if (tokens.some((t) => t.length < 15)) return 'incompleto'
  return imeisValidos(texto).size === 0 ? 'vacio' : 'valido'
}
