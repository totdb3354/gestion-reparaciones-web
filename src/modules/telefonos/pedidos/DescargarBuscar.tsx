import { elegirDestino } from '@/shared/lib/descargas'
import { TIPO_XLSX, useDescargarBuscar } from '../api'

/** «Listado 20-11 13h25.xlsx»: día y hora de Madrid, como el nombre que pone el servidor (sin «:», que Windows no admite). */
export function nombreListado(ahora: Date = new Date()): string {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(ahora).map((p) => [p.type, p.value]))
  const dos = (v: string) => v.padStart(2, '0')
  return `Listado ${dos(partes.day)}-${dos(partes.month)} ${dos(partes.hour)}h${dos(partes.minute)}.xlsx`
}

/** «Listado» (cabecera de Pedidos): un clic baja el Excel de lo que hay que buscar, con una pestaña por plataforma (AMZ, FNSK y Webs).
 *  Como las plantillas de NSYS, «Guardar como» va en el mismo clic, antes de pedir el fichero al servidor. Mientras baja, el botón queda
 *  deshabilitado; un error sale en el diálogo de siempre. */
export function DescargarBuscar() {
  const descargar = useDescargarBuscar()
  const bajar = async () => {
    const destino = await elegirDestino(nombreListado(), TIPO_XLSX)
    if (destino === 'cancelado') return
    descargar.mutate({ destino })
  }
  return (
    <button type="button" disabled={descargar.isPending} onClick={() => void bajar()}
      title="Excel con lo que hay que buscar: una pestaña por plataforma (AMZ, FNSK y Webs)"
      className="h-7 cursor-pointer rounded-xl border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold text-azul-medio disabled:cursor-default disabled:opacity-60">Listado</button>
  )
}
