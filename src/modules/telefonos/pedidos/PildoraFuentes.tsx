import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { useEstadoNsys, useFuentesPedidos } from '../api'
import { horaItems } from '../stock/nsys'

const ORDEN = ['OK', 'RETRASO', 'SIN_DATOS']
const TEXTO: Record<string, string> = { OK: 'al día', RETRASO: 'con retraso', SIN_DATOS: 'sin datos' }
const CLASES: Record<string, string> = {
  OK: 'border-borde-input bg-superficie text-azul-gris',
  RETRASO: 'border-ambar bg-form-agotado-bg text-form-agotado-text',
  SIN_DATOS: 'border-fila-urgente-brd bg-urgente-bg text-fila-urgente-brd',
}
const PUNTO: Record<string, string> = { OK: 'bg-verde-ok', RETRASO: 'bg-ambar', SIN_DATOS: 'bg-fila-urgente-brd' }
const NOMBRE: Record<string, string> = { SHIPPYPRO: 'ShippyPro' }
const hora = (iso: string | null | undefined) => (iso ? `${diaNsys(iso)} ${iso.slice(11, 16)}` : '—')

/** Píldora de las fuentes de «Pedidos» (spec «Pedidos como la hoja» §3): el peor nivel entre ShippyPro y NSYS y, al pulsarla, la
 *  última lectura buena de cada una, si la última falló y los SKU que el maestro no conoce. */
export function PildoraFuentes() {
  const { data, isPending, isError } = useFuentesPedidos()
  // NSYS ya está en caché por la barra de arriba (la misma consulta que PildoraNsys).
  const nsys = useEstadoNsys().data
  if (!data) {
    // Cargando o sin poder preguntar: neutra, sin un nivel que no sabemos (como PildoraNsys).
    const aviso = isError ? 'Fuentes: no se pudo comprobar' : isPending ? 'Fuentes: comprobando…' : 'Fuentes: sin datos'
    return (
      <span role="status" className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px]', CLASES.OK)}>
        <span aria-hidden className="h-2 w-2 rounded-full bg-gris-borde" />{aviso}
      </span>
    )
  }
  const niveles = nsys?.ultimaExportacion ? [...data.map((f) => f.nivel), nsys.nivel] : data.map((f) => f.nivel)
  const nivel = niveles.reduce((peor, n) => (ORDEN.indexOf(n) > ORDEN.indexOf(peor) ? n : peor), 'OK')
  // Un aviso de una fuente (ShippyPro) pone la píldora en ámbar y lo dice en su texto, aunque el nivel sea «al día».
  const conAviso = data.some((f) => !!f.aviso)
  const textoNivel = conAviso && nivel === 'OK' ? 'con avisos' : (TEXTO[nivel] ?? nivel)
  const nivelPildora = conAviso && nivel === 'OK' ? 'RETRASO' : nivel
  const avisados = data.filter((f) => f.aviso).map((f) => NOMBRE[f.fuente] ?? f.fuente)
  const visible = conAviso && nivel === 'OK' ? `${avisados.join(' · ')}: con avisos` : `ShippyPro · NSYS: ${textoNivel}`
  const items = nsys?.ultimaExportacion ? horaItems(nsys.ultimaExportacion) : null
  return (
    <Popover>
      <PopoverTrigger aria-label={`Fuentes: ${visible}`} className="ml-auto cursor-pointer rounded-full">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px]', CLASES[nivelPildora] ?? CLASES.OK)}>
          <span aria-hidden className={cn('h-2 w-2 rounded-full', PUNTO[nivelPildora] ?? PUNTO.OK)} />
          {visible}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Fuentes de Pedidos" className="w-[420px] rounded-lg border border-fila-sep bg-superficie p-3 text-[12px] shadow-md">
        <ul className="flex flex-col gap-2">
          {data.map((f) => (
            <li key={f.fuente}>
              <div className="flex gap-2"><b className="w-28 shrink-0">{NOMBRE[f.fuente] ?? f.fuente}</b><span>los pedidos, sin IMEI</span></div>
              <div className="pl-[120px] text-texto-sub">
                Última lectura buena: {hora(f.ultimaBuena)}
                {f.resultado && f.resultado !== 'OK' && <> · la última, {f.resultado.toLowerCase()}{f.motivo ? `: ${f.motivo}` : ''}</>}
                {f.skuDesconocidos && <> · SKU que no están en el maestro: {f.skuDesconocidos}</>}
                {f.aviso && <> · Aviso: {f.aviso}</>}
              </div>
            </li>
          ))}
          <li>
            <div className="flex gap-2"><b className="w-28 shrink-0">NSYS</b><span>dónde está cada móvil</span></div>
            <div className="pl-[120px] text-texto-sub">
              {items ? `Items ${items.length === 5 ? 'de las' : 'del'} ${items}` : 'Items: sin datos todavía'}
              {nsys && nsys.nivel !== 'OK' && <> · {TEXTO[nsys.nivel] ?? nsys.nivel}</>}
            </div>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  )
}
