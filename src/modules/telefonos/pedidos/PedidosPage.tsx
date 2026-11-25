import { useEffect, useMemo, useRef, useState } from 'react'
import { hoyMadrid } from '@/shared/lib/fechas'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { descargarCsv } from '@/shared/lib/csv'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { PanelDeslizante, usePresencia } from '@/shared/ui/Deslizante'
import { useFilas } from '../api'
import { estadoPedidos, type EstadoPedidos } from './estado'
import { FiltroColumna, FiltroEnviado, FiltroImei, FiltroTienda } from './FiltroColumna'
import { DescargarBuscar } from './DescargarBuscar'
import { CABECERAS_PEDIDOS, NOMBRE_CSV_PEDIDOS, filaPedidoCsv } from './csv'
import { AyudaPedidos } from './AyudaPedidos'
import { PanelFila } from './PanelFila'
import { FiltroFechas } from './FiltroFechas'
import { PildoraAsociacion } from './PildoraAsociacion'
import { PildoraFuentes } from './PildoraFuentes'
import { TablaFilas, UMBRAL_VENTANA } from './TablaFilas'
import { cargarNoValidos, limpiarNoValidos } from './noValidos'
import { OPCIONES_ENVIADO, SIN_FILTROS, acumularVista, contadorAplicado, filtrosDeContador, filtrarColumnas, hayFiltros, rangoDe, rangoValido, numerosDePedido, recuento, recuentoEstados, recuentoMarcas, recuentoSalida, recuentoSinAsociar, separarPorPeriodo, avisoFuera, ordenarPorSku, siguienteOrdenSku, textoAvisoFuera, textoMarca, textoTienda, tiendasPresentes, valores, vistaVacia, type Contador, type FiltrosColumna } from './filas'

/** Lo que se espera tras la última tecla antes de pedir la búsqueda, y los caracteres mínimos para que cuente como búsqueda. */
const ESPERA_BUSCAR_MS = 300
/** 0.9.39: la columna SKU se ordena por modelo (como se organiza el almacén), no por orden alfabético. */
const TEXTOS_ORDEN_SKU = { asc: 'modelo del más antiguo al más nuevo (6s → 17 Pro Max)', desc: 'modelo del más nuevo al más antiguo (17 Pro Max → 6s)' }
const MIN_BUSCAR = 2

/** «Pedidos» como la hoja (spec «Pedidos como la hoja» §3): una fila por móvil pedido, que crea el ERP desde ShippyPro; lo único
 *  que se teclea es el IMEI. Arriba, el filtro de fechas (por defecto, el último mes), el buscador (mira en todo el historial) y,
 *  en las cabeceras, los filtros por columna, que se aplican en el cliente sobre lo recibido y dejan la vista fija (como en Excel: la fila que
 *  deja de cumplir se queda hasta que se cambie el filtro, el periodo, la búsqueda o «Ver», o se pulse un contador). Todo se guarda en `estadoPedidos`. */
