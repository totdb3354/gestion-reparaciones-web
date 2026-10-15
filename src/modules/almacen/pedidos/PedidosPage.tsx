import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import type { CompraComponente } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError, StaleDataError } from '@/shared/api/errors'
import { descargarCsv } from '@/shared/lib/csv'
import { abrirNuevoPedido, formularioPedido } from '@/shared/lib/formularioPedido'
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
import { useProveedoresComponentes } from '../proveedores/api'
import { useLineasPedido, useMoverLinea, useTransicionPedido, type AccionBloque, type AccionTransicion } from './api'
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
import { CABECERAS_CSV_PEDIDOS, claseFilaPedido, crearColumnasPedidos, filaCsvPedido } from './columnas'
import { confirmacionDe } from './confirmaciones'
import { filtrosPedidos, plegadoBloques, seleccionPedidos } from './estado'
import { aplicarFiltrosPedidos, FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock, firmaFiltros, hayFiltros } from './filtros'
import { EditarOtroPedidoDialog } from './formulario/EditarOtroPedidoDialog'
import { EditarPedidoDialog } from './formulario/EditarPedidoDialog'
import { staleDataDe } from './formulario/errores'
import { MenuPedido } from './MenuPedido'
import { guardarAgrupar, leerAgrupar } from './preferencias'
import { chipDeEstado, claveLinea, entradasMenu, esCompra, ESTADOS_PEDIDO, type AccionMenu, type EstadoPedido, type Pedido } from './reglas'

/** mostrarConflicto() de StockController :1929-1933. */
const MSG_MODIFICADO = 'Este pedido fue modificado por otro usuario. Los datos se han recargado.'
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

/** 0.9.15 (spec «Añadir otro» §5.1): la página «Otros» ya no existe; su dirección abre Pedidos. */
export function RedirigirPedidosOtros() {
  return <Navigate to="/stock/pedidos" replace />
}

/** Pestaña "Pedidos" de StockView.fxml (spec 4b §6): filtros, la tabla, menú de transiciones (SUPERTECNICO), CSV y
 *  "Actualizado". 0.9.9: agrupada por bloques (spec «Pedidos por bloques» §6), con interruptor a la vista plana. 0.9.13: el
 *  menú del bloque lo ven todos; sin edición, solo con «Exportar bloque en CSV». 0.9.15 (spec «Añadir otro» §5.1): una
 *  sola lista con piezas y otros (fuera el toggle «Componentes | Otros» y «Nuevo otro pedido»), menú de
 *  fila de un otro con «Mover a bloque» y «Añadir otro…» en el menú del bloque. */
