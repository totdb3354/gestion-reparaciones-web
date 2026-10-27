import { useEffect, useState } from 'react'
import { onAviso, type AvisoBreve, type TipoAviso } from './avisos'

/** Lo que dura el aviso: la barra encoge en este tiempo (clase .aviso-barra, globals.css) y al acabar se cierra. */
export const DURACION_AVISO_MS = 4000

const ICONO: Record<TipoAviso, { simbolo: string; clase: string }> = {
  ok: { simbolo: '✓', clase: 'bg-verde-ok text-superficie' },
  info: { simbolo: 'i', clase: 'bg-aviso-info text-azul-noche' },
  warn: { simbolo: '!', clase: 'bg-aviso-warn text-azul-noche' },
}

/**
 * Aviso breve abajo al centro (spec 2026-10-13 §2.7). No es un modal: no oscurece, no roba el foco y no hay que pulsar nada.
 * Una barra amarilla encoge en 4 s y al acabar se cierra; un clic (o la × de la derecha) lo cierra antes; uno nuevo sustituye al anterior y, al
 * cambiar la clave, la barra vuelve a empezar. Los errores siguen yendo por AlertaProvider.
 */
export function AvisoBreveHost() {
  const [actual, setActual] = useState<(AvisoBreve & { clave: number }) | null>(null)
  useEffect(() => onAviso((aviso) => setActual((previo) => ({ ...aviso, clave: (previo?.clave ?? 0) + 1 }))), [])
  useEffect(() => {
    if (actual === null) return
    const temporizador = setTimeout(() => setActual(null), DURACION_AVISO_MS)
    return () => clearTimeout(temporizador)
  }, [actual])
  if (actual === null) return null
  const icono = ICONO[actual.tipo]
  return (
    <div
      key={actual.clave}
      role="status"
      aria-live="polite"
      data-testid="aviso-breve"
      data-tipo={actual.tipo}
      onClick={() => setActual(null)}
      className="fixed bottom-[26px] left-1/2 z-[90] flex max-w-[min(560px,92vw)] min-w-[320px] -translate-x-1/2 cursor-pointer items-center gap-2.5 overflow-hidden rounded-[10px] bg-azul-noche py-3 pr-[18px] pb-[15px] pl-3.5 text-[13px] font-semibold text-crema shadow-lg"
    >
      <span aria-hidden="true" className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${icono.clase}`}>
        {icono.simbolo}
      </span>
      <span>{actual.texto}</span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        title="Cerrar"
        onClick={(e) => {
          e.stopPropagation()
          setActual(null)
        }}
        className="ml-auto flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[16px] leading-none text-crema/70 hover:bg-superficie/10 hover:text-crema"
      >
        ×
      </button>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-superficie/10">
        <i className="aviso-barra block h-full bg-amarillo" />
      </div>
    </div>
  )
}
