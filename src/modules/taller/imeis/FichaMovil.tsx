import type { FichaMovil as Ficha } from '@/shared/api/client'
import { clasesUbicacion, diaNsys, nombreModeloNsys, textoEstadoMovil } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'

type Props = { ficha: Ficha; eventos: number | null; onVerRastro: () => void }

/** Ficha del móvil según NSYS, encima de la vista de trabajos de hoy (0.9.17, spec §9.3), con el botón del rastro. */
export function FichaMovil({ ficha, eventos, onVerRastro }: Props) {
  const venta = ficha.fechaVenta ? diaNsys(ficha.fechaVenta) : null
  return (
    <section aria-label="Ficha de NSYS" className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg bg-superficie px-4 py-3 text-[12.5px] text-azul-medio">
      <span className="font-mono text-[17px] font-extrabold text-azul-noche">{ficha.imeiSn}</span>
      <span>{[nombreModeloNsys(ficha.modelo, ficha.modeloMaestro), ficha.capacidad, ficha.color].filter(Boolean).join(' ')}</span>
      <span>Grado <b className="text-azul-noche">{ficha.grado}</b>{ficha.gradoAnterior && ` (antes ${ficha.gradoAnterior})`}{ficha.bateriaNueva && ' · batería nueva'}</span>
      {ficha.sku && <span>SKU <b className="font-mono text-azul-noche">{ficha.sku}</b></span>}
      {ficha.ubicacion && <span className={cn(CLASES_PILDORA, clasesUbicacion(ficha.ubicacion))}>{ficha.ubicacion}</span>}
      {ficha.estado === 'VENDIDO'
        ? <span className={cn(CLASES_PILDORA, 'bg-azul-noche text-superficie')}>{venta ? `Vendido el ${venta}` : 'Vendido'}</span>
        : <span className={ficha.estado === 'DE_PEDIDO' ? 'font-bold text-fila-urgente-brd' : 'text-azul-gris'}>{textoEstadoMovil(ficha.estado)}</span>}
      <span>Lote <b className="text-azul-noche">{ficha.lote}</b></span>
      {ficha.dias != null && <span>En stock <b className="text-azul-noche">{ficha.dias} días</b>{ficha.entradas > 1 && ` (${ficha.entradas} entradas)`}</span>}
      <button type="button" onClick={onVerRastro} disabled={eventos == null}
        className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-3xl border border-azul-noche bg-superficie px-3.5 py-1.5 text-[12px] font-bold text-azul-noche hover:bg-seleccion-suave disabled:cursor-default disabled:opacity-50">
        {eventos == null ? 'Ver rastro' : `Ver rastro (${eventos})`}
      </button>
    </section>
  )
}
