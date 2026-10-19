import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { DataTable } from '@/shared/ui/DataTable'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useStockTelefonos } from '../api'
import { filtrarModelos, sugerenciasSku, type Destino } from './buscador'
import { BuscadorImei } from './BuscadorImei'
import { BuscadorModelo } from './BuscadorModelo'
import { columnasMoviles } from './columnas'
import { claveFiltros, estadoStockTelefonos } from './estado'
import { FiltrosMoviles } from './FiltrosMoviles'
import { ListaModelos } from './ListaModelos'
import {
  capacidadDe, cuentaComoStock, FILTROS_VACIOS, modeloDe, modelosLista, ordenarTabla, pasa, pasaSku, pestanasCapacidad, preparar,
  type Filtros, type FiltroSku,
} from './modelo'
import { PastillaSku } from './PastillaSku'
import { PestanasCapacidad } from './PestanasCapacidad'
import { BandaNsys, PildoraNsys } from './PildoraNsys'

const PIE = '"Quién lo tiene" sale de las asignaciones abiertas del ERP, al momento; la caja, de la última exportación de NSYS. Pasa el ratón por encima para ver desde cuándo. El IMEI abre el detalle del móvil.'

/** «Stock de teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.2; 0.9.18, spec «Columna compacta, SKU, Quién lo
 *  tiene y Revisado» §4): una fila por modelo a la izquierda, con el buscador de modelo o SKU, y a la derecha el modelo con
 *  sus pestañas de capacidad, el filtro de SKU, sus filtros y sus móviles. Solo lectura: los datos vienen del espejo de NSYS
 *  y de las asignaciones abiertas del ERP. Un móvil abre su detalle de IMEIs, con la ficha de NSYS y el rastro. */
