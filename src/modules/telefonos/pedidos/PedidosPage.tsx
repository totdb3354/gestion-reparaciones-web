import { useEffect, useMemo, useRef, useState } from 'react'
import { hoyMadrid } from '@/shared/lib/fechas'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { PanelDeslizante, usePresencia } from '@/shared/ui/Deslizante'
import { useFilas } from '../api'
import { estadoPedidos, type EstadoPedidos } from './estado'
import { FiltroColumna, FiltroEnviado, FiltroImei, FiltroTienda } from './FiltroColumna'
import { AyudaPedidos } from './AyudaPedidos'
import { PanelFila } from './PanelFila'
import { FiltroFechas } from './FiltroFechas'
import { PildoraFuentes } from './PildoraFuentes'
import { TablaFilas, UMBRAL_VENTANA } from './TablaFilas'
import { OPCIONES_ENVIADO, SIN_FILTROS, contadorAplicado, filtrarColumnas, filtrosDeContador, hayFiltros, rangoDe, rangoValido, numerosDePedido, recuento, recuentoEstados, recuentoMarcas, textoMarca, textoTienda, tiendasPresentes, valores, type Contador, type FiltrosColumna } from './filas'

/** Lo que se espera tras la última tecla antes de pedir la búsqueda, y los caracteres mínimos para que cuente como búsqueda. */
const ESPERA_BUSCAR_MS = 300
const MIN_BUSCAR = 2

/** «Pedidos» como la hoja (spec «Pedidos como la hoja» §3): una fila por móvil pedido, que crea el ERP desde ShippyPro; lo único
 *  que se teclea es el IMEI. Arriba, el filtro de fechas (por defecto, el último mes), el buscador (mira en todo el historial) y,
 *  en las cabeceras, los filtros por columna, que se aplican en el cliente sobre lo recibido. Todo se guarda en `estadoPedidos`. */