export function PedidosPage() {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const navigate = useNavigate()
  const location = useLocation()
  const { mostrarError, mostrarAviso } = useAlerta()
  const { hayAlguna, marcar } = useInteraccionesAbiertas()
  const [formulario] = useStore(formularioPedido)
  const [filtros, setFiltros] = useStore(filtrosPedidos)
  const [seleccionada, setSeleccionada] = useStore(seleccionPedidos)
  const [dialogoCantidad, setDialogoCantidad] = useState<DialogoCantidad>(null)
  const [confirmar, setConfirmar] = useState<Confirmar>(null)
  // T17: editores (EditarPedidoDialog / EditarOtroPedidoDialog se pintan con este estado; ya congela el sondeo)
  const [editando, setEditando] = useState<Pedido | null>(null)
  // Texto de un 422 del servidor para el diálogo de cantidad abierto (spec §8): se pinta dentro, que sigue abierto.
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [peticionDesplazamiento, setPeticionDesplazamiento] = useState(0)
  // 0.9.9: bloques (spec «Pedidos por bloques» §6).
  const [agrupar, setAgrupar] = useState(leerAgrupar)
  const [plegado, setPlegado] = useStore(plegadoBloques)
  const [accionBloque, setAccionBloque] = useState<{ bloque: Bloque; accion: AccionBloque } | null>(null)
  const [separando, setSeparando] = useState<Bloque | null>(null)
  const [juntando, setJuntando] = useState<Bloque | null>(null)
  const [notaDe, setNotaDe] = useState<Bloque | null>(null)
  const [moverConfirmar, setMoverConfirmar] = useState<{ pedido: Pedido; idBloque: number | null } | null>(null)

  // Sondeo congelado con un menú, un desplegable, un diálogo, un editor o el formulario de alta abiertos (spec §7-§8, D4).
  const activo = !hayAlguna && formulario === null
  // 0.9.15: piezas y otros, juntos.
  const lineas = useLineasPedido({ activo })
  // Proveedores del filtro: la misma consulta que la pestaña Proveedores; aquí no sondea.
  const proveedores = useProveedoresComponentes({ activo: false })
  const transicion = useTransicionPedido()
  const mover = useMoverLinea()

  const hayModal = dialogoCantidad !== null || confirmar !== null || editando !== null || accionBloque !== null || separando !== null
    || juntando !== null || notaDe !== null || moverConfirmar !== null
  useEffect(() => {
    if (!hayModal) return
    marcar(true)
    return () => marcar(false)
  }, [hayModal, marcar])

  // Llegada desde "En Camino" de Stock (S8, navegarAPedidosDeComponente :217-231): los parámetros se leen una vez al montar,
  // se aplican al store (lo demás, intacto) y se limpia la URL con replace. Desde Stock, en cuanto hay datos, se selecciona la primera fila filtrada y se desplaza a ella. Los
  // refs evitan repetirlo si el efecto vuelve a correr.
  const [llegada] = useState(() => filtrosDesdeStock(new URLSearchParams(location.search)))
  const llegadaAplicada = useRef(false)
  const primeraPendiente = useRef(llegada !== null)
  useEffect(() => {
    if (llegada === null || llegadaAplicada.current) return
    llegadaAplicada.current = true
    filtrosPedidos.set((f) => ({ ...f, ...llegada }))
    navigate(location.pathname, { replace: true })
  }, [llegada, navigate, location.pathname])
  const datos = lineas.data
  useEffect(() => {
    if (!primeraPendiente.current || datos === undefined) return
    primeraPendiente.current = false
    // Se filtra con el store (no con `filtros` del render): si los datos ya estaban en caché, este efecto corre en el mismo
    // commit que el de arriba, antes de que el render vea los filtros nuevos.
    const actuales = filtrosPedidos.get()
    const primera = aplicarFiltrosPedidos(datos, actuales)[0]
    if (!primera) return
    // 0.9.9: el bloque de la línea elegida, desplegado.
    const firmaLlegada = firmaFiltros(actuales)
    plegadoBloques.set((p) => ({
      ...p,
      filtrado: { firma: firmaLlegada, mapa: { ...(p.filtrado.firma === firmaLlegada ? p.filtrado.mapa : {}), [claveBloque(primera)]: true } },
    }))
    setSeleccionada(claveLinea(primera))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pide a la tabla desplazarse a la fila recién elegida (select + scrollTo del JavaFX)
    setPeticionDesplazamiento((n) => n + 1)
  }, [datos, setSeleccionada])

  const irAStock = useCallback((p: CompraComponente) => navigate(`/stock?componente=${p.idCom}`), [navigate])
  const columnas = useMemo(() => crearColumnasPedidos({ onComponente: irAStock, vista: agrupar ? 'agrupada' : 'plana' }), [irAStock, agrupar])
  const bloques = useMemo(() => agruparEnBloques(lineas.data ?? []), [lineas.data])
  const visibles = useMemo(() => {
    const filtradas = aplicarFiltrosPedidos(lineas.data ?? [], filtros)
    return agrupar ? ordenarPorBloques(filtradas, bloques) : filtradas
  }, [lineas.data, filtros, agrupar, bloques])
  // Calco de :1729-1751: el filtro Proveedor solo ofrece los activos.
  const activos = useMemo(() => (proveedores.data ?? []).filter((p) => p.activo), [proveedores.data])

  // Calco de exportarPedidos (:1961-1983): la tabla visible, filtrada y en el orden mostrado; desde la 0.9.15, piezas y otros.
  useRegistrarExportable(() => {
    void descargarCsv('pedidos', CABECERAS_CSV_PEDIDOS, visibles.map(filaCsvPedido))
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
  const clavesVisibles = [...new Set(visibles.map(claveBloque))]
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

  // ── 0.9.9: mover y acciones de bloque (0.9.15: también los otros) ──────────────────────────────────────────────
  function moverAhora(pedido: Pedido, idBloque: number | null) {
    mover.mutate({ pedido, idBloque }, { onError: (e) => avisarFallo('mover', e) })
  }
  /** Pendiente: sin preguntar. Ya pedida: «Mover línea ya pedida» (spec §6.4). */
  function pedirMover(pedido: Pedido, idBloque: number | null) {
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
      case 'otro':
        // 0.9.15: «Nuevo pedido» del bloque con una línea de otro y el cursor en su concepto.
        abrirNuevoPedido({ modo: 'bloque', idBloque: b.idBloque as number, idProv: b.idProv, otro: true })
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
      case 'exportar':
        // En el mismo clic, sin nada asíncrono antes: la ventana «Guardar como» exige un gesto reciente (doc de descargarCsv).
        // Todas las líneas del bloque, piezas y otros, aunque los filtros oculten alguna.
        void descargarCsv(`pedidos_bloque_${b.idBloque}`, CABECERAS_CSV_PEDIDOS, b.lineas.map(filaCsvPedido))
        return
    }
  }, [])
  // Memoizado: DataTable recalcula los grupos solo si cambia su identidad (doc de GruposTabla).
  const grupos = useMemo<GruposTabla<Pedido> | undefined>(() => {
    if (!agrupar) return undefined
    const entradasDe = (b: Bloque) => entradasMenuBloque(b, vivosDelProveedor(bloques, b.idProv, b.clave).length, puedeEditar)
    const conMenuBloque = (b: Bloque | undefined): b is Bloque => b !== undefined && b.clave !== SIN_BLOQUE
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
  }, [agrupar, bloques, puedeEditar, desplegado, fijarPlegado, alElegirBloque, marcar])

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

  // Menú solo para el SUPERTECNICO (:961-966). Un cancelado no lleva menú (y desde 2026-10-12 tampoco «Mover a bloque»: solo
  // se mueven líneas vivas). 0.9.15: un otro lleva sus transiciones de siempre y también «Mover a bloque».
  const menuFila = puedeEditar
    ? (p: Pedido) => {
        const mov = sePuedeMover(p)
          ? { destinos: destinosMover(p, bloques), sola: estaSola(p, bloques), onMover: (idBloque: number | null) => pedirMover(p, idBloque) }
          : undefined
        return entradasMenu(p.estado).length > 0 || mov ? <MenuPedido pedido={p} onAccion={alElegir} onInteraccion={marcar} mover={mov} /> : null
      }
    : undefined
  const textosConfirmar = confirmar ? confirmacionDe(confirmar.accion, confirmar.pedido) : null

  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
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
        {/* El componente o el concepto (0.9.15) y, con solo cifras, el nº de bloque (0.9.9). */}
        <Input value={filtros.buscador} onChange={(e) => setFiltros((f) => ({ ...f, buscador: e.target.value }))}
          placeholder="Buscar componente o nº de bloque…" className="w-[200px] bg-superficie" />
        <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onChange={(desde, hasta) => setFiltros((f) => ({ ...f, desde, hasta }))} />
        {/* No toca la selección (:270-278). */}
        <BotonSecundario onClick={() => setFiltros({ ...FILTROS_PEDIDOS_VACIOS, estados: new Set(), proveedores: new Set() })}>Limpiar filtros</BotonSecundario>
        {puedeEditar && <BotonPrimario className="ml-6" onClick={() => abrirNuevoPedido({ modo: 'vacio' })}>Nuevo pedido</BotonPrimario>}
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
      </div>
      <DataTable<Pedido> columns={columnas} data={visibles} vacio="Sin pedidos" grupos={grupos} ajuste="fluido" getRowId={claveLinea}
        filaClase={claseFilaPedido} seleccionada={seleccionada} onSeleccionar={setSeleccionada} pedirDesplazamiento={peticionDesplazamiento} menuFila={menuFila} />
      {/* P7: recarga las dos listas (piezas y otros, 0.9.15). */}
      <EtiquetaActualizado actualizadoEn={lineas.dataUpdatedAt} onRecargar={() => lineas.refetch({ throwOnError: true })} />

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
      <EditarPedidoDialog pedido={editando !== null && esCompra(editando) ? editando : null} onCerrar={() => setEditando(null)} />
      <EditarOtroPedidoDialog pedido={editando !== null && !esCompra(editando) ? editando : null} onCerrar={() => setEditando(null)} />

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
