import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { DataTable } from '@/shared/ui/DataTable'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useStockTelefonos } from '../api'
import { BuscadorImei } from './BuscadorImei'
import { columnasMoviles } from './columnas'
import { estadoStockTelefonos } from './estado'
import { FiltrosMoviles } from './FiltrosMoviles'
import { ListaModelos } from './ListaModelos'
import { agrupar, cuentaComoStock, FILTROS_VACIOS, ordenarTabla, pasa, preparar, type Filtros } from './modelo'
import { BandaNsys, PildoraNsys } from './PildoraNsys'

const PIE = '"Quién lo tiene" sale de las asignaciones abiertas del ERP, al momento; la caja, de la última exportación de NSYS. Pasa el ratón por encima para ver desde cuándo. El IMEI abre el detalle del móvil.'

/** «Stock de teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.2; opción C del prototipo aprobado):
 *  modelo + capacidad a la izquierda, sus móviles a la derecha con filtros de un clic. Solo lectura: los datos vienen del
 *  espejo de NSYS. Un móvil abre su detalle de IMEIs, con la ficha de NSYS y el rastro. */
export function StockTelefonosPage() {
  const navigate = useNavigate()
  const stock = useStockTelefonos()
  // «Quién lo tiene» se calcula a la hora de la carga (dataUpdatedAt): el sondeo de 60 s lo vuelve a calcular.
  const moviles = useMemo(() => preparar(stock.data ?? [], stock.dataUpdatedAt), [stock.data, stock.dataUpdatedAt])
  const sinCargar = stock.isError && !stock.data
  const [{ verNoCuenta, textoModelo, elegido, filtrosDe }, setEstado] = useStore(estadoStockTelefonos)
  const grupos = useMemo(() => agrupar(moviles, verNoCuenta), [moviles, verNoCuenta])
  const visibles = grupos.filter((g) => g.clave.toLowerCase().includes(textoModelo.trim().toLowerCase()))
  const grupo = visibles.find((g) => g.clave === elegido) ?? visibles[0] ?? null
  const filtros = filtrosDe.clave === (grupo?.clave ?? null) ? filtrosDe.filtros : FILTROS_VACIOS
  const setFiltros = (f: Filtros) => setEstado((e) => ({ ...e, filtrosDe: { clave: grupo?.clave ?? null, filtros: f } }))
  const filas = useMemo(() => (grupo ? ordenarTabla(grupo.moviles.filter((m) => pasa(m, filtros))) : []), [grupo, filtros])
  const enStock = moviles.filter(cuentaComoStock).length
  const abrir = useCallback((imeiSn: string) => navigate(`/reparaciones/imeis/${encodeURIComponent(imeiSn)}`, { state: { desde: '/telefonos/stock' } }), [navigate])
  const columnas = useMemo(() => columnasMoviles(abrir), [abrir])
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
      <div className="grid grid-cols-[280px_1fr] items-start gap-3 max-[1500px]:grid-cols-[230px_1fr]">
        <ListaModelos grupos={visibles} elegido={grupo?.clave ?? null} texto={textoModelo} verNoCuenta={verNoCuenta} onTexto={(t) => setEstado((e) => ({ ...e, textoModelo: t }))}
          onElegir={(c) => setEstado((e) => ({ ...e, elegido: c }))} />
        <section aria-label="Móviles del modelo" className="min-w-0 rounded-md bg-superficie p-3">
          {grupo && (
            <>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-base font-bold text-azul-noche">{grupo.clave}</h2>
                <PildoraContador texto={`${filas.length} de ${grupo.moviles.length}`} />
              </div>
              <FiltrosMoviles moviles={grupo.moviles} filtros={filtros} onCambiar={setFiltros} />
              <DataTable columns={columnas} data={filas} vacio="Ningún móvil con estos filtros" ajuste="fluido" alturaMax="calc(100vh - 390px)"
                getRowId={(m) => `${m.imeiSn}|${m.lote}`} onAbrir={(m) => abrir(m.imeiSn)}
                filaClase={(m) => cn('border-l-4', 'border-l-transparent', !cuentaComoStock(m) && 'text-texto-suave')} />
              <p className="mt-2 text-[11.5px] text-azul-gris">{PIE}</p>
            </>
          )}
          {!grupo && sinCargar && <p className="p-4 text-[12px] text-azul-gris">No se pudo cargar el stock de teléfonos.</p>}
          {!grupo && !sinCargar && stock.data && <p className="p-4 text-[12px] text-azul-gris">No hay móviles en stock.</p>}
        </section>
      </div>
    </div>
  )
}
