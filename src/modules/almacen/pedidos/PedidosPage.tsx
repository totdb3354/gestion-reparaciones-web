import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError, StaleDataError } from '@/shared/api/errors'
import { descargarCsv } from '@/shared/lib/csv'
import { abrirNuevoOtroPedido, abrirNuevoPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import { useStore } from '@/shared/lib/store'
import { useInteraccionesAbiertas } from '@/shared/lib/useInteraccionesAbiertas'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable, type GruposTabla } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { Input } from '@/shared/ui/input'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { RangoFechas } from '@/shared/ui/RangoFechas'
import { TogglePill } from '@/shared/ui/TogglePill'
import { ultimaRutaStock } from '../estado'
import { useProveedoresComponentes } from '../proveedores/api'
import { useCompras, useComprasOtros, useMoverLinea, useTransicionPedido, type AccionBloque, type AccionTransicion } from './api'
import { AccionBloqueDialog } from './bloques/AccionBloqueDialog'
import { CabeceraBloque } from './bloques/CabeceraBloque'
import { JuntarDialog } from './bloques/JuntarDialog'
import { BotonMenuBloque, MenuBloqueContextual } from './bloques/MenuBloque'
import { NotaBloqueDialog } from './bloques/NotaBloqueDialog'
import {
  agruparEnBloques, claveBloque, destinosMover, entradasMenuBloque, estaDesplegado, estaSola, ordenarPorBloques, sePuedeMover, vivosDelProveedor,
  SIN_BLOQUE, textoMoverYaPedida, type AccionMenuBloque, type Bloque,
} from './bloques/reglas'
import { SepararDialog } from './bloques/SepararDialog'
import { CantidadDialog } from './CantidadDialog'
import { CABECERAS_CSV_OTROS, CABECERAS_CSV_PEDIDOS, claseFilaPedido, crearColumnasOtros, crearColumnasPedidos, filaCsvOtro, filaCsvPedido } from './columnas'
import { confirmacionDe } from './confirmaciones'
import { filtrosPedidos, plegadoBloques, seleccionPedidos } from './estado'
import { aplicarFiltrosPedidos, FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock, firmaFiltros, hayFiltros } from './filtros'
import { EditarOtroPedidoDialog } from './formulario/EditarOtroPedidoDialog'
import { EditarPedidoDialog } from './formulario/EditarPedidoDialog'
import { staleDataDe } from './formulario/errores'
import { MenuPedido } from './MenuPedido'
import { guardarAgrupar, leerAgrupar } from './preferencias'
import { chipDeEstado, entradasMenu, esCompra, ESTADOS_PEDIDO, idPedido, type AccionMenu, type EstadoPedido, type Pedido, type TipoPedido } from './reglas'

/** mostrarConflicto() de StockController :1929-1933. */
const MSG_MODIFICADO = 'Este pedido fue modificado por otro usuario. Los datos se han recargado.'
const OPCIONES_TOGGLE = [
  { to: '/stock/pedidos', etiqueta: 'Componentes' },
  { to: '/stock/pedidos/otros', etiqueta: 'Otros' },
]
const RUTA: Record<TipoPedido, string> = { componentes: '/stock/pedidos', otros: '/stock/pedidos/otros' }
/** Mapa vacío estable (0.9.9): con filtros nuevos, nada plegado a mano. */
const SIN_PLEGADOS: Record<string, boolean> = {}

type AccionDirecta = 'confirmar' | 'recibido' | 'cerrarSinResto'
type AccionConfirmada = 'cancelar' | 'borrar' | 'revertir'
/** Entrada del menú → endpoint (inventario §7.1). */
const TRANSICION: Record<AccionDirecta | AccionConfirmada, AccionTransicion> = {
  confirmar: 'confirmar',
  recibido: 'confirmar-recibido',
  cerrarSinResto: 'confirmar-alterado',
  cancelar: 'cancelar',
  borrar: 'borrar',
  revertir: 'desrecibir',
}

type DialogoCantidad = { modo: 'parcial' | 'resto'; pedido: Pedido } | null
type Confirmar = { accion: AccionConfirmada; pedido: Pedido } | null

