import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/shared/lib/utils'
import { DataTable } from '@/shared/ui/DataTable'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useStockTelefonos } from '../api'
import { BuscadorImei } from './BuscadorImei'
import { columnasMoviles } from './columnas'
import { FiltrosMoviles } from './FiltrosMoviles'
import { ListaModelos } from './ListaModelos'
import { agrupar, cuentaComoStock, FILTROS_VACIOS, ordenarTabla, pasa, type Filtros } from './modelo'
import { BandaNsys, PildoraNsys } from './PildoraNsys'

/** «Stock de teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.2; opción C del prototipo aprobado):
 *  modelo + capacidad a la izquierda, sus móviles a la derecha con filtros de un clic. Solo lectura: los datos vienen del
 *  espejo de NSYS. Un móvil abre su detalle de IMEIs, con la ficha de NSYS y el rastro. */
export function StockTelefonosPage() {
  const navigate = useNavigate()
  const { data: moviles = [] } = useStockTelefonos()
  const [verNoCuenta, setVerNoCuenta] = useState(false)
  const [textoModelo, setTextoModelo] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const grupos = useMemo(() => agrupar(moviles, verNoCuenta), [moviles, verNoCuenta])
  const visibles = grupos.filter((g) => g.clave.toLowerCase().includes(textoModelo.trim().toLowerCase()))
  const grupo = grupos.find((g) => g.clave === elegido) ?? grupos[0] ?? null
  const filas = useMemo(() => (grupo ? ordenarTabla(grupo.moviles.filter((m) => pasa(m, filtros))) : []), [grupo, filtros])
  const enStock = moviles.filter(cuentaComoStock).length
  const abrir = useCallback((imeiSn: string) => navigate(`/reparaciones/imeis/${encodeURIComponent(imeiSn)}`), [navigate])
  const columnas = useMemo(() => columnasMoviles(abrir), [abrir])
  return (
    <div className="p-10 max-[1500px]:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Stock de teléfonos</h1>
        <PildoraContador texto={`${enStock} ${enStock === 1 ? 'móvil' : 'móviles'} en stock`} />
        <PildoraNsys />
      </div>
      <BandaNsys />
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <BuscadorImei onElegir={abrir} />
        <button type="button" role="switch" aria-checked={verNoCuenta} onClick={() => setVerNoCuenta((v) => !v)}
          className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-azul-medio">
          <span className={cn('relative h-[18px] w-[34px] rounded-full transition-colors', verNoCuenta ? 'bg-verde-ok' : 'bg-pill-borde')}>
            <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-superficie transition-[left]', verNoCuenta ? 'left-[18px]' : 'left-[2px]')} />
          </span>
          Ver también lo que no cuenta como stock
        </button>
      </div>
      <div className="grid grid-cols-[280px_1fr] items-start gap-3 max-[1500px]:grid-cols-[230px_1fr]">
        <ListaModelos grupos={visibles} elegido={grupo?.clave ?? null} texto={textoModelo} verNoCuenta={verNoCuenta} onTexto={setTextoModelo}
          onElegir={(clave) => { setElegido(clave); setFiltros(FILTROS_VACIOS) }} />
        <section aria-label="Móviles del modelo" className="min-w-0 rounded-md bg-superficie p-3">
          {grupo && (
            <>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-base font-bold text-azul-noche">{grupo.clave}</h2>
                <PildoraContador texto={`${filas.length} de ${grupo.moviles.length}`} />
              </div>
              <FiltrosMoviles moviles={grupo.moviles} filtros={filtros} onCambiar={setFiltros} />
              <DataTable columns={columnas} data={filas} vacio="Ningún móvil con estos filtros" ajuste="fluido" alturaMax="calc(100vh - 360px)"
                getRowId={(m) => `${m.imeiSn}|${m.lote}`} onAbrir={(m) => abrir(m.imeiSn)}
                filaClase={(m) => cn('border-l-4', m.estado === 'DE_PEDIDO' ? 'border-l-fila-urgente-brd' : 'border-l-transparent',
                  m.estado === 'NO_CUENTA' && 'text-texto-suave')} />
              <p className="mt-2 text-[11.5px] text-azul-gris">El IMEI abre el detalle del móvil. El borde rojo marca los que están de pedido.</p>
            </>
          )}
          {!grupo && <p className="p-4 text-[12px] text-azul-gris">No hay móviles en stock.</p>}
        </section>
      </div>
    </div>
  )
}