export function PedidosPage({ umbralVentana = UMBRAL_VENTANA }: { /** Filas a la vista por encima de las cuales la tabla pinta solo las visibles (se puede bajar en las pruebas). */ umbralVentana?: number } = {}) {
  const [e, setE] = useStore(estadoPedidos)
  const [aplicado, setAplicado] = useState(e.buscar)
  const [pulsoVista, setPulsoVista] = useState(0)
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
  const recibidas = useMemo(() => lista.data?.filas ?? [], [lista.data])
  // Lecturas no válidas (spec 2026-11-25 §2): las de este navegador al entrar; y se quitan las de filas que ya tienen otro IMEI.
  useEffect(() => { cargarNoValidos() }, [])
  useEffect(() => { limpiarNoValidos(recibidas) }, [recibidas])
  // 0.9.38 (spec «rango estricto»): el servidor manda el periodo y, además, las abiertas de cualquier fecha. Sin búsqueda, la tabla
  // enseña solo las del periodo (o, con «Ver», solo los pendientes de fuera); contadores y filtros de columna cuentan lo que se ve.
  const partes = useMemo(() => (buscando ? null : separarPorPeriodo(recibidas, desde, hasta)), [buscando, recibidas, desde, hasta])
  const viendoFuera = !!partes && e.verFuera
  const filas = useMemo(() => (partes ? (e.verFuera ? partes.fuera : partes.delPeriodo) : recibidas), [partes, e.verFuera, recibidas])
  const aviso = useMemo(() => (partes && !e.verFuera ? avisoFuera(partes.fuera, desde, hasta, hoy) : null), [partes, e.verFuera, desde, hasta, hoy])
  const tiendas = useMemo(() => tiendasPresentes(filas), [filas])
  const skus = useMemo(() => valores(filas, 'sku'), [filas])
  const numeros = useMemo(() => numerosDePedido(recibidas), [recibidas])
  const salida = useMemo(() => recuentoSalida(filas, hoy), [filas, hoy])
  const estados = useMemo(() => ({ ...recuentoEstados(filas), SALE_HOY: salida.hoy, CON_RETRASO: salida.retraso }), [filas, salida])
  const conMarca = useMemo(() => recuentoMarcas(filas), [filas])
  const nSinAsociar = useMemo(() => recuentoSinAsociar(filas), [filas])
  const filtros = useMemo<FiltrosColumna>(
    () => ({ plataformas: e.plataformas, skus: e.skus, soloSinImei: e.soloSinImei, noCuadran: e.noCuadran, enviado: e.enviado, marcas: e.marcas, sinAsociar: e.sinAsociar }),
    [e.plataformas, e.skus, e.soloSinImei, e.noCuadran, e.enviado, e.marcas, e.sinAsociar],
  )
  const filtrando = hayFiltros(filtros) || viendoFuera
  const buscador = useRef<HTMLInputElement>(null)
  const contadorPuesto = contadorAplicado(filtros)
  // La vista fija (spec 2026-11-25 §4): se rehace al cambiar los filtros de columna, el periodo, la búsqueda o «Ver», y al pulsar un
  // contador (aunque sea el puesto: así se quitan las ya picadas). Entre medias, una fila que deja de cumplir el filtro se queda.
  // Vive en estado (no en un `useMemo`, que React puede tirar y la vista se vaciaría sola) con la clave que la originó; si la clave
  // cambia (misma identidad que antes en las dependencias del memo), se descarta y se ajusta el estado durante el render.
  const clave = [filtros, desde, hasta, buscando ? aplicado.trim() : '', e.verFuera, pulsoVista]
  const [fija, setFija] = useState({ clave, vista: vistaVacia() })
  const mismaClave = fija.clave.length === clave.length && fija.clave.every((c, i) => Object.is(c, clave[i]))
  const base = mismaClave ? fija.vista : vistaVacia()
  // Con `isPlaceholderData` (keepPreviousData) `filas` son las del periodo/búsqueda anterior: darlas por conocidas las fijaría en la
  // vista nueva con su estado viejo. Mientras llegan las nuevas no se acumula nada: se enseñan las viejas con los filtros, sin fijarlas.
  const placeholder = lista.isPlaceholderData
  // `acumularVista` es pura: el memo es solo caché (si React lo tira, se recalcula igual desde `fija`, que es el estado real).
  const { acumulado, vistas } = useMemo(() => {
    const acumulado = placeholder ? null : acumularVista(base, filas, filtros, hoy)
    return { acumulado, vistas: ordenarPorSku(acumulado ? acumulado.filas : filtrarColumnas(filas, filtros, hoy), e.ordenSku) }
  }, [placeholder, base, filas, filtros, hoy, e.ordenSku])
  if (!mismaClave || (acumulado && acumulado.vista !== fija.vista)) setFija({ clave, vista: acumulado ? acumulado.vista : base })
  const ventana = vistas.length > umbralVentana
  // «Descargar CSV» del menú de usuario: lo que se ve (periodo o búsqueda, filtros de columna y orden). Sin filas, la opción sale deshabilitada.
  useRegistrarExportable(vistas.length > 0 ? () => descargarCsv(NOMBRE_CSV_PEDIDOS, CABECERAS_PEDIDOS, vistas.map((f) => filaPedidoCsv(f, hoy))) : null)
  // Con la tabla a trozos el buscador del navegador solo vería lo pintado: Control+F lleva al buscador de la pantalla. Sin ventana, no se toca.
  useEffect(() => {
    if (!ventana) return
    const alPulsar = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'f') {
        // Con un dialogo o un desplegable (el del IMEI) abierto, o sin buscador al que ir, se deja al navegador.
        if (!buscador.current || document.querySelector('[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]')
          || (document.activeElement as Element | null)?.closest?.('td[data-editando]')) return
        ev.preventDefault()
        buscador.current?.focus()
        buscador.current?.select()
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [ventana])
  // Los contadores cuentan sobre lo que se ve antes de los filtros de columna (el periodo, o los de fuera con «Ver»), en una sola pasada y solo cuando cambian las filas.
  const cuenta = useMemo(() => recuento(filas), [filas])
  const etiquetas = useMemo(() => etiquetasDe(filtros), [filtros])
  const sinCargar = lista.isError && !lista.data
  // El panel enseña la fila elegida (por `idFila`); si ya no está entre las recibidas, se cierra.
  const elegida = useMemo(() => (e.filaElegida === null ? null : recibidas.find((f) => f.idFila === e.filaElegida) ?? null), [recibidas, e.filaElegida])
  // El panel se queda montado mientras sale (desliza hacia la derecha) con la última fila que enseñaba.
  const presente = usePresencia(elegida)
  const cerrarPanel = () => setE((s) => (s.filaElegida === null ? s : { ...s, filaElegida: null }))
  useEffect(() => {
    if (e.filaElegida !== null && lista.data && !lista.isPlaceholderData && !elegida) setE((s) => ({ ...s, filaElegida: null }))
  }, [e.filaElegida, lista.data, lista.isPlaceholderData, elegida, setE])
  // Escape cierra el panel, pero un solo Escape cierra solo lo que esté encima (un desplegable o un diálogo de Radix). Se escucha en
  // captura en `window`, que corre antes que el Escape de Radix (en `document`, también en captura): así se mira si hay algo encima
  // antes de que Radix lo desmonte. Con el foco en la celda del IMEI, el Escape es de la celda (cierra el campo), no del panel.
  useEffect(() => {
    if (!elegida) return
    const alPulsar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !document.querySelector('[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]')
        && !(document.activeElement as Element | null)?.closest?.('td[data-editando]')) cerrarPanel()
    }
    window.addEventListener('keydown', alPulsar, true)
    return () => window.removeEventListener('keydown', alPulsar, true)
  })
  const poner = (f: Partial<FiltrosColumna>) => setE((s) => ({ ...s, ...f }))
  const quitarFiltros = () => setE((s) => ({ ...s, ...SIN_FILTROS, buscar: '', verFuera: false }))
  const CONTADORES: { id: Contador; texto: string; ayuda: string }[] = [
    { id: 'filas', texto: `${cuenta.total} filas`, ayuda: 'Todas las filas: quita los filtros de columna' },
    { id: 'pendientes', texto: `${cuenta.pendientes} pendientes`, ayuda: 'Solo las pendientes' },
    { id: 'sinImei', texto: `${cuenta.sinImei} sin IMEI`, ayuda: 'Solo las que aún no tienen IMEI' },
    { id: 'saleHoy', texto: `${salida.hoy} salen hoy`, ayuda: 'Solo las pendientes que tienen que salir hoy' },
    ...(salida.retraso > 0 ? [{ id: 'conRetraso' as const, texto: `${salida.retraso} con retraso`, ayuda: 'Solo las pendientes que ya deberían haber salido' }] : []),
    { id: 'noCuadran', texto: `${cuenta.noCuadran} no cuadran`, ayuda: 'Solo las que tienen el IMEI en naranja' },
  ]

  return (
    <div className="flex h-[calc(100vh-var(--spacing-navbar))] flex-col p-10 max-[1500px]:p-5">
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        {lista.data && (
          <div role="group" aria-label="Contadores" className="flex flex-wrap items-center gap-1.5">
            {CONTADORES.map((c) => (
              <button key={c.id} type="button" title={c.ayuda} aria-pressed={contadorPuesto === c.id} onClick={() => { setE((s) => ({ ...s, ...filtrosDeContador(c.id) })); setPulsoVista((n) => n + 1) }}
                className={cn('cursor-pointer rounded-xl border px-2.5 py-[3px] text-[12px] font-bold hover:border-[#9db8e8] hover:bg-seleccion-suave',
                  contadorPuesto === c.id ? 'border-azul-noche bg-azul-noche text-superficie hover:border-azul-noche hover:bg-azul-noche' : 'border-borde-input bg-badge-neutro-bg text-azul-gris')}>{c.texto}</button>
            ))}
          </div>
        )}
        <AyudaPedidos />
        {ventana && <span className="text-[11.5px] text-azul-gris">Tabla grande: se pinta solo lo que se ve. Para buscar usa el buscador (Control+F).</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2"><DescargarBuscar /><PildoraAsociacion /><PildoraFuentes /></div>
      </div>
      <div className="mb-2.5 flex min-h-8 shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <FiltroFechas periodo={e.periodo} rango={e.rango} atenuado={buscando}
          // Al elegir «Rango…» salen las fechas guardadas, o, si no hay, las del periodo que se aplicaba.
          onPeriodo={(p) => setE((s) => ({ ...s, periodo: p, verFuera: false, rango: p === 'rango' && !rangoValido(s.rango) ? rangoDe(s.periodo, new Date(), s.rango) : s.rango }))}
          onRango={(rango) => setE((s) => ({ ...s, rango, verFuera: false }))} />
        <div className="flex min-h-8 min-w-56 max-w-[28rem] flex-[1_1_14rem] flex-wrap items-center gap-1.5 rounded-md border border-borde-input bg-superficie px-2 py-[3px]">
          {viendoFuera && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#e0c060] bg-[#fff8e1] py-px pr-1 pl-2 text-[11.5px] font-bold text-[#6b4e00]">
              Pendientes fuera del periodo
              <button type="button" aria-label="Quitar filtro Pendientes fuera del periodo" onClick={() => setE((s) => ({ ...s, verFuera: false }))}
                className="cursor-pointer px-1 text-[13px] leading-none font-bold">✕</button>
            </span>
          )}
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
        {e.avisoImei && (
          // No modal: no roba el foco (se está leyendo la fila de al lado) y dice de qué pedido es. Va en la barra del buscador, en el hueco de
          // la derecha, en una línea: no cambia el alto de la barra y la tabla no se mueve. Texto completo en `title`. Se queda hasta que se cierre.
          <div role="alert" title={e.avisoImei} className="flex h-8 min-w-0 flex-[4_1_0%] items-center gap-2 rounded-md border border-[#e0a0a0] bg-[#FDE2E2] px-2.5 text-[12px] font-bold text-texto-error">
            <span className="min-w-0 flex-1 truncate">{e.avisoImei}</span>
            <button type="button" aria-label="Cerrar el aviso" title="Cerrar" onClick={() => setE((s) => ({ ...s, avisoImei: null }))}
              className="cursor-pointer px-1 text-[14px] leading-none font-bold">✕</button>
          </div>
        )}
      </div>
      {buscando && e.buscar.trim().length >= MIN_BUSCAR && lista.data?.hayMas && (
        <p role="status" className="mb-2 shrink-0 text-[12px] font-bold text-form-agotado-text">
          Hay más de 500 resultados: se enseñan los 500 más recientes. Afina la búsqueda.
        </p>
      )}
      {aviso && (
        // Los pendientes que el periodo deja fuera: no se esconden del todo, se cuentan aquí y «Ver» los enseña.
        <div role="status" aria-label="Pendientes fuera del periodo" className="mb-2 flex shrink-0 items-center gap-3 rounded-md border border-[#f0d58a] bg-[#fff8e1] px-3 py-1.5 text-[12.5px] text-[#6b4e00]">
          <span className="min-w-0 flex-1">⚠ {textoAvisoFuera(aviso, desde, hasta)}</span>
          <button type="button" onClick={() => setE((s) => ({ ...s, verFuera: true }))}
            className="h-6 cursor-pointer rounded-md border border-[#d9b44a] bg-superficie px-3 text-[12px] font-bold text-[#6b4e00]">Ver</button>
        </div>
      )}
      {lista.isPlaceholderData && <p role="status" className="mb-2 shrink-0 text-[12px] text-azul-gris">Buscando…</p>}
      {lista.isPending && <p className="p-4 text-[12px] text-azul-gris">Cargando…</p>}
      {sinCargar && <p className="p-4 text-[12px] text-azul-gris">No se pudieron cargar los pedidos.</p>}
      {lista.data && filas.length === 0 && (
        <p className="p-4 text-[12px] text-azul-gris">{buscando ? 'Ningún pedido coincide con la búsqueda.' : viendoFuera ? 'Ya no quedan pendientes fuera del periodo.' : 'No hay pedidos en este periodo.'}</p>
      )}
      {filas.length > 0 && (
        <div className="flex min-h-0 flex-1">
        <TablaFilas filas={vistas} hoy={hoy}
          orden={{ SKU: { direccion: e.ordenSku, siguiente: siguienteOrdenSku(e.ordenSku), textos: TEXTOS_ORDEN_SKU, onClick: () => setE((s) => ({ ...s, ordenSku: siguienteOrdenSku(s.ordenSku) })) } }} numeros={numeros} ventana={ventana} recibidas={filas.length} vacio="Ningún pedido cumple los filtros de columna. Pulsa «Quitar filtros» para verlos todos." filtros={{
          Plataforma: <FiltroTienda tiendas={tiendas} seleccion={filtros.plataformas} onChange={(plataformas) => setE((s) => ({ ...s, plataformas }))} />,
          SKU: <FiltroColumna columna="SKU" valores={skus} seleccion={filtros.skus} onChange={(skus) => setE((s) => ({ ...s, skus }))} />,
          Enviado: <FiltroEnviado recuentos={estados} seleccion={filtros.enviado} onChange={(enviado) => setE((s) => ({ ...s, enviado }))} />,
          IMEI: <FiltroImei sinImei={filtros.soloSinImei} noCuadran={filtros.noCuadran} onSinImei={(soloSinImei) => poner({ soloSinImei })} onNoCuadran={(noCuadran) => poner({ noCuadran })}
          marcas={filtros.marcas} onMarcas={(marcas) => poner({ marcas })} recuentoMarcas={conMarca}
          sinAsociar={filtros.sinAsociar} onSinAsociar={(sinAsociar) => poner({ sinAsociar })} recuentoSinAsociar={nSinAsociar} />,
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
    ...(f.sinAsociar ? [{ clave: 'sa', texto: 'Sin asociar', quitar: (s: EstadoPedidos) => ({ ...s, sinAsociar: false }) }] : []),
    ...(f.noCuadran ? [{ clave: 'nc', texto: 'No cuadran', quitar: (s: EstadoPedidos) => ({ ...s, noCuadran: false }) }] : []),
  ]
}