/** Pestaña "Pedidos" de StockView.fxml (spec 4b §6): toggle Componentes | Otros por rutas (P4), cuatro filtros compartidos,
 *  la tabla del toggle visible, menú de transiciones (SUPERTECNICO), CSV y "Actualizado". 0.9.9: Componentes agrupada
 *  por bloques (spec «Pedidos por bloques» §6), con interruptor a la vista plana. */
export function PedidosPage({ tipo }: { tipo: TipoPedido }) {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const navigate = useNavigate()
  const location = useLocation()
  const { mostrarError, mostrarAviso } = useAlerta()
  const { hayAlguna, marcar } = useInteraccionesAbiertas()
  const [formulario] = useStore(formularioPedido)
  const [filtros, setFiltros] = useStore(filtrosPedidos)
  const [seleccionada, setSeleccionada] = useStore(seleccionPedidos[tipo])
  const [dialogoCantidad, setDialogoCantidad] = useState<DialogoCantidad>(null)
  const [confirmar, setConfirmar] = useState<Confirmar>(null)
  // T17: editores (EditarPedidoDialog / EditarOtroPedidoDialog se pintan con este estado; ya congela el sondeo)
  const [editando, setEditando] = useState<Pedido | null>(null)
  // Texto de un 422 del servidor para el diálogo de cantidad abierto (spec §8): se pinta dentro, que sigue abierto.
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [peticionDesplazamiento, setPeticionDesplazamiento] = useState(0)
  // 0.9.9: bloques (spec «Pedidos por bloques» §6).
  const componentes = tipo === 'componentes'
  const [agrupar, setAgrupar] = useState(leerAgrupar)
  const vistaAgrupada = componentes && agrupar
  const [plegado, setPlegado] = useStore(plegadoBloques)
  const [accionBloque, setAccionBloque] = useState<{ bloque: Bloque; accion: AccionBloque } | null>(null)
  const [separando, setSeparando] = useState<Bloque | null>(null)
  const [juntando, setJuntando] = useState<Bloque | null>(null)
  const [notaDe, setNotaDe] = useState<Bloque | null>(null)
  const [moverConfirmar, setMoverConfirmar] = useState<{ pedido: CompraComponente; idBloque: number | null } | null>(null)

  // Sondeo congelado con un menú, un desplegable, un diálogo, un editor o el formulario de alta abiertos (spec §7-§8, D4).
  const activo = !hayAlguna && formulario === null
  const compras = useCompras({ activo: activo && componentes, habilitada: componentes })
  const otros = useComprasOtros({ activo: activo && tipo === 'otros', habilitada: tipo === 'otros' })
  // Proveedores del filtro: la misma consulta que la pestaña Proveedores; aquí no sondea.
  const proveedores = useProveedoresComponentes({ activo: false })
  const transicion = useTransicionPedido(tipo)
  const mover = useMoverLinea()

  // Última pestaña de Stock para el botón de la barra superior (caché de vista del JavaFX, S2).
  useEffect(() => { ultimaRutaStock.set(RUTA[tipo]) }, [tipo])
  const hayModal = dialogoCantidad !== null || confirmar !== null || editando !== null || accionBloque !== null || separando !== null
    || juntando !== null || notaDe !== null || moverConfirmar !== null
  useEffect(() => {
    if (!hayModal) return
    marcar(true)
    return () => marcar(false)
  }, [hayModal, marcar])

  // Llegada desde "En Camino" de Stock (S8, navegarAPedidosDeComponente :217-231): los parámetros se leen una vez al montar,
  // se aplican al store (proveedor y fechas intactos), se limpia la URL con replace y, en cuanto hay datos, se selecciona la
  // primera fila filtrada y se desplaza a ella. Los refs evitan repetirlo si el efecto vuelve a correr.
  const [llegada] = useState(() => filtrosDesdeStock(new URLSearchParams(location.search)))
  const llegadaAplicada = useRef(false)
  const primeraPendiente = useRef(llegada !== null)
  useEffect(() => {
    if (llegada === null || llegadaAplicada.current) return
    llegadaAplicada.current = true
    filtrosPedidos.set((f) => ({ ...f, ...llegada }))
    navigate(location.pathname, { replace: true })
  }, [llegada, navigate, location.pathname])
  const datos: Pedido[] | undefined = componentes ? compras.data : otros.data
  useEffect(() => {
    if (!primeraPendiente.current || datos === undefined) return
    primeraPendiente.current = false
    // Se filtra con el store (no con `filtros` del render): si los datos ya estaban en caché, este efecto corre en el mismo
    // commit que el de arriba, antes de que el render vea los filtros nuevos.
    const actuales = filtrosPedidos.get()
    const primera = aplicarFiltrosPedidos(datos, actuales)[0]
    if (!primera) return
    // 0.9.9: el bloque de la línea elegida, desplegado.
    if (esCompra(primera)) {
      const firmaLlegada = firmaFiltros(actuales)
      plegadoBloques.set((p) => ({
        ...p,
        filtrado: { firma: firmaLlegada, mapa: { ...(p.filtrado.firma === firmaLlegada ? p.filtrado.mapa : {}), [claveBloque(primera)]: true } },
      }))
    }
    setSeleccionada(String(idPedido(primera)))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pide a la tabla desplazarse a la fila recién elegida (select + scrollTo del JavaFX)
    setPeticionDesplazamiento((n) => n + 1)
  }, [datos, setSeleccionada])

  const irAStock = useCallback((p: CompraComponente) => navigate(`/stock?componente=${p.idCom}`), [navigate])
  const columnasPedidos = useMemo(() => crearColumnasPedidos({ onComponente: irAStock, vista: vistaAgrupada ? 'agrupada' : 'plana' }), [irAStock, vistaAgrupada])
  const columnasOtros = useMemo(() => crearColumnasOtros(), [])
  const bloques = useMemo(() => agruparEnBloques(compras.data ?? []), [compras.data])
  const visiblesCompras = useMemo(() => {
    const filtradas = aplicarFiltrosPedidos(compras.data ?? [], filtros)
    return vistaAgrupada ? ordenarPorBloques(filtradas, bloques) : filtradas
  }, [compras.data, filtros, vistaAgrupada, bloques])
  const visiblesOtros = useMemo(() => aplicarFiltrosPedidos(otros.data ?? [], filtros), [otros.data, filtros])
  // Calco de :1729-1751: el filtro Proveedor solo ofrece los activos.
  const activos = useMemo(() => (proveedores.data ?? []).filter((p) => p.activo), [proveedores.data])

  // Calco de exportarPedidos/exportarOtros (:1961-2006): la tabla visible, filtrada y en el orden mostrado.
  useRegistrarExportable(() => {
    if (componentes) descargarCsv('pedidos', CABECERAS_CSV_PEDIDOS, visiblesCompras.map(filaCsvPedido))
    else descargarCsv('pedidos_otros', CABECERAS_CSV_OTROS, visiblesOtros.map(filaCsvOtro))
  })

  // ── 0.9.9: plegado ─────────────────────────────────────────────────────────────────────────────────────────────
  const conFiltros = hayFiltros(filtros)
  const firma = firmaFiltros(filtros)
  const mapaPlegado = conFiltros ? (plegado.filtrado.firma === firma ? plegado.filtrado.mapa : SIN_PLEGADOS) : plegado.normal
  const desplegado = useCallback((clave: string) => {
    const b = bloques.get(clave)
    return b === undefined || estaDesplegado(b, conFiltros, mapaPlegado)
  }, [bloques, conFiltros, mapaPlegado])
  const fijarPlegado = useCallback((cambios: Record<string, boolean>) => {
    setPlegado((p) => (conFiltros
      ? { ...p, filtrado: { firma, mapa: { ...(p.filtrado.firma === firma ? p.filtrado.mapa : {}), ...cambios } } }
      : { ...p, normal: { ...p.normal, ...cambios } }))
  }, [setPlegado, conFiltros, firma])
  const clavesVisibles = [...new Set(visiblesCompras.map(claveBloque))]
  const hayDesplegado = clavesVisibles.some(desplegado)
  function alternarTodos() {
    fijarPlegado(Object.fromEntries(clavesVisibles.map((c) => [c, !hayDesplegado])))
  }
  function alternarAgrupar() {
    setAgrupar(!agrupar)
    guardarAgrupar(!agrupar)
  }

  /** 409 → aviso genérico, salvo desrecibir, que enseña el mensaje del servidor (stock insuficiente o estado, :1635). Lo que
   *  gestiona el mecanismo global (401, sin conexión) no se repite. La recarga la hace el onSettled de la mutación.
   *  Un 409 es un conflicto de concurrencia, no un fallo: se avisa como "Advertencia" (Alert WARNING de
   *  StockController.mostrarConflicto :1851), calco del JavaFX. El resto de errores sigue como "Error". */
  function avisarFallo(accion: AccionTransicion | 'mover', e: unknown) {
    if (esErrorGestionadoGlobalmente(e)) return
    const mensaje = accion === 'desrecibir' ? mensajeDeError(e) : mensajeDeError(e, { staleData: staleDataDe(e, MSG_MODIFICADO) })
    if (e instanceof StaleDataError) mostrarAviso('Advertencia', mensaje)
    else mostrarError(mensaje)
  }

  function transicionar(accion: AccionTransicion, pedido: Pedido) {
    transicion.mutate({ accion, pedido }, { onError: (e) => avisarFallo(accion, e) })
  }

  // ── 0.9.9: mover y acciones de bloque ──────────────────────────────────────────────────────────────────────────
  function moverAhora(pedido: CompraComponente, idBloque: number | null) {
    mover.mutate({ pedido, idBloque }, { onError: (e) => avisarFallo('mover', e) })
  }
  /** Pendiente: sin preguntar. Ya pedida: «Mover línea ya pedida» (spec §6.4). */
  function pedirMover(pedido: CompraComponente, idBloque: number | null) {
    if (pedido.estado === 'pendiente') moverAhora(pedido, idBloque)
    else setMoverConfirmar({ pedido, idBloque })
  }
  const alElegirBloque = useCallback((accion: AccionMenuBloque, b: Bloque) => {
    switch (accion) {
      case 'confirmar':
      case 'recibir':
      case 'cancelar':
      case 'borrar':
        setAccionBloque({ bloque: b, accion })
        return
      case 'anadir':
        abrirNuevoPedido({ modo: 'bloque', idBloque: b.idBloque as number, idProv: b.idProv })
        return
      case 'prevision':
        abrirNuevoPedido({ modo: 'bloque', idBloque: b.idBloque as number, idProv: b.idProv, prevision: true })
        return
      case 'separar':
        setSeparando(b)
        return
      case 'juntar':
        setJuntando(b)
        return
      case 'nota':
        setNotaDe(b)
        return
    }
  }, [])
  // Memoizado: DataTable recalcula los grupos solo si cambia su identidad (doc de GruposTabla).
  const grupos = useMemo<GruposTabla<CompraComponente> | undefined>(() => {
    if (!vistaAgrupada) return undefined
    const entradasDe = (b: Bloque) => entradasMenuBloque(b, vivosDelProveedor(bloques, b.idProv, b.clave).length)
    const conMenuBloque = (b: Bloque | undefined): b is Bloque => puedeEditar && b !== undefined && b.clave !== SIN_BLOQUE
    return {
      clave: claveBloque,
      desplegado,
      cabecera: (clave, filas) => {
        const b = bloques.get(clave)
        if (b === undefined) return null
        return (
          <CabeceraBloque bloque={b} visibles={filas.length} desplegado={desplegado(clave)} onAlternar={() => fijarPlegado({ [clave]: !desplegado(clave) })}
            menu={conMenuBloque(b) ? <BotonMenuBloque idBloque={b.idBloque as number} entradas={entradasDe(b)} onAccion={(a) => alElegirBloque(a, b)} onInteraccion={marcar} /> : undefined} />
        )
      },
      menuCabecera: (clave) => {
        const b = bloques.get(clave)
        return conMenuBloque(b) ? <MenuBloqueContextual entradas={entradasDe(b)} onAccion={(a) => alElegirBloque(a, b)} onInteraccion={marcar} /> : null
      },
    }
  }, [vistaAgrupada, bloques, puedeEditar, desplegado, fijarPlegado, alElegirBloque, marcar])

  function alElegir(accion: AccionMenu, pedido: Pedido) {
    switch (accion) {
      case 'confirmar':
      case 'recibido':
      case 'cerrarSinResto':
        transicionar(TRANSICION[accion], pedido)
        return
      case 'parcial':
      case 'resto':
        setErrorServidor(null)
        setDialogoCantidad({ modo: accion, pedido })
        return
      case 'cancelar':
      case 'borrar':
      case 'revertir':
        setConfirmar({ accion, pedido })
        return
      case 'editar':
        setEditando(pedido)
        return
    }
  }

  function cerrarCantidad() {
    setDialogoCantidad(null)
    setErrorServidor(null)
  }

  /** 422 → inline con el diálogo abierto; 409 → se cierra y avisa; otro error → diálogo abierto y aviso (patrón de Stock). */
  function confirmarCantidad(valor: number) {
    if (!dialogoCantidad) return
    const { modo, pedido } = dialogoCantidad
    const accion: AccionTransicion = modo === 'parcial' ? 'confirmar-parcial' : 'recibir-resto'
    setErrorServidor(null)
    transicion.mutate({ accion, pedido, cantidad: valor }, {
      onSuccess: cerrarCantidad,
      onError: (e) => {
        if (e instanceof ReglaNegocioError) { setErrorServidor(e.message); return }
        if (e instanceof StaleDataError) cerrarCantidad()
        avisarFallo(accion, e)
      },
    })
  }

  function confirmarAccion() {
    if (!confirmar) return
    const { accion, pedido } = confirmar
    setConfirmar(null)
    transicionar(TRANSICION[accion], pedido)
  }

  // Menú solo para el SUPERTECNICO (:961-966). Un cancelado no lleva menú (y desde 2026-10-12 tampoco «Mover a bloque»: solo se mueven líneas vivas).
  const menuFila = puedeEditar
    ? (p: Pedido) => {
        const mov = esCompra(p) && sePuedeMover(p)
          ? { destinos: destinosMover(p, bloques), sola: estaSola(p, bloques), onMover: (idBloque: number | null) => pedirMover(p, idBloque) }
          : undefined
        return entradasMenu(p.estado).length > 0 || mov ? <MenuPedido pedido={p} onAccion={alElegir} onInteraccion={marcar} mover={mov} /> : null
      }
    : undefined
  const propsTabla = {
    ajuste: 'fluido' as const,
    getRowId: (p: Pedido) => String(idPedido(p)),
    filaClase: claseFilaPedido,
    seleccionada,
    onSeleccionar: setSeleccionada,
    pedirDesplazamiento: peticionDesplazamiento,
    menuFila,
  }
  const textosConfirmar = confirmar ? confirmacionDe(confirmar.accion, confirmar.pedido) : null

  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        <TogglePill opciones={OPCIONES_TOGGLE} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Calco del MenuButton "Estado" con CustomMenuItem (no cierra al marcar) y del MultiSelectComboBox de proveedores
            (140 px, StockView.fxml:122-126): abrirlos congela el refresco (onOpenChange → marcar). */}
        <MultiSelect
          opciones={ESTADOS_PEDIDO}
          clave={(e) => e}
          etiqueta={chipDeEstado}
          seleccion={filtros.estados}
          onChange={(s) => setFiltros((f) => ({ ...f, estados: s as Set<EstadoPedido> }))}
          textoVacio="Estado"
          textoPlural={(n) => `${n} estados`}
          onOpenChange={marcar}
          className="min-w-[140px]"
        />
        <MultiSelect
          opciones={activos}
          clave={(p) => p.nombre}
          etiqueta={(p) => p.nombre}
          seleccion={filtros.proveedores}
          onChange={(s) => setFiltros((f) => ({ ...f, proveedores: s }))}
          textoVacio="Proveedor"
          textoPlural={(n) => `${n} proveedores`}
          onOpenChange={marcar}
          className="min-w-[140px]"
        />
        {/* "Buscar componente…" también en Otros (calco, inventario §1); en Componentes, también el nº de bloque (0.9.9). */}
        <Input value={filtros.buscador} onChange={(e) => setFiltros((f) => ({ ...f, buscador: e.target.value }))}
          placeholder={componentes ? 'Buscar componente o nº de bloque…' : 'Buscar componente…'} className="w-[200px] bg-superficie" />
        <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onChange={(desde, hasta) => setFiltros((f) => ({ ...f, desde, hasta }))} />
        {/* No toca el toggle ni la selección (:270-278). */}
        <BotonSecundario onClick={() => setFiltros({ ...FILTROS_PEDIDOS_VACIOS, estados: new Set(), proveedores: new Set() })}>Limpiar filtros</BotonSecundario>
        {puedeEditar &&
          (componentes ? (
            <BotonPrimario className="ml-6" onClick={() => abrirNuevoPedido({ modo: 'vacio' })}>Nuevo pedido</BotonPrimario>
          ) : (
            <BotonPrimario className="ml-6" onClick={() => abrirNuevoOtroPedido()}>Nuevo otro pedido</BotonPrimario>
          ))}
        {componentes && (
          <>
            <span aria-hidden className="mx-1 h-[22px] w-px bg-fila-sep" />
            <button type="button" role="switch" aria-checked={agrupar} onClick={alternarAgrupar}
              className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-azul-medio">
              <span className={cn('relative h-[18px] w-[34px] rounded-full transition-colors', agrupar ? 'bg-verde-ok' : 'bg-pill-borde')}>
                <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-superficie transition-[left]', agrupar ? 'left-[18px]' : 'left-[2px]')} />
              </span>
              Agrupar por bloque
            </button>
            {agrupar && (
              <button type="button" onClick={alternarTodos} className="cursor-pointer text-[12px] font-bold text-texto-accion hover:underline">
                {hayDesplegado ? 'Plegar todo' : 'Desplegar todo'}
              </button>
            )}
          </>
        )}
      </div>
      {componentes ? (
        <DataTable<CompraComponente> columns={columnasPedidos} data={visiblesCompras} vacio="Sin pedidos" grupos={grupos} {...propsTabla} />
      ) : (
        <DataTable<CompraOtro> columns={columnasOtros} data={visiblesOtros} vacio="Sin otros pedidos" {...propsTabla} />
      )}
      {/* P7: recarga la tabla visible (el JavaFX recarga siempre la de componentes). */}
      <EtiquetaActualizado
        actualizadoEn={componentes ? compras.dataUpdatedAt : otros.dataUpdatedAt}
        onRecargar={() => (componentes ? compras.refetch({ throwOnError: true }) : otros.refetch({ throwOnError: true }))}
      />

      <CantidadDialog
        modo="parcial"
        pedido={dialogoCantidad?.modo === 'parcial' ? dialogoCantidad.pedido : null}
        errorServidor={errorServidor}
        enviando={transicion.isPending}
        onConfirmar={confirmarCantidad}
        onCancelar={cerrarCantidad}
      />
      <CantidadDialog
        modo="resto"
        pedido={dialogoCantidad?.modo === 'resto' ? dialogoCantidad.pedido : null}
        errorServidor={errorServidor}
        enviando={transicion.isPending}
        onConfirmar={confirmarCantidad}
        onCancelar={cerrarCantidad}
      />
      <ConfirmDialog
        abierto={confirmar !== null}
        titulo={textosConfirmar?.titulo ?? ''}
        descripcion={textosConfirmar?.descripcion ?? ''}
        textoAccion={textosConfirmar?.textoAccion ?? ''}
        onConfirmar={confirmarAccion}
        onCancelar={() => setConfirmar(null)}
      />
      <EditarPedidoDialog pedido={componentes && editando !== null && esCompra(editando) ? editando : null} onCerrar={() => setEditando(null)} />
      <EditarOtroPedidoDialog pedido={tipo === 'otros' && editando !== null && !esCompra(editando) ? editando : null} onCerrar={() => setEditando(null)} />

      {/* 0.9.9: bloques. Cada diálogo se monta solo mientras está abierto (empieza de cero en cada apertura). */}
      <ConfirmDialog
        abierto={moverConfirmar !== null}
        titulo="Mover línea ya pedida"
        descripcion={moverConfirmar ? textoMoverYaPedida(moverConfirmar.pedido, moverConfirmar.idBloque) : ''}
        textoAccion="Mover"
        onConfirmar={() => {
          if (moverConfirmar) moverAhora(moverConfirmar.pedido, moverConfirmar.idBloque)
          setMoverConfirmar(null)
        }}
        onCancelar={() => setMoverConfirmar(null)}
      />
      {accionBloque && <AccionBloqueDialog bloque={accionBloque.bloque} accion={accionBloque.accion} onCerrar={() => setAccionBloque(null)} />}
      {separando && <SepararDialog bloque={separando} onCerrar={() => setSeparando(null)} />}
      {juntando && (
        <JuntarDialog bloque={juntando} candidatos={vivosDelProveedor(bloques, juntando.idProv, juntando.clave)} onCerrar={() => setJuntando(null)} />
      )}
      {notaDe && <NotaBloqueDialog bloque={notaDe} onCerrar={() => setNotaDe(null)} />}
    </div>
  )
}
