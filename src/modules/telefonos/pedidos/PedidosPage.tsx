import { useMemo } from 'react'
import { hoyMadrid } from '@/shared/lib/fechas'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useFilas } from '../api'
import { PildoraFuentes } from './PildoraFuentes'
import { TablaFilas } from './TablaFilas'
import { haceUnMes, recuento } from './filas'

/** «Pedidos» como la hoja (spec «Pedidos como la hoja» §3): una fila por móvil pedido, que crea el ERP desde ShippyPro; lo único
 *  que se teclea es el IMEI. De momento pide un periodo fijo (el último mes hasta hoy, sin búsqueda); el filtro de fechas, el
 *  buscador y los filtros por columna se añadirán sobre `desde`, `hasta` y `buscar`. */
export function PedidosPage() {
  const hasta = hoyMadrid()
  const desde = useMemo(() => haceUnMes(hasta), [hasta])
  const lista = useFilas({ desde, hasta, buscar: '' })
  const filas = useMemo(() => lista.data?.filas ?? [], [lista.data])
  const { total, sinEnviar, sinImei } = recuento(filas)
  const sinCargar = lista.isError && !lista.data
  return (
    <div className="flex h-[calc(100vh-var(--spacing-navbar))] flex-col p-10 max-[1500px]:p-5">
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        {lista.data && <PildoraContador texto={`${total} filas · ${sinEnviar} sin enviar · ${sinImei} sin IMEI`} />}
        <PildoraFuentes />
      </div>
      {lista.isPending && <p className="p-4 text-[12px] text-azul-gris">Cargando…</p>}
      {sinCargar && <p className="p-4 text-[12px] text-azul-gris">No se pudieron cargar los pedidos.</p>}
      {lista.data && filas.length === 0 && <p className="p-4 text-[12px] text-azul-gris">No hay pedidos en este periodo.</p>}
      {filas.length > 0 && <TablaFilas filas={filas} />}
      {filas.length > 0 && (
        <p className="mt-2 shrink-0 text-[11.5px] text-azul-gris">
          Las filas las crea el ERP desde ShippyPro. Solo se teclea el IMEI: en ámbar, vale con aviso; en naranja, no cuadra (mira el motivo); en gris, ya enviado.
        </p>
      )}
    </div>
  )
}
