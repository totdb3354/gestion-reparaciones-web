import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError, StaleDataError } from '@/shared/api/errors'
import { descargarCsv } from '@/shared/lib/csv'
import { abrirNuevoOtroPedido, abrirNuevoPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import { useStore } from '@/shared/lib/store'
import { useInteraccionesAbiertas } from '@/shared/lib/useInteraccionesAbiertas'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { Input } from '@/shared/ui/input'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { RangoFechas } from '@/shared/ui/RangoFechas'
import { TogglePill } from '@/shared/ui/TogglePill'
import { ultimaRutaStock } from '../estado'
import { useProveedoresComponentes } from '../proveedores/api'
import { useCompras, useComprasOtros, useTransicionPedido, type AccionTransicion } from './api'
import { CantidadDialog } from './CantidadDialog'
import { CABECERAS_CSV_OTROS, CABECERAS_CSV_PEDIDOS, claseFilaPedido, crearColumnasOtros, crearColumnasPedidos, filaCsvOtro, filaCsvPedido } from './columnas'
import { confirmacionDe } from './confirmaciones'
import { filtrosPedidos, seleccionPedidos } from './estado'
import { aplicarFiltrosPedidos, FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock } from './filtros'
import { MenuPedido } from './MenuPedido'
import { chipDeEstado, entradasMenu, ESTADOS_PEDIDO, idPedido, type AccionMenu, type EstadoPedido, type Pedido, type TipoPedido } from './reglas'

/** mostrarConflicto() de StockController :1929-1933. */
const MSG_MODIFICADO = 'Este pedido fue modificado por otro usuario. Los datos se han recargado.'
const OPCIONES_TOGGLE = [
  { to: '/stock/pedidos', etiqueta: 'Componentes' },
  { to: '/stock/pedidos/otros', etiqueta: 'Otros' },
]
const RUTA: Record<TipoPedido, string> = { componentes: '/stock/pedidos', otros: '/stock/pedidos/otros' }

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
 *  la tabla del toggle visible, menú de transiciones (SUPERTECNICO), CSV y "Actualizado". */
export function PedidosPage({ tipo }: { tipo: TipoPedido }) {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const navigate = useNavigate()
  const location = useLocation()
  const { mostrarError } = useAlerta()
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

  // Sondeo congelado con un menú, un desplegable, un diálogo, un editor o el formulario de alta abiertos (spec §7-§8, D4).
  const activo = !hayAlguna && formulario === null
  const compras = useCompras({ activo: activo && tipo === 'componentes', habilitada: tipo === 'componentes' })
  const otros = useComprasOtros({ activo: activo && tipo === 'otros', habilitada: tipo === 'otros' })
  // Proveedores del filtro: la misma consulta que la pestaña Proveedores; aquí no sondea.
  const proveedores = useProveedoresComponentes({ activo: false })
  const transicion = useTransicionPedido(tipo)

  // Última pestaña de Stock para el botón de la barra superior (caché de vista del JavaFX, S2).
  useEffect(() => { ultimaRutaStock.set(RUTA[tipo]) }, [tipo])
  const hayModal = dialogoCantidad !== null || confirmar !== null || editando !== null
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
  const datos: Pedido[] | undefined = tipo === 'componentes' ? compras.data : otros.data
  useEffect(() => {
    if (!primeraPendiente.current || datos === undefined) return
    primeraPendiente.current = false
    // Se filtra con el store (no con `filtros` del render): si los datos ya estaban en caché, este efecto corre en el mismo
    // commit que el de arriba, antes de que el render vea los filtros nuevos.
    const primera = aplicarFiltrosPedidos(datos, filtrosPedidos.get())[0]
    if (!primera) return
    setSeleccionada(String(idPedido(primera)))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pide a la tabla desplazarse a la fila recién elegida (select + scrollTo del JavaFX)
    setPeticionDesplazamiento((n) => n + 1)
  }, [datos, setSeleccionada])

  const irAStock = useCallback((p: CompraComponente) => navigate(`/stock?componente=${p.idCom}`), [navigate])
  const columnasPedidos = useMemo(() => crearColumnasPedidos({ onComponente: irAStock }), [irAStock])
  const columnasOtros = useMemo(() => crearColumnasOtros(), [])
  const visiblesCompras = useMemo(() => aplicarFiltrosPedidos(compras.data ?? [], filtros), [compras.data, filtros])
  const visiblesOtros = useMemo(() => aplicarFiltrosPedidos(otros.data ?? [], filtros), [otros.data, filtros])
  // Calco de :1729-1751: el filtro Proveedor solo ofrece los activos.
  const activos = useMemo(() => (proveedores.data ?? []).filter((p) => p.activo), [proveedores.data])

  // Calco de exportarPedidos/exportarOtros (:1961-2006): la tabla visible, filtrada y en el orden mostrado.
  useRegistrarExportable(() => {
    if (tipo === 'componentes') descargarCsv('pedidos', CABECERAS_CSV_PEDIDOS, visiblesCompras.map(filaCsvPedido))
    else descargarCsv('pedidos_otros', CABECERAS_CSV_OTROS, visiblesOtros.map(filaCsvOtro))
  })

  /** 409 → aviso genérico, salvo desrecibir, que enseña el mensaje del servidor (stock insuficiente o estado, :1635). Lo que
   *  gestiona el mecanismo global (401, sin conexión) no se repite. La recarga la hace el onSettled de la mutación. */
  function avisarFallo(accion: AccionTransicion, e: unknown) {
    if (esErrorGestionadoGlobalmente(e)) return
    mostrarError(accion === 'desrecibir' ? mensajeDeError(e) : mensajeDeError(e, { staleData: MSG_MODIFICADO }))
  }

  function transicionar(accion: AccionTransicion, pedido: Pedido) {
    transicion.mutate({ accion, pedido }, { onError: (e) => avisarFallo(accion, e) })
  }

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
        // T17: editores
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

  // Menú solo para el SUPERTECNICO (:961-966); un cancelado no lleva menú (DataTable no envuelve la fila si devuelve null).
  const menuFila = puedeEditar
    ? (p: Pedido) => (entradasMenu(p.estado).length > 0 ? <MenuPedido pedido={p} onAccion={alElegir} onInteraccion={marcar} /> : null)
    : undefined
  const propsTabla = {
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
        {/* "Buscar componente…" también en Otros (calco, inventario §1). */}
        <Input value={filtros.buscador} onChange={(e) => setFiltros((f) => ({ ...f, buscador: e.target.value }))} placeholder="Buscar componente…" className="w-[180px] bg-superficie" />
        <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onChange={(desde, hasta) => setFiltros((f) => ({ ...f, desde, hasta }))} />
        {/* No toca el toggle ni la selección (:270-278). */}
        <BotonSecundario onClick={() => setFiltros({ ...FILTROS_PEDIDOS_VACIOS, estados: new Set(), proveedores: new Set() })}>Limpiar filtros</BotonSecundario>
        {puedeEditar &&
          (tipo === 'componentes' ? (
            <BotonPrimario className="ml-6" onClick={() => abrirNuevoPedido({ modo: 'vacio' })}>Nuevo pedido</BotonPrimario>
          ) : (
            <BotonPrimario className="ml-6" onClick={() => abrirNuevoOtroPedido()}>Nuevo otro pedido</BotonPrimario>
          ))}
      </div>
      {tipo === 'componentes' ? (
        <DataTable<CompraComponente> columns={columnasPedidos} data={visiblesCompras} vacio="Sin pedidos" {...propsTabla} />
      ) : (
        <DataTable<CompraOtro> columns={columnasOtros} data={visiblesOtros} vacio="Sin otros pedidos" {...propsTabla} />
      )}
      {/* P7: recarga la tabla visible (el JavaFX recarga siempre la de componentes). */}
      <EtiquetaActualizado
        actualizadoEn={tipo === 'componentes' ? compras.dataUpdatedAt : otros.dataUpdatedAt}
        onRecargar={() => (tipo === 'componentes' ? compras.refetch({ throwOnError: true }) : otros.refetch({ throwOnError: true }))}
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
    </div>
  )
}