export function PedidosPage({ umbralVentana = UMBRAL_VENTANA }: { /** Filas a la vista por encima de las cuales la tabla pinta solo las visibles (se puede bajar en las pruebas). */ umbralVentana?: number } = {}) {
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
  const tiendas = useMemo(() => tiendasPresentes(filas), [filas])
  const skus = useMemo(() => valores(filas, 'sku'), [filas])
  const numeros = useMemo(() => numerosDePedido(filas), [filas])
  const estados = useMemo(() => recuentoEstados(filas), [filas])
  const conMarca = useMemo(() => recuentoMarcas(filas), [filas])
  const filtros = useMemo<FiltrosColumna>(
    () => ({ plataformas: e.plataformas, skus: e.skus, soloSinImei: e.soloSinImei, noCuadran: e.noCuadran, enviado: e.enviado, marcas: e.marcas }),
    [e.plataformas, e.skus, e.soloSinImei, e.noCuadran, e.enviado, e.marcas],
  )
  const filtrando = hayFiltros(filtros)
  const buscador = useRef<HTMLInputElement>(null)
  const contadorPuesto = contadorAplicado(filtros)
  const vistas = useMemo(() => filtrarColumnas(filas, filtros), [filas, filtros])
  const ventana = vistas.length > umbralVentana
  // Con la tabla a trozos el buscador del navegador solo vería lo pintado: Control+F lleva al buscador de la pantalla. Sin ventana, no se toca.
  useEffect(() => {
    if (!ventana) return
    const alPulsar = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'f') {
        // Con un dialogo o un desplegable (el del IMEI) abierto, o sin buscador al que ir, se deja al navegador.
        if (!buscador.current || document.querySelector('[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]')) return
        ev.preventDefault()
        buscador.current?.focus()
        buscador.current?.select()
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [ventana])
  // Los contadores cuentan sobre lo recibido (no sobre lo filtrado), en una sola pasada y solo cuando cambian las filas.
  const cuenta = useMemo(() => recuento(filas), [filas])
  const etiquetas = useMemo(() => etiquetasDe(filtros), [filtros])
  const sinCargar = lista.isError && !lista.data
  // El panel enseña la fila elegida (por `idFila`); si ya no está entre las recibidas, se cierra.
  const elegida = useMemo(() => (e.filaElegida === null ? null : filas.find((f) => f.idFila === e.filaElegida) ?? null), [filas, e.filaElegida])
  // El panel se queda montado mientras sale (desliza hacia la derecha) con la última fila que enseñaba.
  const presente = usePresencia(elegida)
  const cerrarPanel = () => setE((s) => (s.filaElegida === null ? s : { ...s, filaElegida: null }))
  useEffect(() => {
    if (e.filaElegida !== null && lista.data && !lista.isPlaceholderData && !elegida) setE((s) => ({ ...s, filaElegida: null }))
  }, [e.filaElegida, lista.data, lista.isPlaceholderData, elegida, setE])
  // Escape cierra el panel, pero un solo Escape cierra solo lo que esté encima (un desplegable o un diálogo de Radix). Se escucha en
  // captura en `window`, que corre antes que el Escape de Radix (en `document`, también en captura): así se mira si hay algo encima
  // antes de que Radix lo desmonte.
  useEffect(() => {
    if (!elegida) return
    const alPulsar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !document.querySelector('[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]')) cerrarPanel()
    }
    window.addEventListener('keydown', alPulsar, true)
    return () => window.removeEventListener('keydown', alPulsar, true)
  })
  const poner = (f: Partial<FiltrosColumna>) => setE((s) => ({ ...s, ...f }))
  const quitarFiltros = () => setE((s) => ({ ...s, ...SIN_FILTROS, buscar: '' }))
  const CONTADORES: { id: Contador; texto: string; ayuda: string }[] = [
    { id: 'filas', texto: `${cuenta.total} filas`, ayuda: 'Todas las filas: quita los filtros de columna' },
    { id: 'pendientes', texto: `${cuenta.pendientes} pendientes`, ayuda: 'Solo las pendientes' },
    { id: 'sinImei', texto: `${cuenta.sinImei} sin IMEI`, ayuda: 'Solo las que aún no tienen IMEI' },
    { id: 'noCuadran', texto: `${cuenta.noCuadran} no cuadran`, ayuda: 'Solo las que tienen el IMEI en naranja' },
  ]

  return (
    <div className="flex h-[calc(100vh-var(--spacing-navbar))] flex-col p-10 max-[1500px]:p-5">
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        {lista.data && (
          <div role="group" aria-label="Contadores" className="flex flex-wrap items-center gap-1.5">
            {CONTADORES.map((c) => (
              <button key={c.id} type="button" title={c.ayuda} aria-pressed={contadorPuesto === c.id} onClick={() => setE((s) => ({ ...s, ...filtrosDeContador(c.id) }))}
                className={cn('cursor-pointer rounded-xl border px-2.5 py-[3px] text-[12px] font-bold hover:border-[#9db8e8] hover:bg-seleccion-suave',
                  contadorPuesto === c.id ? 'border-azul-noche bg-azul-noche text-superficie hover:border-azul-noche hover:bg-azul-noche' : 'border-borde-input bg-badge-neutro-bg text-azul-gris')}>{c.texto}</button>
            ))}
          </div>
        )}
        <AyudaPedidos />
        {ventana && <span className="text-[11.5px] text-azul-gris">Tabla grande: se pinta solo lo que se ve. Para buscar usa el buscador (Control+F).</span>}
        <PildoraFuentes />
      </div>
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <FiltroFechas periodo={e.periodo} rango={e.rango} atenuado={buscando}
          // Al elegir «Rango…» salen las fechas guardadas, o, si no hay, las del periodo que se aplicaba.
          onPeriodo={(p) => setE((s) => ({ ...s, periodo: p, rango: p === 'rango' && !rangoValido(s.rango) ? rangoDe(s.periodo, new Date(), s.rango) : s.rango }))}
          onRango={(rango) => setE((s) => ({ ...s, rango }))} />
        <div className="flex min-h-8 w-[28rem] max-w-full flex-wrap items-center gap-1.5 rounded-md border border-borde-input bg-superficie px-2 py-[3px]">
          {etiquetas.map((t) => (
            <span key={t.clave} className="inline-flex items-center gap-1 rounded-md border border-[#9db8e8] bg-seleccion-suave py-px pr-1 pl-2 text-[11.5px] font-bold text-[#1d3a78]">
              {t.texto}
              <button type="button" aria-label={`Quitar filtro ${t.texto}`} onClick={() => setE((s) => t.quitar(s))}
                className="cursor-pointer px-1 text-[13px] leading-none font-bold">✕</button>
            </span>
          ))}
          <input ref={buscador} aria-label="Buscar en todo el historial" placeholder="Buscar en todo el historial…" autoComplete="off" value={e.buscar}
            onChange={(ev) => setE((s) => ({ ...s, buscar: ev.target.value }))}
            className="h-6 min-w-40 flex-1 bg-transparent text-[12px] outline-none" />
        </div>
        {(filtrando || e.buscar !== '') && (
          <button type="button" onClick={quitarFiltros}
            className="h-8 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold text-azul-medio">Quitar filtros</button>
        )}
        {buscando && <p className="text-[12px] text-azul-gris">La búsqueda mira en todo el historial; el periodo no se aplica.</p>}
      </div>
      {buscando && e.buscar.trim().length >= MIN_BUSCAR && lista.data?.hayMas && (
        <p role="status" className="mb-2 shrink-0 text-[12px] font-bold text-form-agotado-text">
          Hay más de 500 resultados: se enseñan los 500 más recientes. Afina la búsqueda.
        </p>
      )}
      {e.avisoImei && (
        // No modal: no roba el foco (se está leyendo la fila de al lado) y dice de qué pedido es. Se queda hasta que se cierre.
        <div role="alert" className="mb-2 flex shrink-0 items-start gap-2 rounded-md border border-[#e0a0a0] bg-[#FDE2E2] px-3 py-1.5 text-[12.5px] font-bold text-texto-error">
          <span className="min-w-0 flex-1">{e.avisoImei}</span>
          <button type="button" aria-label="Cerrar el aviso" title="Cerrar" onClick={() => setE((s) => ({ ...s, avisoImei: null }))}
            className="cursor-pointer px-1 text-[14px] leading-none font-bold">✕</button>
        </div>
      )}
      {lista.isPlaceholderData && <p role="status" className="mb-2 shrink-0 text-[12px] text-azul-gris">Buscando…</p>}
      {lista.isPending && <p className="p-4 text-[12px] text-azul-gris">Cargando…</p>}
      {sinCargar && <p className="p-4 text-[12px] text-azul-gris">No se pudieron cargar los pedidos.</p>}
      {lista.data && filas.length === 0 && (
        <p className="p-4 text-[12px] text-azul-gris">{buscando ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos en este periodo.'}</p>
      )}
      {filas.length > 0 && (
        <div className="flex min-h-0 flex-1">
        <TablaFilas filas={vistas} numeros={numeros} ventana={ventana} recibidas={filas.length} vacio="Ningún pedido cumple los filtros de columna. Pulsa «Quitar filtros» para verlos todos." filtros={{
          Plataforma: <FiltroTienda tiendas={tiendas} seleccion={filtros.plataformas} onChange={(plataformas) => setE((s) => ({ ...s, plataformas }))} />,
          SKU: <FiltroColumna columna="SKU" valores={skus} seleccion={filtros.skus} onChange={(skus) => setE((s) => ({ ...s, skus }))} />,
          Enviado: <FiltroEnviado recuentos={estados} seleccion={filtros.enviado} onChange={(enviado) => setE((s) => ({ ...s, enviado }))} />,
          IMEI: <FiltroImei sinImei={filtros.soloSinImei} noCuadran={filtros.noCuadran} onSinImei={(soloSinImei) => poner({ soloSinImei })} onNoCuadran={(noCuadran) => poner({ noCuadran })}
          marcas={filtros.marcas} onMarcas={(marcas) => poner({ marcas })} recuentoMarcas={conMarca} />,
        }} />
        {presente.valor && <PanelDeslizante saliendo={presente.saliendo}><PanelFila fila={presente.valor} onCerrar={cerrarPanel} /></PanelDeslizante>}
        </div>
      )}
    </div>
  )
}

