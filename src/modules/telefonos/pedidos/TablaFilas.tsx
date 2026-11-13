import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultRangeExtractor, observeElementRect, useVirtualizer, type Range } from '@tanstack/react-virtual'
import type { FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { CeldaImei } from './CeldaImei'
import { useStore } from '@/shared/lib/store'
import { estadoPedidos, type FalloImei } from './estado'
import { CLASE_TONO, COLUMNAS, detalleEnvio, estadoDe, estadoPantalla, numerosDePedido, tonoFila, type EstadoPantalla } from './filas'

type Columna = (typeof COLUMNAS)[number]

/** Spec Pedidos v2 §5: con más filas a la vista que esto (tras los filtros de columna) la tabla pinta solo las que se ven. Hasta
 *  aquí, entera y con el Control+F del navegador. Es un valor del código: bajarlo si en preprod justo por debajo ya no va fluido. */
export const UMBRAL_VENTANA = 5000
/** Alto de una fila (h-8) mientras no se haya medido la real, y filas extra pintadas por arriba y por abajo del hueco visible. */
const ALTO_FILA = 32
const FILAS_DE_MARGEN = 12
/** Sin maquetación (jsdom, o la tabla aún oculta) el contenedor mide 0: con este rectángulo se pinta un puñado de filas, no ninguna. */
const RECT_DE_RESERVA = { width: 1000, height: 600 }

const dia = (iso: string | null) => (iso ? diaNsys(iso) : '')

type PropsFila = {
  fila: FilaVista; abierta: boolean; marcada: boolean
  /** El último guardado del IMEI de esta fila falló (la celda se ve en rojo). */
  fallo?: FalloImei
  /** «1/3»: el lugar de la fila en su pedido de varios móviles (nada si el pedido es de uno). */
  numero?: string
  /** Su detalle está abierto en el panel (solo se dice con `aria-pressed`; la marca visual es `marcada`). */
  elegida: boolean
  /** Solo en modo ventana: su número de fila para los lectores de pantalla (la tabla dice cuántas hay y solo se pintan unas). */
  indice?: number
  onAbrir: (idFila: number, abrir: boolean) => void
  onSaltar: (idFila: number) => boolean
  /** Pulsar la fila (fuera de la celda del IMEI): abre su panel, cambia de fila o lo cierra. */
  onElegir: (idFila: number) => void
}

/** La raya azul del borde izquierdo de «la fila en la que estás» (su primera celda). */
const SOMBRA_RAYA = 'shadow-[inset_4px_0_0_#2f6fe0]'
export const ETIQUETA = 'inline-block rounded-lg px-2 py-px text-[11px] font-bold'
export const COLOR_ETIQUETA: Record<EstadoPantalla, string> = {
  PENDIENTE: 'border border-dashed border-[#C8CDD5] bg-superficie text-azul-gris',
  FALTA_ENVIAR: 'bg-pill-aviso-bg text-pill-aviso-text',
  GENERADA: 'bg-pill-aviso-bg text-pill-aviso-text',
  ENVIADO: 'bg-fila-reparado-bg text-[#2f7d3b]',
  NO_PENDIENTE: 'bg-[#dbe6fb] text-[#1d3a78]',
  HISTORICO: 'bg-[#eceef2] text-[#6b7482]',
}

/** Un espacio y «dd/mm» de una fecha del servidor, o nada. */
const diaMes = (iso: string | null) => (iso ? ` ${dia(iso).slice(0, 5)}` : '')

/** El estado de la fila como etiqueta con texto (el color nunca es la única señal). Con etiqueta generada o enviada, tras ella van el
 *  transportista y el seguimiento, visibles sin esperar al ratón. «Etiqueta generada» lleva la fecha del envío y «Enviado» (etiqueta
 *  impresa), la de la impresión. */
export function EtiquetaEstado({ fila: f, estado, conDetalle = true }: { fila: FilaVista; estado: EstadoPantalla; conDetalle?: boolean }) {
  const detalle = conDetalle && (estado === 'GENERADA' || estado === 'ENVIADO') ? detalleEnvio(f, ' ') : undefined
  const texto = {
    PENDIENTE: 'Pendiente',
    FALTA_ENVIAR: 'Envío parcial · falta por enviar',
    GENERADA: `Etiqueta generada${diaMes(f.envioFecha)}`,
    ENVIADO: `Enviado${diaMes(f.impresaEn)}`,
    NO_PENDIENTE: 'Ya no está pendiente',
    HISTORICO: 'De la hoja',
  }[estado]
  return (
    <>
      <span className={cn(ETIQUETA, COLOR_ETIQUETA[estado])}>{texto}</span>
      {detalle && <>{' '}<span className="ml-1.5 font-sans text-[11px] text-azul-gris">{detalle}</span></>}
    </>
  )
}

/** Fila vacía que ocupa el sitio de las filas que no se pintan (modo ventana). */
function FilaHueco({ alto }: { alto: number }) {
  return <tr aria-hidden="true"><td colSpan={COLUMNAS.length} style={{ height: alto, padding: 0, border: 0 }} /></tr>
}

/** Una fila de la hoja. Con ~1.500 filas, abrir una celda o recibir un sondeo no debe repintarlas todas: `memo` la deja quieta si
 *  su `fila` (TanStack conserva los objetos que no cambian), su `abierta`, su `marcada` y su `elegida` son los mismos. Las fechas se dan formato aquí dentro. */
export const FilaTabla = memo(function FilaTabla({ fila: f, indice, abierta, marcada, fallo, numero, elegida, onAbrir, onSaltar, onElegir }: PropsFila) {
  const tono = tonoFila(f)
  // «La fila en la que estás»: azul suave en todas sus celdas (el tono gris del histórico cede el fondo, no el texto) y la raya en la primera.
  const td = cn('h-8 overflow-hidden border-r border-b border-form-fila-brd px-2.5 py-1 text-ellipsis whitespace-nowrap last:border-r-0', tono && CLASE_TONO[tono], marcada && 'bg-seleccion-suave')
  const servidor = estadoDe(f)
  const estado = estadoPantalla(f)
  return (
    // Un clic en cualquier celda menos la del IMEI elige la fila. Se comprueba en el DOM (el desplegable del IMEI sube por React
    // desde su portal, pero no está dentro de la fila).
    <tr data-estado={servidor} data-impresa={f.impresaEn ? 'true' : undefined} aria-rowindex={indice} data-aqui={marcada || undefined}
      onClick={(ev) => {
        const celda = (ev.target as Element).closest('td')
        if (celda && ev.currentTarget.contains(celda) && !celda.hasAttribute('data-imei')) onElegir(f.idFila)
      }}>
      <td className={cn(td, marcada && SOMBRA_RAYA)}>{dia(f.fecha)}</td>
      <td className={td} title={f.plataforma}>{f.plataforma}</td>
      <td className={cn(td, 'font-mono text-[12px]')} title={f.sku ?? undefined}>
        {numero
          // La marca se queda a la derecha del SKU sin ensanchar la columna: el SKU se corta con puntos suspensivos, la marca no.
          ? <div className="flex items-baseline gap-1.5"><span className="min-w-0 truncate">{f.sku}</span><span data-numero-pedido title="Móviles de este pedido" className="shrink-0 font-sans text-[10px] text-azul-gris">{numero}</span></div>
          : f.sku}
      </td>
      <CeldaImei fila={f} abierta={abierta} marcada={marcada} fallo={fallo} onAbrir={onAbrir} onSaltar={onSaltar} />
      <td className={td}>
        {/* El botón es la forma de elegir la fila con teclado. */}
        <button type="button" aria-pressed={elegida} title="Ver el detalle del pedido" className="cursor-pointer bg-transparent p-0 text-left">{f.pedido}</button>
      </td>
      <td className={td} title={servidor === 'ENVIADA' ? detalleEnvio(f) : undefined}><EtiquetaEstado fila={f} estado={estado} /></td>
      <td className={td}>{dia(f.fechaCompra)}</td>
    </tr>
  )
})

/** La hoja de pedidos (spec «Pedidos como la hoja» §3): una fila por pedido en el orden recibido, cabecera fija, el estado como etiqueta
 *  en «Enviado» y solo el histórico en gris. La última fila que se toca (su celda de IMEI o su detalle) queda marcada en azul suave con una raya. Al montar baja al final; al llegar filas nuevas baja solo si el usuario ya estaba abajo. Solo una celda de IMEI abierta. */
export function TablaFilas({ filas, recibidas = filas.length, filtros, vacio, ventana = false, numeros: numerosDados }: {
  filas: FilaVista[]
  /** Modo «muchas filas»: solo se pintan las filas visibles (más un margen); la barra de scroll abarca todas. Lo decide la página por el umbral. */
  ventana?: boolean
  /** Cuántas filas ha recibido la página (sin filtrar por columna): solo llegar filas nuevas baja al final, no filtrar. */
  recibidas?: number
  filtros?: Partial<Record<Columna, ReactNode>>
  /** Lo que se enseña en el cuerpo si no hay filas que pintar (la cabecera y sus filtros siguen). */
  vacio?: ReactNode
  /** «1/3»… por `idFila` (ver `numerosDePedido`). La página lo calcula sobre todas las filas recibidas para que un filtro no cambie los números. */
  numeros?: Map<number, string>
}) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const numeros = useMemo(() => numerosDados ?? numerosDePedido(filas), [numerosDados, filas])
  // Posición de cada fila por su id (se rehace solo cuando cambian las filas): así «¿sigue la abierta?» y «¿dónde está?» no recorren la lista en cada pintado.
  const indice = useMemo(() => new Map(filas.map((f, i) => [f.idFila, i])), [filas])
  // Si la fila abierta ya no se pinta (un filtro la esconde) o ya no se puede editar, se cierra: así no se reabre sola al quitar el filtro.
  if (abierta !== null && !filas[indice.get(abierta) ?? -1]?.editable) setAbierta(null)
  // Estable (para el `memo` de las filas). Cerrar una celda que ya no es la abierta no hace nada: el cierre tardío de la anterior
  // (foco, clic fuera) no puede cerrar la que acaba de abrirse.
  const cambiar = useCallback((id: number, abrir: boolean) => {
    setAbierta((a) => (abrir ? id : a === id ? null : a))
    if (abrir) estadoPedidos.set((s) => (s.filaAqui === id ? s : { ...s, filaAqui: id }))
  }, [])
  // Guardar un IMEI tecleado o leído abre al instante la celda de la siguiente fila editable y sin IMEI de las que se ven (en su orden).
  // Va por referencias para que la función sea estable (la `memo` de las filas) y use siempre las filas de ahora.
  const filasAhora = useRef(filas)
  filasAhora.current = filas
  const aEnseñar = useRef<number | null>(null)
  const saltar = useCallback((desde: number) => {
    const lista = filasAhora.current
    const i = lista.findIndex((f) => f.idFila === desde)
    if (i < 0) return false
    const j = lista.findIndex((f, k) => k > i && f.editable && !f.imei)
    if (j < 0) return false
    const id = lista[j].idFila
    aEnseñar.current = j
    setAbierta(id)
    estadoPedidos.set((s) => (s.filaAqui === id ? s : { ...s, filaAqui: id }))
    return true
  }, [])
  // Abrir un detalle (no cerrarlo) también deja ahí «la fila en la que estás».
  const elegir = useCallback((id: number) => estadoPedidos.set((s) => (s.filaElegida === id ? { ...s, filaElegida: null } : { ...s, filaElegida: id, filaAqui: id })), [])
  const [{ filaAqui, filaElegida, fallosImei }] = useStore(estadoPedidos)
  const contenedor = useRef<HTMLDivElement>(null)
  // La altura que tenía el contenido tras el último pintado. Añadir filas no cambia `scrollTop` pero sí la altura, así que
  // «estaba abajo» se calcula justo antes de decidir con la altura de entonces, no con un valor guardado en un scroll antiguo.
  const alturaPrevia = useRef<number | null>(null)
  const vistas = useRef(0)
  const modoPrevio = useRef(ventana)
  // «Pegado abajo»: el usuario está (o ha pedido estar) al final. Se actualiza en cada scroll; en modo ventana se vuelve a aplicar
  // tras cada cambio de altura o de total, porque ahí el scrollHeight depende de medidas que llegan después del primer pintado.
  const pegado = useRef(true)
  // Medidas reales (alto de una fila y de la cabecera fija) frente a las estimadas: con 26.700 filas 1 px de más por fila son 26.700 px.
  const [medidas, setMedidas] = useState({ alto: ALTO_FILA, cabecera: 0 })
  const { alto, cabecera } = medidas
  const claveFila = useCallback((i: number) => filas[i]?.idFila ?? i, [filas])
  // Las filas con la celda del IMEI abierta y la elegida para el panel se pintan siempre, aunque salgan de la ventana: si no, el
  // desplegable se desmontaría con lo tecleado dentro (o con un guardado en vuelo).
  const fijas = [abierta, filaElegida].map((id) => (id === null ? undefined : indice.get(id))).filter((n): n is number => n !== undefined)
  const rangoConFijas = useCallback((r: Range) => {
    const base = defaultRangeExtractor(r)
    const extra = fijas.filter((n) => !base.includes(n))
    return extra.length ? [...base, ...extra].sort((a, b) => a - b) : base
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fijas.join(',')])
  const virtualizador = useVirtualizer({
    count: ventana ? filas.length : 0,
    getScrollElement: () => contenedor.current,
    estimateSize: () => alto,
    scrollMargin: cabecera,
    overscan: FILAS_DE_MARGEN,
    enabled: ventana,
    getItemKey: claveFila,
    rangeExtractor: rangoConFijas,
    initialRect: RECT_DE_RESERVA,
    observeElementRect: (v, cb) => observeElementRect(v, (r) => cb(r.height > 0 ? r : RECT_DE_RESERVA)),
  })
  const items = ventana ? virtualizador.getVirtualItems() : []
  // Tras un salto, la fila destino queda a la vista: en modo ventana se desplaza a su posición (puede no estar pintada; `fijas` la pinta
  // al abrirse) y en el normal se la lleva al borde más cercano.
  useLayoutEffect(() => {
    const j = aEnseñar.current
    if (j === null) return
    aEnseñar.current = null
    if (ventana) { pegado.current = false; virtualizador.scrollToIndex(j, { align: 'auto' }) }
    else contenedor.current?.querySelector<HTMLElement>('tr[data-aqui]')?.scrollIntoView({ block: 'nearest' })
  }, [abierta, ventana, virtualizador])
  const aMedir = useRef<HTMLTableSectionElement>(null)
  const cabeza = useRef<HTMLTableSectionElement>(null)
  useLayoutEffect(() => {
    if (!ventana) return
    const h = aMedir.current?.querySelector<HTMLElement>('tr[data-estado]')?.offsetHeight ?? 0
    const c = cabeza.current?.offsetHeight ?? 0
    const nuevo = { alto: h > 0 && Math.abs(h - alto) >= 0.5 ? h : alto, cabecera: c > 0 && Math.abs(c - cabecera) >= 0.5 ? c : cabecera }
    if (nuevo.alto !== alto || nuevo.cabecera !== cabecera) { setMedidas(nuevo); virtualizador.measure() }
  }, [ventana, filas.length, alto, cabecera, virtualizador])
  // Modo ventana: quien está pegado abajo sigue al final tras cada cambio de medidas, de total o de filas recibidas.
  useLayoutEffect(() => {
    const c = contenedor.current
    if (!ventana || !c || !pegado.current) return
    if (c.scrollHeight - c.scrollTop - c.clientHeight > 1) c.scrollTop = c.scrollHeight
  }, [ventana, alto, cabecera, filas.length, recibidas])

  // Modo normal, en cada pintado: «estaba abajo» se calcula con la altura del pintado anterior (filtrar cambia la altura sin que el usuario se mueva).
  useLayoutEffect(() => {
    const c = contenedor.current
    if (!c) return
    // Cruzar el umbral por un filtro: quien estaba abajo sigue abajo; si no, el scroll en píxeles se queda (las filas miden lo mismo).
    const cambioModo = modoPrevio.current !== ventana
    modoPrevio.current = ventana
    if (ventana) { vistas.current = recibidas; return } // en modo ventana lo hace el efecto de arriba
    const estabaAbajo = cambioModo ? pegado.current : alturaPrevia.current === null || alturaPrevia.current - c.scrollTop - c.clientHeight < 8
    if ((recibidas > vistas.current || cambioModo) && estabaAbajo) c.scrollTop = c.scrollHeight
    vistas.current = recibidas
    alturaPrevia.current = c.scrollHeight
  })

  // Las filas de la ventana, con un hueco (fila vacía de su alto) donde falten las que no se pintan.
  const cuerpo: ReactNode[] = []
  if (ventana) {
    let fin = 0
    for (const it of items) {
      const f = filas[it.index]
      if (!f) continue
      const inicio = it.start - cabecera
      if (inicio > fin + 0.5) cuerpo.push(<FilaHueco key={`h${it.index}`} alto={inicio - fin} />)
      cuerpo.push(<FilaTabla key={f.idFila} fila={f} indice={it.index + 2} abierta={abierta === f.idFila} marcada={filaAqui === f.idFila} fallo={fallosImei[f.idFila]} numero={numeros.get(f.idFila)} elegida={filaElegida === f.idFila} onAbrir={cambiar} onSaltar={saltar} onElegir={elegir} />)
      fin = it.end - cabecera
    }
    const total = virtualizador.getTotalSize()
    if (total - fin > 0.5) cuerpo.push(<FilaHueco key="hf" alto={total - fin} />)
  } else {
    for (const f of filas) cuerpo.push(<FilaTabla key={f.idFila} fila={f} abierta={abierta === f.idFila} marcada={filaAqui === f.idFila} fallo={fallosImei[f.idFila]} numero={numeros.get(f.idFila)} elegida={filaElegida === f.idFila} onAbrir={cambiar} onSaltar={saltar} onElegir={elegir} />)
  }

  return (
    <div ref={contenedor} role="region" aria-label="Tabla de pedidos" className={cn('relative min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-borde-input bg-superficie', ventana && '[overflow-anchor:none]')}
      onScroll={(ev) => { const c = ev.currentTarget; pegado.current = c.scrollHeight - c.scrollTop - c.clientHeight < 8 }}>
      {/* Anchos en porcentaje: el espacio se reparte entre todas (el SKU y el IMEI, que es lo que se lee, se llevan lo más). Lo
          largo se corta con puntos suspensivos y lleva `title`; si no cabe el mínimo, el contenedor se desplaza por dentro, nunca
          la página. */}
      <table className="w-full min-w-[925px] table-fixed border-separate border-spacing-0 text-[13px] tabular-nums" aria-rowcount={ventana ? filas.length + 1 : undefined}>
        <colgroup>
          <col className="w-[8%]" /><col className="w-[12%]" /><col className="w-[18%]" /><col className="w-[23%]" /><col className="w-[14%]" /><col /><col className="w-[8%]" />
        </colgroup>
        <thead ref={cabeza}>
          <tr aria-rowindex={ventana ? 1 : undefined}>
            {COLUMNAS.map((c) => (
              <th key={c} scope="col" className="sticky top-0 z-[2] border-r border-b border-fila-sep bg-fila-maestro-bg px-2.5 last:border-r-0 py-1.5 text-left text-[12px] font-bold has-[[data-activo]]:bg-[#dbe6fb]">{c}{filtros?.[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody ref={aMedir}>
          {filas.length === 0 && vacio && <tr><td colSpan={COLUMNAS.length} className="p-4 text-[12px] text-azul-gris">{vacio}</td></tr>}
          {cuerpo}
        </tbody>
      </table>
    </div>
  )
}
