import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { DataTable } from '@/shared/ui/DataTable'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useStockTelefonos } from '../api'
import { BuscadorImei } from './BuscadorImei'
import { columnasMoviles } from './columnas'
import { claveFiltros, estadoStockTelefonos } from './estado'
import { FiltrosMoviles } from './FiltrosMoviles'
import { ListaModelos } from './ListaModelos'
import { capacidadDe, cuentaComoStock, FILTROS_VACIOS, modeloDe, modelosLista, ordenarTabla, pasa, pestanasCapacidad, preparar, type Filtros } from './modelo'
import { PestanasCapacidad } from './PestanasCapacidad'
import { BandaNsys, PildoraNsys } from './PildoraNsys'

const PIE = '"Quién lo tiene" sale de las asignaciones abiertas del ERP, al momento; la caja, de la última exportación de NSYS. Pasa el ratón por encima para ver desde cuándo. El IMEI abre el detalle del móvil.'

/** «Stock de teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.2; 0.9.18, spec «Columna compacta, SKU, Quién lo
 *  tiene y Revisado» §4): una fila por modelo a la izquierda y, a la derecha, el modelo con sus pestañas de capacidad, sus
 *  filtros y sus móviles. Solo lectura: los datos vienen del espejo de NSYS y de las asignaciones abiertas del ERP. Un
 *  móvil abre su detalle de IMEIs, con la ficha de NSYS y el rastro. */
export function StockTelefonosPage() {
  const navigate = useNavigate()
  const stock = useStockTelefonos()
  // «Quién lo tiene» se calcula a la hora de la carga (dataUpdatedAt): el sondeo de 60 s lo vuelve a calcular.
  const moviles = useMemo(() => preparar(stock.data ?? [], stock.dataUpdatedAt), [stock.data, stock.dataUpdatedAt])
  const sinCargar = stock.isError && !stock.data
  const [{ verNoCuenta, textoModelo, elegido, capacidad: capacidadElegida, filtrosDe }, setEstado] = useStore(estadoStockTelefonos)
  const lista = useMemo(() => modelosLista(moviles, verNoCuenta), [moviles, verNoCuenta])
  const texto = textoModelo.trim().toLowerCase()
  const visibles = lista.filter((g) => g.clave.toLowerCase().includes(texto))
  // El modelo abierto no depende de lo escrito en el buscador: solo cambia al elegir otro (spec §4.2).
  const modelo = lista.find((g) => g.clave === elegido) ?? lista[0] ?? null
  const todos = useMemo(() => (modelo ? moviles.filter((m) => modeloDe(m) === modelo.clave) : []), [moviles, modelo])
  const pestanas = pestanasCapacidad(todos, verNoCuenta)
  const capacidad = modelo !== null && modelo.clave === elegido && pestanas.some((p) => p.capacidad !== null && p.capacidad === capacidadElegida && p.activa)
    ? capacidadElegida : null
  const clave = modelo ? claveFiltros(modelo.clave, capacidad) : null
  const filtros = filtrosDe.clave === clave ? filtrosDe.filtros : FILTROS_VACIOS
  const setFiltros = (f: Filtros) => setEstado((e) => ({ ...e, filtrosDe: { clave, filtros: f } }))
  const abrirModelo = (m: string, c: string | null) => {
    // Volver a pulsar lo que ya está abierto no borra sus filtros.
    if (m === modelo?.clave && c === capacidad) return
    setEstado((e) => ({ ...e, elegido: m, capacidad: c, filtrosDe: { clave: claveFiltros(m, c), filtros: FILTROS_VACIOS } }))
  }
  const delModelo = useMemo(() => (modelo?.moviles ?? []).filter((m) => capacidad === null || capacidadDe(m) === capacidad), [modelo, capacidad])
  const filas = useMemo(() => ordenarTabla(delModelo.filter((m) => pasa(m, filtros))), [delModelo, filtros])
  const enStock = moviles.filter(cuentaComoStock).length
  const abrir = useCallback((imeiSn: string) => navigate(`/reparaciones/imeis/${encodeURIComponent(imeiSn)}`, { state: { desde: '/telefonos/stock' } }), [navigate])
  const columnas = useMemo(() => columnasMoviles(abrir, { conCapacidad: capacidad === null }), [abrir, capacidad])
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
        <ListaModelos modelos={visibles} elegido={modelo?.clave ?? null} capacidad={capacidad} onAbrir={abrirModelo}
          buscador={(
            <input aria-label="Buscar modelo o SKU" placeholder="Buscar modelo o SKU…" value={textoModelo} autoComplete="off"
              onChange={(e) => setEstado((s) => ({ ...s, textoModelo: e.target.value }))}
              className="h-8 w-full rounded-md border border-borde-input px-2.5 text-[12.5px]" />
          )} />
        <section aria-label="Móviles del modelo" className="min-w-0 rounded-md bg-superficie p-3">
          {modelo && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-bold text-azul-noche">{modelo.clave}</h2>
                <PestanasCapacidad pestanas={pestanas} elegida={capacidad} onElegir={(c) => abrirModelo(modelo.clave, c)} />
                <PildoraContador texto={`${filas.length} ${filas.length === 1 ? 'móvil' : 'móviles'}`} />
              </div>
              <FiltrosMoviles moviles={delModelo} filtros={filtros} onCambiar={setFiltros} />
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
