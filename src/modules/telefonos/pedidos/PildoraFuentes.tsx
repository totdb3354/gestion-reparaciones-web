import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { useFuentesPedidos } from '../api'

const ORDEN = ['OK', 'RETRASO', 'SIN_DATOS']
const TEXTO: Record<string, string> = { OK: 'al día', RETRASO: 'con retraso', SIN_DATOS: 'sin datos' }
const CLASES: Record<string, string> = {
  OK: 'border-borde-input bg-superficie text-azul-gris',
  RETRASO: 'border-ambar bg-form-agotado-bg text-form-agotado-text',
  SIN_DATOS: 'border-fila-urgente-brd bg-urgente-bg text-fila-urgente-brd',
}
const NOMBRE: Record<string, string> = { SHIPPYPRO: 'ShippyPro', PEDIDOS_2026: 'PEDIDOS 2026', SIMULADOR: 'Simulador' }
const PAPEL: Record<string, string> = {
  SHIPPYPRO: 'pedidos de Amazon y webs, sin IMEI', PEDIDOS_2026: 'los IMEIs tecleados para esos pedidos',
  SIMULADOR: 'pedido e IMEI juntos',
}
const hora = (iso: string | null | undefined) => (iso ? `${diaNsys(iso)} ${iso.slice(11, 16)}` : '—')

/** Píldora de las fuentes de «Pedidos» (spec pieza 2 §9.2): el peor nivel de las tres y, al pulsarla, el papel de cada una, su
 *  última lectura buena, si la última falló y los SKU que el maestro no conoce. */
export function PildoraFuentes() {
  const { data } = useFuentesPedidos()
  if (!data) return <span className="ml-auto" />
  const nivel = data.reduce((peor, f) => (ORDEN.indexOf(f.nivel) > ORDEN.indexOf(peor) ? f.nivel : peor), 'OK')
  const texto = `Fuentes: ${TEXTO[nivel] ?? nivel}`
  return (
    <Popover>
      <PopoverTrigger aria-label={texto} className="ml-auto cursor-pointer rounded-full">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px]', CLASES[nivel] ?? CLASES.OK)}>
          ShippyPro · PEDIDOS 2026 · Simulador: {TEXTO[nivel] ?? nivel}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Fuentes de Pedidos" className="w-[420px] rounded-lg border border-fila-sep bg-superficie p-3 text-[12px] shadow-md">
        <ul className="flex flex-col gap-2">
          {data.map((f) => (
            <li key={f.fuente}>
              <div className="flex gap-2"><b className="w-28 shrink-0">{NOMBRE[f.fuente] ?? f.fuente}</b><span>{PAPEL[f.fuente]}</span></div>
              <div className="pl-[120px] text-texto-sub">
                Última lectura buena: {hora(f.ultimaBuena)}
                {f.resultado && f.resultado !== 'OK' && <> · la última, {f.resultado.toLowerCase()}{f.motivo ? `: ${f.motivo}` : ''}</>}
                {f.skuDesconocidos && <> · SKU que no están en el maestro: {f.skuDesconocidos}</>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-texto-sub">Lo que NSYS da por vendido (Released) ya no sale. Las ventas del Simulador con reparación también están en PEDIDOS 2026: cada IMEI cuenta una sola vez.</p>
      </PopoverContent>
    </Popover>
  )
}
