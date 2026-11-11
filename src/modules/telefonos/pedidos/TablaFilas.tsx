import { memo, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual'
import type { FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { CeldaImei } from './CeldaImei'
import { useStore } from '@/shared/lib/store'
import { estadoPedidos } from './estado'
import { CLASE_TONO, COLUMNAS, detalleEnvio, estadoDe, tonoFila, type EstadoFila } from './filas'

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
  fila: FilaVista; abierta: boolean; marcada: boolean; elegida: boolean
  onAbrir: (idFila: number, abrir: boolean) => void
  /** Pulsar la fila (fuera de la celda del IMEI): abre su panel, cambia de fila o lo cierra. */
  onElegir: (idFila: number) => void
}

const SOMBRA_RAYA = 'shadow-[inset_4px_0_0_#2f6fe0]'
const SOMBRA_ELEGIDA = 'shadow-[inset_0_1px_0_#2f6fe0,inset_0_-1px_0_#2f6fe0]'
const SOMBRA_AMBAS = 'shadow-[inset_4px_0_0_#2f6fe0,inset_0_1px_0_#2f6fe0,inset_0_-1px_0_#2f6fe0]'
const ETIQUETA = 'inline-block rounded-lg px-2 py-px text-[11px] font-bold'
const COLOR_ETIQUETA: Record<EstadoFila, string> = {
  PENDIENTE: 'border border-dashed border-[#C8CDD5] bg-superficie text-azul-gris',
  ENVIADA: 'bg-fila-reparado-bg text-[#2f7d3b]',
  NO_PENDIENTE: 'bg-[#dbe6fb] text-[#1d3a78]',
  HISTORICO: 'bg-[#eceef2] text-[#6b7482]',
}

/** El estado de la fila como etiqueta con texto (el color nunca es la única señal). En las enviadas, tras ella van el transportista
 *  y el seguimiento, visibles sin esperar al ratón. */
export function EtiquetaEstado({ fila: f, estado, conDetalle = true }: { fila: FilaVista; estado: EstadoFila; conDetalle?: boolean }) {
  const detalle = conDetalle && estado === 'ENVIADA' ? detalleEnvio(f, ' ') : undefined
  const texto = {
    PENDIENTE: 'Pendiente',
    ENVIADA: f.envioFecha ? `Enviado ${dia(f.envioFecha).slice(0, 5)}` : 'Enviado',
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

/** Una fila de la hoja. Con ~1.500 filas, abrir una celda o recibir un sondeo no debe repintarlas todas: `memo` la deja quieta si
 *  su `fila` (TanStack conserva los objetos que no cambian), su `abierta`, su `marcada` y su `elegida` son los mismos. Las fechas se dan formato aquí dentro. */
export const FilaTabla = memo(function FilaTabla({ fila: f, abierta, marcada, elegida, onAbrir, onElegir }: PropsFila) {
  const tono = tonoFila(f)
  const td = cn('h-8 border-r border-b border-form-fila-brd px-2.5 py-1 whitespace-nowrap', tono && CLASE_TONO[tono])
  const estado = estadoDe(f)
  // Los bordes de la fila elegida (panel) y la raya azul de la última celda abierta comparten la sombra de la primera celda.
  // Clases escritas enteras (Tailwind no ve las que se montan con plantillas).
  const sombra = marcada ? (elegida ? SOMBRA_AMBAS : SOMBRA_RAYA) : elegida ? SOMBRA_ELEGIDA : undefined
  const bordes = elegida ? SOMBRA_ELEGIDA : undefined
  return (
    // Un clic en cualquier celda menos la del IMEI elige la fila. Se comprueba en el DOM (el desplegable del IMEI sube por React
    // desde su portal, pero no está dentro de la fila).
    <tr data-estado={estado} data-aqui={marcada || undefined} data-elegida={elegida || undefined}
      onClick={(ev) => {
        const celda = (ev.target as Element).closest('td')
        if (celda && ev.currentTarget.contains(celda) && !celda.hasAttribute('data-imei')) onElegir(f.idFila)
      }}>
      {/* La raya azul del borde izquierdo: la última fila cuya celda de IMEI se abrió. */}
      <td className={cn(td, sombra)}>{dia(f.fecha)}</td>
      <td className={cn(td, bordes)}>{f.plataforma}</td>
      <td className={cn(td, bordes, 'font-mono text-[12px]')}>{f.sku}</td>
      <CeldaImei fila={f} abierta={abierta} marcada={marcada} elegida={elegida} onAbrir={onAbrir} />
      <td className={cn(td, bordes)}>
        {/* El botón es la forma de elegir la fila con teclado. */}
        <button type="button" aria-pressed={elegida} title="Ver el detalle del pedido" className="cursor-pointer bg-transparent p-0 text-left">{f.pedido}</button>
      </td>
      <td className={cn(td, bordes)} title={estado === 'ENVIADA' ? detalleEnvio(f) : undefined}><EtiquetaEstado fila={f} estado={estado} /></td>
      <td className={cn(td, bordes)}>{dia(f.fechaCompra)}</td>
    </tr>
  )
})

/** La hoja de pedidos (spec «Pedidos como la hoja» §3): una fila por pedido en el orden recibido, cabecera fija, el estado como etiqueta
 *  en «Enviado» y solo el histórico en gris. La última celda de IMEI abierta deja su fila con una raya azul. Al montar baja al final; al llegar filas nuevas baja solo si el usuario ya estaba abajo. Solo una celda de IMEI abierta. */
export function TablaFilas({ filas, recibidas = filas.length, filtros, vacio, ventana = false }: {
  filas: FilaVista[]
  /** Modo «muchas filas»: solo se pintan las filas visibles (más un margen); la barra de scroll abarca todas. Lo decide la página por el umbral. */
  ventana?: boolean
  /** Cuántas filas ha recibido la página (sin filtrar por columna): solo llegar filas nuevas baja al final, no filtrar. */
  recibidas?: number
  filtros?: Partial<Record<Columna, ReactNode>>
  /** Lo que se enseña en el cuerpo si no hay filas que pintar (la cabecera y sus filtros siguen). */
  vacio?: ReactNode
}) {
  const [abierta, setAbierta] = useState<number | null>(null)
  // Si la fila abierta ya no se pinta (un filtro la esconde) o ya no se puede editar, se cierra: así no se reabre sola al quitar el filtro.
  if (abierta !== null && !filas.some((f) => f.idFila === abierta && f.editable)) setAbierta(null)
  // Estable (para el `memo` de las filas). Cerrar una celda que ya no es la abierta no hace nada: el cierre tardío de la anterior
  // (foco, clic fuera) no puede cerrar la que acaba de abrirse.
  const cambiar = useCallback((id: number, abrir: boolean) => {
    setAbierta((a) => (abrir ? id : a === id ? null : a))
    if (abrir) estadoPedidos.set((s) => (s.ultimaAbierta === id ? s : { ...s, ultimaAbierta: id }))
  }, [])
  const elegir = useCallback((id: number) => estadoPedidos.set((s) => ({ ...s, filaElegida: s.filaElegida === id ? null : id })), [])
  const [{ ultimaAbierta, filaElegida }] = useStore(estadoPedidos)
  const contenedor = useRef<HTMLDivElement>(null)
  // La altura que tenía el contenido tras el último pintado. Añadir filas no cambia `scrollTop` pero sí la altura, así que
  // «estaba abajo» se calcula justo antes de decidir con la altura de entonces, no con un valor guardado en un scroll antiguo.
  const alturaPrevia = useRef<number | null>(null)
  const vistas = useRef(0)
  const modoPrevio = useRef(ventana)
  // Alto real de una fila, medido en la primera pintada (con 1 px de diferencia por borde el scroll se descuadraría a las 20.000 filas).
  const [alto, setAlto] = useState(ALTO_FILA)
  const virtualizador = useVirtualizer({
    count: ventana ? filas.length : 0,
    getScrollElement: () => contenedor.current,
    estimateSize: () => alto,
    overscan: FILAS_DE_MARGEN,
    enabled: ventana,
    getItemKey: (i) => filas[i]?.idFila ?? i,
    initialRect: RECT_DE_RESERVA,
    observeElementRect: (v, cb) => observeElementRect(v, (r) => cb(r.height > 0 ? r : RECT_DE_RESERVA)),
  })
  const items = ventana ? virtualizador.getVirtualItems() : []
  const hueco = ventana && items.length > 0
    ? { arriba: items[0].start, abajo: Math.max(0, virtualizador.getTotalSize() - items[items.length - 1].end) }
    : { arriba: 0, abajo: 0 }
  const aMedir = useRef<HTMLTableSectionElement>(null)
  useLayoutEffect(() => {
    if (!ventana) return
    const h = aMedir.current?.querySelector<HTMLElement>('tr[data-estado]')?.offsetHeight ?? 0
    if (h > 0 && Math.abs(h - alto) >= 0.5) { setAlto(h); virtualizador.measure() }
  })

  // En cada pintado: «estaba abajo» se calcula con la altura del pintado anterior (filtrar cambia la altura sin que el usuario se mueva).
  useLayoutEffect(() => {
    const c = contenedor.current
    if (!c) return
    const estabaAbajo = alturaPrevia.current === null || alturaPrevia.current - c.scrollTop - c.clientHeight < 8
    // Cruzar el umbral por un filtro: quien estaba abajo sigue abajo; si no, el scroll en píxeles se queda (las filas miden lo mismo).
    const cambioModo = modoPrevio.current !== ventana
    if ((recibidas > vistas.current || cambioModo) && estabaAbajo) c.scrollTop = c.scrollHeight
    modoPrevio.current = ventana
    vistas.current = recibidas
    alturaPrevia.current = c.scrollHeight
  })

  return (
    <div ref={contenedor} role="region" aria-label="Tabla de pedidos" className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-borde-input bg-superficie">
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <thead>
          <tr>
            {COLUMNAS.map((c) => (
              <th key={c} scope="col" className="sticky top-0 z-[2] border-r border-b border-fila-sep bg-fila-maestro-bg px-2.5 py-1.5 text-left text-[12px] font-bold has-[[data-activo]]:bg-[#dbe6fb]">{c}{filtros?.[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody ref={aMedir}>
          {filas.length === 0 && vacio && <tr><td colSpan={COLUMNAS.length} className="p-4 text-[12px] text-azul-gris">{vacio}</td></tr>}
          {hueco.arriba > 0 && <tr aria-hidden="true"><td colSpan={COLUMNAS.length} style={{ height: hueco.arriba, padding: 0, border: 0 }} /></tr>}
          {(ventana ? items.map((it) => filas[it.index]).filter(Boolean) : filas).map((f) => <FilaTabla key={f.idFila} fila={f} abierta={abierta === f.idFila} marcada={ultimaAbierta === f.idFila} elegida={filaElegida === f.idFila} onAbrir={cambiar} onElegir={elegir} />)}
          {hueco.abajo > 0 && <tr aria-hidden="true"><td colSpan={COLUMNAS.length} style={{ height: hueco.abajo, padding: 0, border: 0 }} /></tr>}
        </tbody>
      </table>
    </div>
  )
}
