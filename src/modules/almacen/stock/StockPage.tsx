import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { Componente } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError, StaleDataError } from '@/shared/api/errors'
import { descargarCsv } from '@/shared/lib/csv'
import { abrirNuevoPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import { ESTADOS_STOCK, type EstadoStock } from '@/shared/lib/semaforoStock'
import { useStore } from '@/shared/lib/store'
import { useInteraccionesAbiertas } from '@/shared/lib/useInteraccionesAbiertas'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin, esAdminOSuperTecnico, esSuperTecnico } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { BotonSecundario } from '@/shared/ui/Botones'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { Input } from '@/shared/ui/input'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { ultimaRutaStock } from '../estado'
import { AjustarMinimoDialog } from './AjustarMinimoDialog'
import { pedirCantidadEnCamino, useAjustarMinimo, useComponentesStock, useEditarStock, useSetActivoComponente, useSolicitarPieza } from './api'
import { CABECERAS_CSV_STOCK, claseFilaStock, crearColumnasStock, filaCsvStock, parametrosPedidos } from './columnas'
import { EditarStockDialog } from './EditarStockDialog'
import { filtrosStock, seleccionStock } from './estado'
import { aplicarFiltrosStock, FILTROS_STOCK_VACIOS, filtrosDesdePedidos, textoDesactivados } from './filtros'
import { GraficoEstado } from './GraficoEstado'
import { GraficoSku } from './GraficoSku'
import { conteosDonut } from './graficos'
import { MenuComponente } from './MenuComponente'
import { SolicitarPiezaDialog } from './SolicitarPiezaDialog'

const MSG_MODIFICADO = 'El componente fue modificado mientras editabas. Recarga los datos.'

type Dialogo = { tipo: 'stock' | 'minimo' | 'solicitar'; c: Componente } | null
type Grafico = { componente: Componente; enCamino: number }

