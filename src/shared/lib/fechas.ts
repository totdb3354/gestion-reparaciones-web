/** Calco de FechaUtils: el servidor manda LocalDateTime ISO sin zona (UTC); se muestra en Europe/Madrid. */
const ZONA = 'Europe/Madrid'

export type Patron = 'yyyy/MM/dd HH:mm' | 'yyyy/MM/dd' | 'dd/MM HH:mm' | 'dd/MM' | 'HH:mm' | 'dd/MM/yyyy' | 'dd/MM/yyyy HH:mm' | 'dd/MM/yy HH:mm'

/** Patrón de "Fecha asignación" (Pendientes, Asignaciones): una sola constante para que la fecha que se pinta y la
 *  que copia "Copiar celda" no puedan divergir. */
export const FMT_FECHA_ASIGNACION: Patron = 'yyyy/MM/dd HH:mm'

/** Patrón de la columna "Pedido" de las dos tablas de Pedidos (StockController `FMT` :153). */
export const FMT_FECHA_PEDIDO: Patron = 'dd/MM/yy HH:mm'

const FMT = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

type Partes = Record<'yyyy' | 'yy' | 'MM' | 'dd' | 'HH' | 'mm', string>

function partesMadrid(d: Date): Partes {
  const p: Record<string, string> = {}
  for (const parte of FMT.formatToParts(d)) p[parte.type] = parte.value
  // Algunos motores devuelven "24" a medianoche con hour12: false
  const HH = p.hour === '24' ? '00' : p.hour
  return { yyyy: p.year, yy: p.year.slice(-2), MM: p.month, dd: p.day, HH, mm: p.minute }
}

/** ISO sin zona = UTC (el JavaFX hace `atZone(UTC)`); con zona se respeta. Nulo o inválido → null. */
export function parsearUtc(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const conZona = /(Z|[+-]\d\d:\d\d)$/.test(iso)
  const d = new Date(conZona ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatear(iso: string | null | undefined, patron: Patron): string {
  const d = parsearUtc(iso)
  if (!d) return ''
  const p = partesMadrid(d)
  return patron.replace(/yyyy|yy|MM|dd|HH|mm/g, (t) => p[t as keyof Partes])
}

/** Fecha civil en Madrid ('yyyy-MM-dd'), comparable con los <input type="date"> de los filtros. */
export function fechaLocal(iso: string | null | undefined): string | null {
  const d = parsearUtc(iso)
  if (!d) return null
  const p = partesMadrid(d)
  return `${p.yyyy}-${p.MM}-${p.dd}`
}

export function hoyMadrid(ahora: Date = new Date()): string {
  const p = partesMadrid(ahora)
  return `${p.yyyy}-${p.MM}-${p.dd}`
}

const dos = (n: number) => String(n).padStart(2, '0')

/** "HH:mm" del reloj del PC (LocalTime.now() del JavaFX), para "Actualizado HH:mm". */
export function horaLocal(ahora: Date = new Date()): string {
  return `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`
}

/** Marca del nombre de fichero CSV (LocalDateTime.now() del JavaFX): 'yyyy-MM-dd_HH-mm' local. */
export function marcaFichero(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}_${dos(ahora.getHours())}-${dos(ahora.getMinutes())}`
}
