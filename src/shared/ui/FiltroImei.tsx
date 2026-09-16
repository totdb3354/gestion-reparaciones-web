import { useLayoutEffect, useRef } from 'react'
import { canonicalizarImei, estadoFiltroImei } from '@/shared/lib/filtroImei'
import { cn } from '@/shared/lib/utils'

const BORDE = {
  vacio: 'border-azul-gris bg-superficie',
  incompleto: 'border-fila-incidencia-brd bg-fondo-input',
  valido: 'border-fila-reparado-ico bg-fondo-input',
} as const

type Props = { valor: string; onChange: (valor: string) => void; className?: string }

/** Calco del TextField `.buscador` "Filtrar por IMEI" con FiltroImei: canonicaliza al teclear (el caret va al final,
 *  como positionCaret) y pinta el borde rojo con tokens incompletos o verde con IMEIs válidos. */
export function FiltroImei({ valor, onChange, className }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const moverCaret = useRef(false)
  useLayoutEffect(() => {
    if (!moverCaret.current || !ref.current) return
    moverCaret.current = false
    ref.current.setSelectionRange(valor.length, valor.length)
  }, [valor])
  return (
    <input
      ref={ref}
      type="text"
      placeholder="Filtrar por IMEI"
      aria-label="Filtrar por IMEI"
      value={valor}
      onChange={(e) => {
        const canonico = canonicalizarImei(e.target.value)
        if (canonico !== e.target.value) moverCaret.current = true
        onChange(canonico)
      }}
      className={cn('h-10 w-[160px] rounded border px-2.5 text-[12px] text-azul-medio outline-none placeholder:text-texto-suave', BORDE[estadoFiltroImei(valor)], className)}
    />
  )
}