type Etiqueta = { clave: string; texto: string; quitar: (s: EstadoPedidos) => EstadoPedidos }

/** Los filtros de columna puestos, como etiquetas con su forma de quitarlos (uno a uno). */
function etiquetasDe(f: FiltrosColumna): Etiqueta[] {
  const sin = (conjunto: Set<string>, v: string) => { const n = new Set(conjunto); n.delete(v); return n }
  return [
    ...[...f.plataformas].map((v) => ({ clave: `p:${v}`, texto: `Plataforma: ${textoTienda(v)}`, quitar: (s: EstadoPedidos) => ({ ...s, plataformas: sin(s.plataformas, v) }) })),
    ...[...f.skus].map((v) => ({ clave: `s:${v}`, texto: `SKU: ${v}`, quitar: (s: EstadoPedidos) => ({ ...s, skus: sin(s.skus, v) }) })),
    ...OPCIONES_ENVIADO.filter((o) => f.enviado.has(o.valor)).map((o) => ({ clave: `e:${o.valor}`, texto: o.texto, quitar: (s: EstadoPedidos) => ({ ...s, enviado: sin(s.enviado, o.valor) }) })),
    ...(f.soloSinImei ? [{ clave: 'sin', texto: 'Sin IMEI', quitar: (s: EstadoPedidos) => ({ ...s, soloSinImei: false }) }] : []),
    ...[...f.marcas].map((v) => ({ clave: `m:${v}`, texto: `Con marca: ${textoMarca(v)}`, quitar: (s: EstadoPedidos) => ({ ...s, marcas: sin(s.marcas, v) }) })),
    ...(f.noCuadran ? [{ clave: 'nc', texto: 'No cuadran', quitar: (s: EstadoPedidos) => ({ ...s, noCuadran: false }) }] : []),
  ]
}