export function StockTelefonosPage() {
  const navigate = useNavigate()
  const stock = useStockTelefonos()
  // «Quién lo tiene» se calcula a la hora de la carga (dataUpdatedAt): el sondeo de 60 s lo vuelve a calcular.
  const moviles = useMemo(() => preparar(stock.data ?? [], stock.dataUpdatedAt), [stock.data, stock.dataUpdatedAt])
  const sinCargar = stock.isError && !stock.data
  const [{ verNoCuenta, textoModelo, elegido, capacidad: capacidadElegida, filtrosDe }, setEstado] = useStore(estadoStockTelefonos)
  const lista = useMemo(() => modelosLista(moviles, verNoCuenta), [moviles, verNoCuenta])
  const sugerencias = useMemo(() => sugerenciasSku(moviles, textoModelo), [moviles, textoModelo])
  const visibles = filtrarModelos(lista, textoModelo, sugerencias)
  // El modelo abierto no depende de lo escrito en el buscador: solo cambia al elegir otro (spec §4.2).
  const modelo = lista.find((g) => g.clave === elegido) ?? lista[0] ?? null
  const todos = useMemo(() => (modelo ? moviles.filter((m) => modeloDe(m) === modelo.clave) : []), [moviles, modelo])
  const pestanas = pestanasCapacidad(todos, verNoCuenta)
  const capacidad = modelo !== null && modelo.clave === elegido && pestanas.some((p) => p.capacidad !== null && p.capacidad === capacidadElegida && p.activa)
    ? capacidadElegida : null
  const clave = modelo ? claveFiltros(modelo.clave, capacidad) : null
  const { filtros, sku } = filtrosDe.clave === clave ? filtrosDe : { filtros: FILTROS_VACIOS, sku: null }
  const cambiarFiltros = (f: Filtros, s: FiltroSku | null) => setEstado((e) => ({ ...e, filtrosDe: { clave, filtros: f, sku: s } }))
  const abrirModelo = (d: Destino) => {
    // Volver a pulsar lo que ya está abierto no borra sus filtros; elegir un SKU sí los cambia.
    if (d.sku === null && d.modelo === modelo?.clave && d.capacidad === capacidad) return
    setEstado((e) => ({ ...e, elegido: d.modelo, capacidad: d.capacidad, filtrosDe: { clave: claveFiltros(d.modelo, d.capacidad), filtros: FILTROS_VACIOS, sku: d.sku } }))
  }
  const delModelo = useMemo(
    () => (modelo?.moviles ?? []).filter((m) => (capacidad === null || capacidadDe(m) === capacidad) && pasaSku(m, sku)),
    [modelo, capacidad, sku],
  )
  const filas = useMemo(() => ordenarTabla(delModelo.filter((m) => pasa(m, filtros))), [delModelo, filtros])
  const enStock = moviles.filter(cuentaComoStock).length
  const abrir = useCallback((imeiSn: string) => navigate(`/reparaciones/imeis/${encodeURIComponent(imeiSn)}`, { state: { desde: '/telefonos/stock' } }), [navigate])
  const columnas = useMemo(() => columnasMoviles(abrir, { conCapacidad: capacidad === null, sku }), [abrir, capacidad, sku])
  return (
    <div className="p-10 max-[1500px]:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Stock de teléfonos</h1>
        {!sinCargar && <PildoraContador texto={`${enStock} ${enStock === 1 ? 'móvil' : 'móviles'} en stock`} />}
        <PildoraNsys />
      </div>
      <BandaNsys />
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <BuscadorImei onElegir={abrir} />
        <button type="button" role="switch" aria-checked={verNoCuenta} onClick={() => setEstado((e) => ({ ...e, verNoCuenta: !e.verNoCuenta }))}
          className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-azul-medio">
          <span className={cn('relative h-[18px] w-[34px] rounded-full transition-colors', verNoCuenta ? 'bg-verde-ok' : 'bg-pill-borde')}>
            <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-superficie transition-[left]', verNoCuenta ? 'left-[18px]' : 'left-[2px]')} />
          </span>
          Ver también lo que no cuenta como stock
        </button>
      </div>
      <div className="grid grid-cols-[270px_1fr] items-start gap-3 max-[1500px]:grid-cols-[230px_1fr]">
        <ListaModelos modelos={visibles} elegido={modelo?.clave ?? null} capacidad={capacidad}
          onAbrir={(m, c) => abrirModelo({ modelo: m, capacidad: c, sku: null })}
          buscador={<BuscadorModelo lista={lista} moviles={moviles} texto={textoModelo} sugerencias={sugerencias}
            onTexto={(t) => setEstado((e) => ({ ...e, textoModelo: t }))} onAbrir={abrirModelo} />} />
        <section aria-label="Móviles del modelo" className="min-w-0 rounded-md bg-superficie p-3">
          {modelo && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-bold text-azul-noche">{modelo.clave}</h2>
                <PestanasCapacidad pestanas={pestanas} elegida={capacidad} onElegir={(c) => abrirModelo({ modelo: modelo.clave, capacidad: c, sku: null })} />
                <PildoraContador texto={`${filas.length} ${filas.length === 1 ? 'móvil' : 'móviles'}`} />
                {sku && <PastillaSku sku={sku} onQuitar={() => cambiarFiltros(filtros, null)} />}
              </div>
              <FiltrosMoviles moviles={delModelo} filtros={filtros} onCambiar={(f) => cambiarFiltros(f, sku)} />
              <DataTable columns={columnas} data={filas} vacio="Ningún móvil con estos filtros" ajuste="fluido" alturaMax="calc(100vh - 430px)"
                getRowId={(m) => `${m.imeiSn}|${m.lote}`} onAbrir={(m) => abrir(m.imeiSn)}
                filaClase={(m) => cn('border-l-4', 'border-l-transparent', !cuentaComoStock(m) && 'text-texto-suave')} />
              <p className="mt-2 text-[11.5px] text-azul-gris">{PIE}</p>
            </>
          )}
          {!modelo && sinCargar && <p className="p-4 text-[12px] text-azul-gris">No se pudo cargar el stock de teléfonos.</p>}
          {!modelo && !sinCargar && stock.data && <p className="p-4 text-[12px] text-azul-gris">No hay móviles en stock.</p>}
        </section>
      </div>
    </div>
  )
}
