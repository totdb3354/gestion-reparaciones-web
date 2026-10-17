import { cn } from '@/shared/lib/utils'
import { useEstadoNsys } from '../api'
import { textoBanda, textoPildora } from './nsys'

const CLASES: Record<string, string> = {
  OK: 'border-borde-input bg-superficie text-azul-gris',
  RETRASO: 'border-ambar bg-form-agotado-bg text-form-agotado-text',
  SIN_DATOS: 'border-fila-urgente-brd bg-urgente-bg text-fila-urgente-brd',
}
const PUNTO: Record<string, string> = { OK: 'bg-verde-ok', RETRASO: 'bg-ambar', SIN_DATOS: 'bg-fila-urgente-brd' }

/** Píldora de la cabecera con la hora de la última exportación de NSYS (spec §5.7). El motivo del último fallo, al
 *  pasar el ratón. */
export function PildoraNsys() {
  const { data, isPending } = useEstadoNsys()
  const nivel = data?.nivel ?? 'SIN_DATOS'
  return (
    <span role="status" title={data?.motivoFallo ?? undefined}
      className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px]', CLASES[nivel] ?? CLASES.OK)}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', PUNTO[nivel] ?? PUNTO.OK)} />
      {isPending ? 'NSYS: comprobando…' : textoPildora(data)}
    </span>
  )
}

/** La banda roja cuando no llegan datos de NSYS. */
export function BandaNsys() {
  const { data } = useEstadoNsys()
  const texto = textoBanda(data)
  if (!texto) return null
  return (
    <div role="alert" className="mb-2.5 rounded-lg border border-fila-urgente-brd bg-urgente-bg px-3 py-2 text-[12.5px] text-[#7f1d1d]">
      {texto}
    </div>
  )
}