/** Pestaña "Stock actual" de StockView.fxml (spec 4a §6): una sola consulta para tabla, filtros, donut y pie. */
export function StockPage() {
  const { sesion } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { mostrarError } = useAlerta()
  const { hayAlguna, marcar } = useInteraccionesAbiertas()
  const [filtros, setFiltros] = useStore(filtrosStock)
  const [seleccionada, setSeleccionada] = useStore(seleccionStock)
  // El formulario de pedido (P1 de 4b) es un modal del shell: mientras esté abierto, el sondeo se congela como con un
  // diálogo propio (spec 4b §7).
  const [formulario] = useStore(formularioPedido)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  // Texto de un 422 del servidor para el diálogo abierto (spec §8): se pinta dentro del diálogo, que sigue abierto.
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  // Cada llegada desde Pedidos pide a la tabla desplazarse hasta la fila seleccionada (contador, DataTable.tsx:52).
  const [peticionDesplazamiento, setPeticionDesplazamiento] = useState(0)
  const { data = [], dataUpdatedAt, refetch, isSuccess } = useComponentesStock({ activo: !hayAlguna && formulario === null })
  const editarStock = useEditarStock()
  const ajustarMinimo = useAjustarMinimo()
  const setActivo = useSetActivoComponente()
  const solicitar = useSolicitarPieza()

  // Última pestaña de Stock para el botón de la barra superior (caché de vista del JavaFX, S2).
  useEffect(() => { ultimaRutaStock.set('/stock') }, [])
  // El diálogo cuenta como interacción abierta: el sondeo se congela mientras esté abierto (D4 del 3a).
  useEffect(() => {
    if (!dialogo) return
    marcar(true)
    return () => marcar(false)
  }, [dialogo, marcar])

  // Vuelta desde Pedidos (calco de navegarAComponente, StockController :233-246; spec 4b §6 "Vuelta a Stock"): con los
  // datos ya cargados, desmarca OK, Bajo y Sin stock (conserva Desactivado), vacía el buscador y, si el componente sigue
  // visible con esos filtros nuevos, lo selecciona y pide a la tabla que se desplace hasta él. Después limpia la URL con
  // replace. Un id que no es un entero positivo solo limpia la URL. Se comprueba contra la lista YA filtrada (no contra
  // `data`): un componente desactivado que llega sin "Desactivado" marcado no debe seleccionarse ni pedir scroll, aunque
  // siga estando en `data` (T19 #12).
  const componenteUrl = params.get('componente')
  useEffect(() => {
    if (componenteUrl === null || !isSuccess) return
    const id = Number(componenteUrl)
    if (Number.isInteger(id) && id > 0) {
      const nuevosFiltros = filtrosDesdePedidos(filtrosStock.get())
      setFiltros(nuevosFiltros)
      if (aplicarFiltrosStock(data, nuevosFiltros).some((c) => c.idCom === id)) {
        setSeleccionada(String(id))
        // eslint-disable-next-line react-hooks/set-state-in-effect -- la llegada desde Pedidos se consume una sola vez, cuando ya hay datos; la petición de desplazamiento es la única forma de pedirle el scroll a DataTable
        setPeticionDesplazamiento((n) => n + 1)
      }
    }
    void navigate(pathname, { replace: true })
  }, [componenteUrl, isSuccess, data, navigate, pathname, setFiltros, setSeleccionada])

  const visibles = useMemo(() => aplicarFiltrosStock(data, filtros), [data, filtros])
  const conteos = useMemo(() => conteosDonut(data), [data])
  const nDesactivados = useMemo(() => data.filter((c) => !c.activo).length, [data])
  const seleccionado = useMemo(() => data.find((c) => String(c.idCom) === seleccionada) ?? null, [data, seleccionada])

  // Gráfico por SKU (spec §8): la barra "Pedido" solo la piden ADMIN y SUPERTECNICO (:547). El gráfico solo cambia cuando
  // llega la cantidad en camino; si la petición falla se avisa y el gráfico conserva el anterior, título incluido.
  // `seleccionado` mantiene la referencia entre sondeos si no cambia (structural sharing de TanStack Query): el refresco
  // no vuelve a pedir la cantidad.
  const veEnCamino = esAdminOSuperTecnico(sesion)
  const [grafico, setGrafico] = useState<Grafico | null>(null)
  useEffect(() => {
    if (!veEnCamino || !seleccionado) return
    // Guard de carrera: si cambia la selección antes de que llegue la respuesta, la de la fila anterior se descarta.
    let vigente = true
    pedirCantidadEnCamino(seleccionado.idCom).then(
      (enCamino) => { if (vigente) setGrafico({ componente: seleccionado, enCamino }) },
      (e: unknown) => { if (vigente && !esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e)) },
    )
    return () => { vigente = false }
  }, [seleccionado, veEnCamino, mostrarError])
  // Sin selección, "Selecciona un componente"; el TECNICO no pide la cantidad y su barra "Pedido" va a 0 al momento.
  const graficoSku: Grafico | null = !seleccionado ? null : veEnCamino ? grafico : { componente: seleccionado, enCamino: 0 }

  const irAPedidos = useCallback((c: Componente) => navigate(`/stock/pedidos?${parametrosPedidos(c)}`), [navigate])
  const columnas = useMemo(() => crearColumnasStock({ onEnCamino: irAPedidos }), [irAPedidos])

  useRegistrarExportable(() => descargarCsv('stock_actual', CABECERAS_CSV_STOCK, visibles.map(filaCsvStock)))

  function cerrarDialogo() {
    setDialogo(null)
    setErrorServidor(null)
  }

  /** Spec §8: un 422 del servidor se pinta dentro del diálogo, que sigue abierto. Devuelve true si lo ha gestionado. */
  function errorEnDialogo(e: unknown): boolean {
    if (!(e instanceof ReglaNegocioError)) return false
    setErrorServidor(e.message)
    return true
  }

  /** Editar stock: el 409 es el aviso de modificado (calco de :661-665) y cierra el diálogo; cualquier otro error
   *  (403/404/5xx/red) deja el diálogo abierto y pasa por el mapeo común, igual que "Ajustar mínimo".
   *  Las dos mutaciones con diálogo silencian el diálogo global (meta.silenciarError), así que el aviso sale una vez. */
  function alFallarEdicion(e: unknown) {
    if (esErrorGestionadoGlobalmente(e)) return
    mostrarError(mensajeDeError(e, { staleData: MSG_MODIFICADO }))
  }

  const rol = esSuperTecnico(sesion) ? 'SUPERTECNICO' : esAdmin(sesion) ? null : 'TECNICO'
  const estadosMenu = ESTADOS_STOCK.filter((e) => e !== 'Desactivado' || nDesactivados > 0)
  const pieDesactivados = textoDesactivados(nDesactivados)

  return (
    <div className="p-5">
      <h1 className="mb-3 text-2xl font-bold text-azul-medio">Stock actual</h1>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Calco del MenuButton "Estado" con CustomMenuItem(hideOnClick=false) con el MultiSelect compartido (spec §5,
            decisión 9): marcar no cierra el desplegable y abrirlo congela el refresco (onOpenChange → marcar). */}
        <MultiSelect
          opciones={estadosMenu}
          clave={(e) => e}
          etiqueta={(e) => e}
          seleccion={filtros.estados}
          onChange={(estados) => setFiltros({ ...filtros, estados: estados as Set<EstadoStock> })}
          textoVacio="Estado"
          textoPlural={(n) => `${n} estados`}
          onOpenChange={marcar}
          className="min-w-[130px]"
        />
        <Input value={filtros.buscador} onChange={(e) => setFiltros({ ...filtros, buscador: e.target.value })} placeholder="Buscar componente…" className="w-[220px] bg-superficie" />
        <BotonSecundario onClick={() => setFiltros({ ...FILTROS_STOCK_VACIOS, estados: new Set() })}>Limpiar filtros</BotonSecundario>
      </div>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <DataTable
            columns={columnas}
            data={visibles}
            vacio="Sin componentes"
            getRowId={(c) => String(c.idCom)}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
            pedirDesplazamiento={peticionDesplazamiento}
            filaClase={claseFilaStock}
            altoFila={35}
            menuFila={rol ? (c) => (
              <MenuComponente
                c={c}
                rol={rol}
                // "Pedir" abre "Nuevo pedido" como modal encima de Stock actual (calco del Stage modal, spec 4b P1): el
                // host del shell lo pinta; la línea va vacía si el componente está desactivado (calco, T14).
                onPedir={(x) => abrirNuevoPedido({ modo: 'componentes', idsCom: [x.idCom] })}
                onEditarStock={(x) => setDialogo({ tipo: 'stock', c: x })}
                onAjustarMinimo={(x) => setDialogo({ tipo: 'minimo', c: x })}
                onToggleActivo={(x) => setActivo.mutate({ idCom: x.idCom, activo: !x.activo })}
                onSolicitar={(x) => setDialogo({ tipo: 'solicitar', c: x })}
                onInteraccion={marcar}
              />
            ) : undefined}
          />
          {/* Pie en una línea (FXML :56-64): "N desactivados" a la izquierda y "Actualizado" a la derecha, sin estirar el botón. */}
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-[10px] whitespace-nowrap text-texto-vacio">{pieDesactivados ?? ''}</span>
            <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} className="mt-0 w-auto shrink-0 whitespace-nowrap" />
          </div>
        </div>
        {/* Tarjeta de 240 px fijos (FXML :66-106): donut arriba, separador, gráfico por SKU abajo. */}
        <aside className="flex w-[240px] shrink-0 flex-col gap-3 rounded-md border border-fila-sep bg-superficie p-4">
          <GraficoEstado conteos={conteos} />
          <hr className="border-fila-sep" />
          <GraficoSku componente={graficoSku?.componente ?? null} enCamino={graficoSku?.enCamino ?? 0} />
        </aside>
      </div>

      <EditarStockDialog
        componente={dialogo?.tipo === 'stock' ? dialogo.c : null}
        enviando={editarStock.isPending}
        errorServidor={errorServidor}
        onCancelar={cerrarDialogo}
        onConfirmar={(stock) => {
          if (dialogo?.tipo !== 'stock') return
          const c = dialogo.c
          setErrorServidor(null)
          editarStock.mutate({ c, stock }, {
            onSuccess: cerrarDialogo,
            // 422 → inline con el diálogo abierto; 409 → se cierra y avisa (recarga por el onSettled del hook);
            // cualquier otro error (403/404/5xx/red) deja el diálogo abierto y avisa igual que "Ajustar mínimo".
            onError: (e) => {
              if (errorEnDialogo(e)) return
              if (e instanceof StaleDataError) cerrarDialogo()
              alFallarEdicion(e)
            },
          })
        }}
      />
      <AjustarMinimoDialog
        componente={dialogo?.tipo === 'minimo' ? dialogo.c : null}
        enviando={ajustarMinimo.isPending}
        errorServidor={errorServidor}
        onCancelar={cerrarDialogo}
        onConfirmar={(stockMinimo) => {
          if (dialogo?.tipo !== 'minimo') return
          setErrorServidor(null)
          ajustarMinimo.mutate({ idCom: dialogo.c.idCom, stockMinimo }, {
            onSuccess: cerrarDialogo,
            onError: (e) => { if (errorEnDialogo(e)) return; if (!esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e)) },
          })
        }}
      />
      <SolicitarPiezaDialog
        componente={dialogo?.tipo === 'solicitar' ? dialogo.c : null}
        enviando={solicitar.isPending}
        onCancelar={cerrarDialogo}
        onConfirmar={(descripcion) => {
          if (dialogo?.tipo !== 'solicitar') return
          solicitar.mutate({ idCom: dialogo.c.idCom, descripcion }, { onSuccess: cerrarDialogo })
        }}
      />
    </div>
  )
}
