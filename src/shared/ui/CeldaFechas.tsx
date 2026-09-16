import { formatear, type Patron } from '@/shared/lib/fechas'

/** Calco de la columna "Fechas" (asignación en gris pequeño, "→ fin" debajo; "—" si falta). */
export function CeldaFechas({ inicio, fin, patron }: { inicio: string | null; fin: string | null; patron: Patron }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-texto-fecha-inicio">{formatear(inicio, patron) || '—'}</span>
      <span className="text-[11px] text-azul-medio">→ {formatear(fin, patron) || '—'}</span>
    </div>
  )
}
