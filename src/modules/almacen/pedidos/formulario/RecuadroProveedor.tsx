import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { BotonSecundario } from '@/shared/ui/Botones'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { textoLineas } from '../bloques/reglas'
import { VALOR_NUEVO, type OpcionDestino } from './destinos'

/** Desplaza la caja hasta el recuadro mientras `activo` (al añadirlo, o con el error de «Confirmar»). `block: 'nearest'`
 *  no mueve nada si ya se ve. */
const traerALaVista = (activo: boolean) => (activo ? (el: HTMLElement | null) => { el?.scrollIntoView({ block: 'nearest' }) } : undefined)

function BotonPlegar({ nombre, plegado, onPlegar }: { nombre: string; plegado: boolean; onPlegar: () => void }) {
  return (
    <button type="button" aria-expanded={!plegado} aria-label={`${plegado ? 'Desplegar' : 'Plegar'} ${nombre}`} onClick={onPlegar}
      className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-current hover:bg-nav-switch">
      {plegado ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
    </button>
  )
}

type Comunes = {
  plegado: boolean
  onPlegar: () => void
  /** Recuadro del error de «Confirmar»: borde rojo. */
  marcado: boolean
  aLaVista: boolean
  children: ReactNode
}

type Props = Comunes & {
  nombre: string
  divisa: string
  nLineas: number
  /** A qué bloque va: DestinoRecuadro. */
  destino: ReactNode
  nPrevision: number
  previsionDeshabilitada: boolean
  onPrevision: () => void
  /** La ×. Sin ella no hay botón («Añadir líneas» de un bloque: el recuadro es fijo). */
  onQuitar?: () => void
  bloqueado: boolean
  onAnadir: () => void
  /** «… también va a X (n).» */
  avisos: string[]
}

/** Recuadro de un proveedor en «Nuevo pedido» (0.9.9, spec 2026-10-13 varios proveedores §2): es un bloque. Cabecera con
 *  plegar, el proveedor, sus líneas y divisa, el destino, «Añadir previsión (n)» y la ×; cuerpo con la tabla (children),
 *  «+ Añadir línea» y los avisos «también va a». */
export function RecuadroProveedor({ nombre, divisa, nLineas, destino, nPrevision, previsionDeshabilitada, onPrevision, onQuitar, bloqueado, onAnadir, avisos, plegado, onPlegar, marcado, aLaVista, children }: Props) {
  return (
    <section aria-label={`Pedido a ${nombre}`} ref={traerALaVista(aLaVista)} data-marcado={marcado ? 'true' : undefined}
      className={cn('shrink-0 overflow-hidden rounded-[10px] border bg-superficie', marcado ? 'border-texto-error ring-1 ring-texto-error' : 'border-fila-sep')}>
      <div className={cn('flex flex-wrap items-center gap-2 bg-fila-maestro-bg px-2.5 py-1.5 text-[12px] text-azul-medio', !plegado && 'border-b border-fila-sep')}>
        <BotonPlegar nombre={nombre} plegado={plegado} onPlegar={onPlegar} />
        <span className="text-[13px] font-bold">{nombre}</span>
        <span className="text-azul-gris">· {textoLineas(nLineas)} · {divisa}</span>
        <span aria-hidden="true" className="text-texto-sub">→</span>
        {destino}
        <span className="flex-1" />
        <BotonSecundario type="button" disabled={previsionDeshabilitada || nPrevision === 0} onClick={onPrevision}>Añadir previsión ({nPrevision})</BotonSecundario>
        {onQuitar && (
          <button type="button" aria-label={`Quitar ${nombre}`} title={`Quitar ${nombre}`} onClick={onQuitar}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-texto-sub hover:bg-nav-switch hover:text-texto-error">
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      {!plegado && (
        <div className="flex flex-col gap-2 p-2.5">
          {children}
          <div className="flex flex-wrap items-center gap-2.5">
            <BotonSecundario type="button" disabled={bloqueado} onClick={onAnadir}>+ Añadir línea</BotonSecundario>
            {avisos.length > 0 && <p className="text-[11px] text-azul-gris">{avisos.join(' ')}</p>}
          </div>
        </div>
      )}
    </section>
  )
}

/** Recuadro «⚠ Por repartir» (§3): las líneas precargadas que venden varios proveedores o ninguno. Va el primero, en ámbar. */
export function RecuadroRepartir({ nLineas, plegado, onPlegar, marcado, aLaVista, children }: Comunes & { nLineas: number }) {
  return (
    <section aria-label="Por repartir" ref={traerALaVista(aLaVista)} data-marcado={marcado ? 'true' : undefined}
      className={cn('shrink-0 overflow-hidden rounded-[10px] border bg-superficie', marcado ? 'border-texto-error ring-1 ring-texto-error' : 'border-fila-pendiente-brd')}>
      <div className={cn('flex flex-wrap items-center gap-2 bg-badge-pendiente-bg px-2.5 py-1.5 text-[12px] text-badge-pendiente-text', !plegado && 'border-b border-fila-pendiente-brd')}>
        <BotonPlegar nombre="Por repartir" plegado={plegado} onPlegar={onPlegar} />
        <span className="text-[13px] font-bold">⚠ Por repartir</span>
        <span>· {textoLineas(nLineas)} · las venden varios proveedores o ninguno: elige a quién se las pides</span>
      </div>
      {!plegado && <div className="p-2.5">{children}</div>}
    </section>
  )
}

/** Primer recuadro de «Nuevo pedido» al abrir vacío (ajuste del 2026-10-13, opción A): la forma del pedido desde el
 *  principio, con el proveedor por elegir en la cabecera (`selector`) y la tabla vacía (`children`). */
export function RecuadroSinProveedor({ selector, children }: { selector: ReactNode; children: ReactNode }) {
  return (
    <section aria-label="Pedido sin proveedor" className="shrink-0 overflow-hidden rounded-[10px] border border-fila-sep bg-superficie">
      <div className="flex flex-wrap items-center gap-2 border-b border-fila-sep bg-fila-maestro-bg px-2.5 py-1.5 text-[12px] text-azul-medio">
        {selector}
        <span className="text-azul-gris opacity-60">· 0 líneas</span>
        <span className="flex-1" />
        <BotonSecundario type="button" disabled>Añadir previsión</BotonSecundario>
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  )
}

type DestinoProps = {
  nombre: string
  /** «Añadir líneas» de un bloque: destino fijo. */
  fijado?: number
  opciones?: OpcionDestino[]
  valor?: number | null
  /** Los pedidos aún no han llegado (no se sabe qué bloques hay abiertos). */
  cargando?: boolean
  onElegir?: (idBloque: number | null) => void
}

/** A qué bloque va un recuadro (spec §6.6 de bloques, ahora en la cabecera): fijado, cargando, el desplegable de sus
 *  bloques abiertos y «Bloque nuevo», o «Bloque nuevo (no tiene ninguno abierto)». */
export function DestinoRecuadro({ nombre, fijado, opciones = [], valor = null, cargando = false, onElegir }: DestinoProps) {
  if (fijado !== undefined) return <span><b>Bloque {fijado}</b> <span className="text-azul-gris">(fijado)</span></span>
  if (cargando) return <span className="text-azul-gris">Cargando bloques…</span>
  if (opciones.length === 0) return <span><b>Bloque nuevo</b> <span className="text-azul-gris">(no tiene ninguno abierto)</span></span>
  return (
    <ComboNavy valor={valor === null ? VALOR_NUEVO : String(valor)} opciones={opciones} onChange={(v) => onElegir?.(v === VALOR_NUEVO ? null : Number(v))}
      textoVacio="" ancho={300} visibles={8} aria-label={`Bloque de ${nombre}`} />
  )
}
