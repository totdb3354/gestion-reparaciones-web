import { useEffect, useMemo, useState } from 'react'
import { hoyMadrid } from '@/shared/lib/fechas'
import { useStore } from '@/shared/lib/store'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useFilas } from '../api'
import { estadoPedidos } from './estado'
import { FiltroColumna, FiltroEnviado, FiltroSinImei } from './FiltroColumna'
import { FiltroFechas } from './FiltroFechas'
import { PildoraFuentes } from './PildoraFuentes'
import { TablaFilas } from './TablaFilas'
import { filtrarColumnas, rangoDe, rangoValido, recuento, valores, vigente } from './filas'

/** Lo que se espera tras la última tecla antes de pedir la búsqueda, y los caracteres mínimos para que cuente como búsqueda. */
const ESPERA_BUSCAR_MS = 300
const MIN_BUSCAR = 2

/** «Pedidos» como la hoja (spec «Pedidos como la hoja» §3): una fila por móvil pedido, que crea el ERP desde ShippyPro; lo único
 *  que se teclea es el IMEI. Arriba, el filtro de fechas (por defecto, el último mes), el buscador (mira en todo el historial) y,
 *  en las cabeceras, los filtros por columna, que se aplican en el cliente sobre lo recibido. Todo se guarda en `estadoPedidos`. */
export function PedidosPage() {
  const [e, setE] = useStore(estadoPedidos)
  const [aplicado, setAplicado] = useState(e.buscar)
  useEffect(() => {
    const t = setTimeout(() => setAplicado(e.buscar), ESPERA_BUSCAR_MS)
    return () => clearTimeout(t)
  }, [e.buscar])
  const buscando = aplicado.trim().length >= MIN_BUSCAR

  const hoy = hoyMadrid()
  // `hoy` está en las dependencias para que, pasada la medianoche, el periodo se recalcule.
  const { desde, hasta } = useMemo(() => rangoDe(e.periodo, new Date(), e.rango), [e.periodo, e.rango, hoy]) // eslint-disable-line react-hooks/exhaustive-deps
  // Con una búsqueda en marcha el periodo no cuenta: se piden siempre las mismas fechas, así cambiarlo no pide otra vez.
  const todo = useMemo(() => rangoDe('todo', new Date()), [hoy]) // eslint-disable-line react-hooks/exhaustive-deps
  const lista = useFilas(buscando ? { ...todo, buscar: aplicado.trim() } : { desde, hasta })
  const filas = useMemo(() => lista.data?.filas ?? [], [lista.data])
  const plataformas = useMemo(() => valores(filas, 'plataforma'), [filas])
  const skus = useMemo(() => valores(filas, 'sku'), [filas])
  const filtros = useMemo(
    () => ({ plataformas: vigente(e.plataformas, plataformas), skus: vigente(e.skus, skus), soloSinImei: e.soloSinImei, enviado: e.enviado }),
    [e.plataformas, e.skus, e.soloSinImei, e.enviado, plataformas, skus],
  )
  const filtrando = filtros.plataformas.size > 0 || filtros.skus.size > 0 || filtros.soloSinImei || filtros.enviado.size > 0
  const vistas = useMemo(() => filtrarColumnas(filas, filtros), [filas, filtros])
  const { total, pendientes, sinImei } = recuento(filas)
  const sinCargar = lista.isError && !lista.data
  const quitarFiltros = () => setE((s) => ({ ...s, plataformas: new Set(), skus: new Set(), soloSinImei: false, enviado: new Set() }))

  return (
    <div className="flex h-[calc(100vh-var(--spacing-navbar))] flex-col p-10 max-[1500px]:p-5">
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        {lista.data && (
          <PildoraContador texto={`${total} filas · ${pendientes} pendientes · ${sinImei} sin IMEI${filtrando ? ` · ${vistas.length} a la vista` : ''}`} />
        )}
        <PildoraFuentes />
        {filtrando && (
          <button type="button" onClick={quitarFiltros}
            className="h-8 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold text-azul-medio">Quitar filtros</button>
        )}
      </div>
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <FiltroFechas periodo={e.periodo} rango={e.rango} atenuado={buscando}
          // Al elegir «Rango…» salen las fechas guardadas, o, si no hay, las del periodo que se aplicaba.
          onPeriodo={(p) => setE((s) => ({ ...s, periodo: p, rango: p === 'rango' && !rangoValido(s.rango) ? rangoDe(s.periodo, new Date(), s.rango) : s.rango }))}
          onRango={(rango) => setE((s) => ({ ...s, rango }))} />
        <input aria-label="Buscar en todo el historial" placeholder="Buscar en todo el historial…" autoComplete="off" value={e.buscar}
          onChange={(ev) => setE((s) => ({ ...s, buscar: ev.target.value }))}
          className="h-8 w-72 rounded-md border border-borde-input bg-superficie px-2 text-[12px]" />
        {buscando && <p className="text-[12px] text-azul-gris">La búsqueda mira en todo el historial; el periodo no se aplica.</p>}
      </div>
      {buscando && e.buscar.trim().length >= MIN_BUSCAR && lista.data?.hayMas && (
        <p role="status" className="mb-2 shrink-0 text-[12px] font-bold text-form-agotado-text">
          Hay más de 500 resultados: se enseñan los 500 más recientes. Afina la búsqueda.
        </p>
      )}
      {lista.isPlaceholderData && <p role="status" className="mb-2 shrink-0 text-[12px] text-azul-gris">Buscando…</p>}
      {lista.isPending && <p className="p-4 text-[12px] text-azul-gris">Cargando…</p>}
      {sinCargar && <p className="p-4 text-[12px] text-azul-gris">No se pudieron cargar los pedidos.</p>}
      {lista.data && filas.length === 0 && (
        <p className="p-4 text-[12px] text-azul-gris">{buscando ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos en este periodo.'}</p>
      )}
      {filas.length > 0 && (
        <TablaFilas filas={vistas} recibidas={filas.length} vacio="Ningún pedido cumple los filtros de columna. Pulsa «Quitar filtros» para verlos todos." filtros={{
          Plataforma: <FiltroColumna columna="Plataforma" valores={plataformas} seleccion={filtros.plataformas} onChange={(plataformas) => setE((s) => ({ ...s, plataformas }))} />,
          SKU: <FiltroColumna columna="SKU" valores={skus} seleccion={filtros.skus} onChange={(skus) => setE((s) => ({ ...s, skus }))} />,
          Enviado: <FiltroEnviado seleccion={filtros.enviado} onChange={(enviado) => setE((s) => ({ ...s, enviado }))} />,
          IMEI: <FiltroSinImei activo={filtros.soloSinImei} onChange={(soloSinImei) => setE((s) => ({ ...s, soloSinImei }))} />,
        }} />
      )}
      {filas.length > 0 && (
        <p className="mt-2 shrink-0 text-[11.5px] text-azul-gris">
          Las filas las crea el ERP desde ShippyPro. Solo se teclea el IMEI: en ámbar, vale con aviso; en naranja, no cuadra (mira el motivo); en gris, ya enviado (o del histórico); en azul pálido, «Ya no está pendiente». El IMEI se puede poner, cambiar o quitar también en las enviadas; el histórico no se edita.
        </p>
      )}
    </div>
  )
}
