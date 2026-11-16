import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { useAsociaciones } from '../api'
import { textoRevisar, textoTienda } from './filas'

const hora = (iso: string) => iso.slice(11, 16)
const diaHora = (iso: string) => `${diaNsys(iso).slice(0, 5)} ${hora(iso)}`

/** Píldora de la asociación IMEI-pedido de Amazon: cuándo fue la última pasada de los libros de ventas y cuántas asociaciones quedaron
 *  «para revisar»; al pulsarla, la lista (pedido, IMEI y el motivo en palabras) por plataforma. Sin pasadas todavía, no sale. */
export function PildoraAsociacion() {
  const { data } = useAsociaciones()
  if (!data || data.length === 0) return null
  const ultima = data.reduce((a, c) => (c.cuando > a ? c.cuando : a), data[0].cuando)
  const total = data.reduce((n, c) => n + c.paraRevisar, 0)
  const visible = `Asociación Amazon: ${hora(ultima)} · ${total} para revisar`
  return (
    <Popover>
      <PopoverTrigger aria-label={visible} className="cursor-pointer rounded-full">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px]',
          total > 0 ? 'border-ambar bg-form-agotado-bg text-form-agotado-text' : 'border-borde-input bg-superficie text-azul-gris')}>
          <span aria-hidden className={cn('h-2 w-2 rounded-full', total > 0 ? 'bg-ambar' : 'bg-verde-ok')} />
          {visible}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Asociación de Amazon" className="w-[460px] max-w-[calc(100vw-16px)] rounded-lg border border-fila-sep bg-superficie p-3 text-[12px] shadow-md">
        <h2 className="mb-2 text-[13px] font-bold text-azul-medio">Asociación de Amazon</h2>
        <ul className="flex flex-col gap-3">
          {data.map((c) => (
            <li key={c.canal}>
              <div className="flex gap-2"><b className="w-28 shrink-0">{textoTienda(c.canal)}</b><span>última pasada: {diaHora(c.cuando)}</span></div>
              <div className="pl-[120px] text-texto-sub">
                {c.confirmadas} confirmadas · {c.intercambiadas} intercambiadas · {c.puestas} puestas · {c.yaEstaban} ya estaban
                {c.descartadas > 0 && <> · {c.descartadas} descartadas</>}
              </div>
              {c.revisar.length > 0 && (
                <ul aria-label={`Para revisar: ${textoTienda(c.canal)}`} className="m-0 mt-1 max-h-48 list-none overflow-y-auto p-0 pl-[120px]">
                  {c.revisar.map((r, i) => (
                    <li key={`${r.pedido}|${r.imei}|${i}`} className="border-b border-dashed border-form-fila-brd py-1">
                      <span className="font-semibold">{r.pedido}</span> · <code className="font-mono text-[11.5px]">{r.imei}</code>
                      <div className="text-[11px] text-azul-gris">{textoRevisar(r.motivo)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {total === 0 && <p className="m-0 mt-2 text-azul-gris">Nada para revisar.</p>}
      </PopoverContent>
    </Popover>
  )
}
