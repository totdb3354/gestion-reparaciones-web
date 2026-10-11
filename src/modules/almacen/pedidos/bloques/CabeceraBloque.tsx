import type { ReactNode } from 'react'
import { formatear } from '@/shared/lib/fechas'
import { formatearImporte } from '@/shared/lib/importes'
import { cn } from '@/shared/lib/utils'
import { clasesEstado } from '../BadgeEstadoPedido'
import { chipDeEstado } from '../reglas'
import { avisoBloque, resumenEstados, SIN_BLOQUE, textoLineas, totalBloque, type Bloque } from './reglas'

type Props = {
  bloque: Bloque
  /** Líneas del bloque que se ven con los filtros de ahora (para «mostrando k de n»). */
  visibles: number
  desplegado: boolean
  onAlternar: () => void
  /** Botón ⋮ (solo SUPERTECNICO). */
  menu?: ReactNode
}

function Punto() {
  return <span aria-hidden className="mx-1.5 text-texto-sub">·</span>
}

/** Cabecera de un bloque en la tabla de Pedidos (spec §6.3 y prototipo): una línea de 40 px. La flecha y el título
 *  pliegan y despliegan; resumen, total y ⚠ son del bloque entero aunque haya filtros. */
export function CabeceraBloque({ bloque, visibles, desplegado, onAlternar, menu }: Props) {
  const total = bloque.lineas.length
  const sinBloque = bloque.clave === SIN_BLOQUE
  return (
    <div className="flex h-10 items-center gap-2 overflow-hidden whitespace-nowrap pr-1.5 pl-1 text-[12px] text-azul-medio">
      <button type="button" onClick={onAlternar} aria-expanded={desplegado}
        aria-label={`${desplegado ? 'Plegar' : 'Desplegar'} ${sinBloque ? 'líneas sin bloque' : `bloque ${bloque.idBloque}`}`}
        className="w-5 shrink-0 cursor-pointer text-[11px]">
        {desplegado ? '▼' : '▶'}
      </button>
      <button type="button" onClick={onAlternar} tabIndex={-1} className="min-w-0 cursor-pointer truncate text-left">
        {sinBloque ? (
          <b>Sin bloque</b>
        ) : (
          <>
            <b>Bloque {bloque.idBloque}</b>
            <Punto />{bloque.nombreProveedor}
            <Punto />{formatear(bloque.fecha, 'dd/MM/yyyy')}
            <Punto />{textoLineas(total)}
            <Punto /><b>{formatearImporte(totalBloque(bloque), '€')}</b>
          </>
        )}
      </button>
      {avisoBloque(bloque) && <span title="Hay líneas urgentes en camino o parciales" className="shrink-0 text-[13px] text-fila-solicitud-brd">⚠</span>}
      {bloque.antiguo && (
        <span title="Reconstruido al migrar: mismo proveedor y mismo día"
          className="shrink-0 rounded-lg border border-dashed border-texto-sub px-1.5 text-[10.5px] text-texto-sub">antiguo</span>
      )}
      <span className="flex min-w-0 gap-1 overflow-hidden">
        {resumenEstados(bloque).map(({ estado, n }) => (
          <span key={estado} className={cn('rounded-[12px] px-2 py-0.5 text-[11px] font-bold', clasesEstado(estado))}>{n} {chipDeEstado(estado)}</span>
        ))}
      </span>
      {visibles < total && (
        <span className="shrink-0 rounded-[10px] bg-texto-accion px-2 py-0.5 text-[11px] text-superficie">mostrando {visibles} de {total}</span>
      )}
      {bloque.nota && <span title={bloque.nota} className="min-w-0 truncate text-azul-gris italic">📝 {bloque.nota}</span>}
      <span className="flex-1" />
      {menu}
    </div>
  )
}
