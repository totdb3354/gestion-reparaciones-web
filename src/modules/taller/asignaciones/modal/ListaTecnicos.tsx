import { Checkbox } from '@/shared/ui/checkbox'
import { TIPO_TRABAJO } from '@/shared/lib/tipoTrabajo'
import { cn } from '@/shared/lib/utils'
import type { FilaCarga, Tecnico } from '@/shared/api/client'
import { CLASE_TEXTO_NIVEL, formatearPct, nivelCarga, pctTotal } from '../carga'

type Props = {
  tecnicos: Tecnico[]
  carga: FilaCarga[]
  marcados: number[]
  ocupados: Set<number>
  marcarGlass: boolean
  onMarcar: (idTec: number, marcado: boolean) => void
}

/** "Técnicos a asignar": nombre ● % de Pedidos (solo Pedidos, decisión 2026-07-10), pastilla "glass" en la cola Glass,
 *  y los que ya tienen el IMEI en esa categoría deshabilitados (el bloqueo del duplicado se hace al seleccionar).
 *  Orden de pintado: el de `tecnicos` tal cual llega, sin ordenar ni filtrar (ni por `marcarGlass` ni por carga). */
export function ListaTecnicos({ tecnicos, carga, marcados, ocupados, marcarGlass, onMarcar }: Props) {
  const nOcupados = tecnicos.filter((t) => ocupados.has(t.idTec)).length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-azul-gris">Técnicos a asignar</span>
        {nOcupados >= 1 && (
          <span className="rounded-full bg-pill-aviso-bg px-[9px] py-0.5 text-[10.5px] font-bold text-pill-aviso-text">
            {nOcupados} {nOcupados === 1 ? 'asignado' : 'asignados'}
          </span>
        )}
      </div>
      <div className="max-h-[150px] overflow-y-auto rounded border border-borde-input bg-white p-2">
        {tecnicos.map((t) => {
          const fila = carga.find((f) => f.idTec === t.idTec)
          const total = fila ? pctTotal(fila) : 0
          const ocupado = ocupados.has(t.idTec)
          const id = `tec-${t.idTec}`
          return (
            <div key={t.idTec} className="flex items-center gap-2 py-[3px]">
              <Checkbox id={id} checked={marcados.includes(t.idTec) && !ocupado} disabled={ocupado}
                onCheckedChange={(v) => onMarcar(t.idTec, v === true)} />
              <label htmlFor={id} className={cn('flex items-center gap-1 text-[12px]', ocupado && 'opacity-50')}>
                <span className="text-azul-medio">{t.nombre}</span>
                <span className="text-[9px] text-carga-pedidos">●</span>
                <span className={cn('font-bold', CLASE_TEXTO_NIVEL[nivelCarga(total)])}>{formatearPct(total)}</span>
                {marcarGlass && t.esGlass && (
                  <span className={cn('rounded-md px-1.5 text-[9.5px] font-bold', TIPO_TRABAJO.GLASS.clases)}>glass</span>
                )}
              </label>
            </div>
          )
        })}
      </div>
      <span className="text-[10.5px] italic text-azul-gris">↳ Se mantienen del IMEI anterior; cámbialos solo si hace falta.</span>
    </div>
  )
}
