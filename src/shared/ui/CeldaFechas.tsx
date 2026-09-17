import { formatear, type Patron } from '@/shared/lib/fechas'
import { CREMA_EN_FILA_SELECCIONADA } from './DataTable'

/** Calco de la columna "Fechas" (asignación en gris pequeño, "→ fin" debajo; "—" si falta). Las dos líneas pasan a blanco
 *  en la fila seleccionada (actualizarColores). */
export function CeldaFechas({ inicio, fin, patron }: { inicio: string | null; fin: string | null; patron: Patron }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-[10px] text-texto-fecha-inicio ${CREMA_EN_FILA_SELECCIONADA}`}>{formatear(inicio, patron) || '—'}</span>
      <span className={`text-[11px] text-azul-medio ${CREMA_EN_FILA_SELECCIONADA}`}>→ {formatear(fin, patron) || '—'}</span>
    </div>
  )
}
