import { cn } from '@/shared/lib/utils'

export type TipoPildora = 'pieza' | 'otro'

/** Píldora delante del nombre de una línea (0.9.15, spec «Añadir otro» §5.1, opción C2): «pieza» en azul suave u «otro»
 *  en lila, las dos de 44 px para que los nombres empiecen alineados. Conserva sus colores en la fila seleccionada. */
export function PildoraTipo({ tipo, className }: { tipo: TipoPildora; className?: string }) {
  return (
    <span className={cn('inline-block w-11 shrink-0 rounded-md py-px text-center text-[10.5px] font-bold',
      tipo === 'pieza' ? 'bg-pieza-bg text-pieza-text' : 'bg-otro-bg text-otro-text', className)}>
      {tipo}
    </span>
  )
}
