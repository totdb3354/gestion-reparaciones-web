export type TipoAviso = 'ok' | 'info' | 'warn'
export type AvisoBreve = { texto: string; tipo: TipoAviso }

const oyentes = new Set<(aviso: AvisoBreve) => void>()

/** Aviso breve no modal (spec 2026-10-13 §2.7): lo pinta <AvisoBreveHost />. Se puede llamar desde fuera de React. */
export function avisar(aviso: AvisoBreve) {
  oyentes.forEach((oyente) => oyente(aviso))
}

export function onAviso(oyente: (aviso: AvisoBreve) => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}
