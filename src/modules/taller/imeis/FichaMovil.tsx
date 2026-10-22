import type { FichaMovil as Ficha } from '@/shared/api/client'
import { clasesUbicacion, descripcionMovil, diaNsys, nombreModeloNsys, SIN_SKU_MAESTRO, textoEstadoMovil, textoPoner } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { MarcaTaller } from '@/shared/ui/MarcaTaller'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { textoRevision } from './rastro'

type Props = { ficha: Ficha; eventos: number | null; onVerRastro: () => void; onCorregir?: () => void }

const BOTON = 'inline-flex cursor-pointer items-center gap-1.5 rounded-3xl border border-azul-noche bg-superficie px-3.5 py-1.5 text-[12px] font-bold text-azul-noche hover:bg-seleccion-suave disabled:cursor-default disabled:opacity-50'

/** Ficha del móvil según NSYS, encima de la vista de trabajos de hoy (0.9.17, spec §9.3), con el botón del rastro.
 *  Desde la 0.9.18, junto a la ubicación, cuándo se revisó o desde cuándo espera. Desde la 0.9.21 (spec «SKU del taller»
 *  §2.4), color, grado y SKU son los que valen, con la marca «taller» y lo de NSYS al lado; «Por pasar a NSYS: …» mientras
 *  NSYS no lo tenga; y, si quien la pinta lo ofrece (`onCorregir`), «Corregir color, grado o batería…». */
export function FichaMovil({ ficha, eventos, onVerRastro, onCorregir }: Props) {
  const venta = ficha.fechaVenta ? diaNsys(ficha.fechaVenta) : null
  const revision = textoRevision(ficha)
  const bateria = ficha.bateriaNueva && ' · batería nueva'
  return (
    <section aria-label="Ficha de NSYS" className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg bg-superficie px-4 py-3 text-[12.5px] text-azul-medio">
      <span className="font-mono text-[17px] font-extrabold text-azul-noche">{ficha.imeiSn}</span>
      <span>
        {descripcionMovil(nombreModeloNsys(ficha.modelo, ficha.modeloMaestro), ficha.capacidad)}
        {ficha.color && <>{' '}<MarcaTaller enLinea nsys={ficha.colorNsys}>{ficha.color}</MarcaTaller></>}
      </span>
      {/* Con el grado del taller no se dice «(antes …)»: ese grado anterior es el de NSYS (Ajuste 11 del plan). */}
      <span>Grado {ficha.gradoNsys == null
        ? <><b className="text-azul-noche">{ficha.grado || '—'}</b>{ficha.gradoAnterior && ficha.gradoAnterior !== ficha.grado && ` (antes ${ficha.gradoAnterior})`}{bateria}</>
        : <MarcaTaller enLinea nsys={ficha.gradoNsys}><b className="text-azul-noche">{ficha.grado || '—'}</b>{bateria}</MarcaTaller>}
      </span>
      {(ficha.sku || ficha.skuNsys) && (
        <span>SKU <MarcaTaller enLinea nsys={ficha.skuNsys}>
          {ficha.sku ? <b className="font-mono text-azul-noche">{ficha.sku}</b> : <i className="text-fila-solicitud-brd">{SIN_SKU_MAESTRO}</i>}
        </MarcaTaller></span>
      )}
      {ficha.porPasar && <span className="font-semibold text-taller-text">{`Por pasar a NSYS: ${textoPoner(ficha.ponerProducto, ficha.ponerGrado)}`}</span>}
      {ficha.ubicacion && <span className={cn(CLASES_PILDORA, clasesUbicacion(ficha.ubicacion))}>{ficha.ubicacion}</span>}
      {revision && <span className="font-semibold text-azul-medio">{revision}</span>}
      {ficha.estado === 'VENDIDO'
        ? <span className={cn(CLASES_PILDORA, 'bg-azul-noche text-superficie')}>{venta ? `Vendido el ${venta}` : 'Vendido'}</span>
        : <span className={ficha.estado === 'DE_PEDIDO' ? 'font-bold text-fila-urgente-brd' : 'text-azul-gris'}>{textoEstadoMovil(ficha.estado)}</span>}
      <span>Lote <b className="text-azul-noche">{ficha.lote}</b></span>
      {ficha.dias != null && <span>En stock <b className="text-azul-noche">{ficha.dias} {ficha.dias === 1 ? 'día' : 'días'}</b>{ficha.entradas > 1 && ` (${ficha.entradas} entradas)`}</span>}
      <span className="ml-auto flex flex-wrap gap-2">
        {onCorregir && <button type="button" onClick={onCorregir} className={BOTON}>Corregir color, grado o batería…</button>}
        <button type="button" onClick={onVerRastro} disabled={eventos == null} className={BOTON}>
          {eventos == null ? 'Ver rastro' : `Ver rastro (${eventos})`}
        </button>
      </span>
    </section>
  )
}
