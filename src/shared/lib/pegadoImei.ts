/** Port de ImeiUtils.parsearPegadoImeis del JavaFX: quita todo lo que no sea dígito y trocea en bloques de 15. */
export type TipoPegado = 'INCOMPLETO' | 'UNICO' | 'LOTE' | 'CORRUPTO'

export function parsearPegadoImeis(texto: string | null | undefined): { tipo: TipoPegado; imeis: string[] } {
  const d = (texto ?? '').replace(/\D/g, '')
  if (d.length < 15) return { tipo: 'INCOMPLETO', imeis: [] }
  if (d.length === 15) return { tipo: 'UNICO', imeis: [d] }
  if (d.length % 15 !== 0) return { tipo: 'CORRUPTO', imeis: [] }
  const imeis: string[] = []
  for (let i = 0; i < d.length; i += 15) imeis.push(d.slice(i, i + 15))
  return { tipo: 'LOTE', imeis }
}
