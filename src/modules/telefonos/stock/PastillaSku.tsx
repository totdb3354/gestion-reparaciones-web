import type { FiltroSku } from './modelo'

/** El filtro de SKU en la cabecera del modelo (spec 0.9.18 §4.2): «SKU i13PRO128GrafitoA ×» o «SKU empieza por i13PRO128 ×». */
export function PastillaSku({ sku, onQuitar }: { sku: FiltroSku; onQuitar: () => void }) {
  return (
    <span data-testid="pastilla-sku" className="inline-flex items-center gap-1.5 rounded-full bg-azul-noche py-0.5 pr-1 pl-2.5 text-[12px] font-semibold text-superficie">
      {sku.exacto ? 'SKU' : 'SKU empieza por'} <b className="font-mono">{sku.texto}</b>
      <button type="button" aria-label="Quitar el filtro de SKU" onClick={onQuitar}
        className="h-[18px] w-[18px] cursor-pointer rounded-full bg-white/20 leading-4 text-superficie">×</button>
    </span>
  )
}
