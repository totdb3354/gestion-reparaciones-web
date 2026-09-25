import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { abrirNuevoPedido } from '@/shared/lib/formularioPedido'
import { cn } from '@/shared/lib/utils'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import type { AlertaStock } from './alertas'
import { pedirPendientes, useCambiarEstadoSolicitud, useQuitarSolicitud, useRechazarTodo, useSolicitudesPanel } from './api'
import { firma, type ListasSolicitudes, type TarjetaDatos } from './solicitudes'
import { TarjetaAlerta } from './TarjetaAlerta'
import { TarjetaSolicitud } from './TarjetaSolicitud'

type Pestana = 'solicitudes' | 'alertas'
// `alertas` llega ya calculada por la campana: es la misma suscripción a `/api/componentes/gestionados` que sondea el
// pulso; así abrir el panel no añade una segunda petición para la misma clave de consulta.
type Props = { pestanaInicial: Pestana; anclaRef: RefObject<HTMLElement | null>; onCerrar: () => void; alertas: AlertaStock[] }

const ANCHO = 480
const SEPARACION = 6
const VACIAS: ListasSolicitudes = { pendientes: [], rechazadas: [] }
/** Capas que viven en un portal fuera del panel: un clic o un Escape dentro de ellas no es "fuera del panel". */
const CAPAS = '[data-slot="context-menu-content"], [role="dialog"], [data-slot="dialog-overlay"]'
const PESTANAS: { clave: Pestana; texto: string }[] = [
  { clave: 'solicitudes', texto: 'Solicitudes' },
  { clave: 'alertas', texto: 'Alertas' },
]
const BOTON_INFERIOR = 'w-full rounded-[20px] p-[11px] text-[13px] font-bold'

/** Panel flotante de la campana: 480 px, sin cabecera ni botón de cerrar, no modal (sin overlay ni trampa de foco). Borde
 *  derecho alineado con el de la campana y 6 px por debajo; se recoloca al cambiar el tamaño de la ventana. Se cierra al
 *  pulsar fuera del panel y de la campana, y con Escape. */
export function PanelNotificaciones({ pestanaInicial, anclaRef, onCerrar, alertas }: Props) {
  const navigate = useNavigate()
  const { mostrarError } = useAlerta()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial)
  // Copia que pintan las tarjetas: solo se sustituye cuando cambia el conjunto de identificadores con su grupo y clase.
  const [pintadas, setPintadas] = useState<ListasSolicitudes>(VACIAS)
  // "Pedir piezas" relee las pendientes antes de abrir el formulario: mientras tanto el botón no admite otro clic (el
  // JavaFX lo hace en el hilo de la interfaz, donde un segundo clic no es posible).
  const [pidiendo, setPidiendo] = useState(false)
  const solicitudes = useSolicitudesPanel(true)
  const cambiarEstado = useCambiarEstadoSolicitud()
  const quitar = useQuitarSolicitud()
  const rechazarTodo = useRechazarTodo()

  // Ajuste de estado durante el render: un sondeo que solo trae otra descripción, técnico o fecha no repinta.
  if (solicitudes.data && firma(solicitudes.data) !== firma(pintadas)) setPintadas(solicitudes.data)
  // Las alertas llegan por prop (misma suscripción que el pulso de la campana) y se repintan siempre.

  useLayoutEffect(() => {
    function colocar() {
      const ancla = anclaRef.current
      const panel = panelRef.current
      if (!ancla || !panel) return
      const r = ancla.getBoundingClientRect()
      panel.style.top = `${r.bottom + SEPARACION}px`
      panel.style.left = `${r.right - ANCHO}px`
    }
    colocar()
    window.addEventListener('resize', colocar)
    return () => window.removeEventListener('resize', colocar)
  }, [anclaRef])

  useEffect(() => {
    function alPulsar(e: PointerEvent) {
      const destino = e.target
      if (!(destino instanceof Element)) return
      if (panelRef.current?.contains(destino) || anclaRef.current?.contains(destino)) return
      if (destino.closest(CAPAS)) return
      onCerrar()
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Con un menú contextual o un aviso encima, Escape es suyo.
      if (document.querySelector(CAPAS)) return
      onCerrar()
    }
    document.addEventListener('pointerdown', alPulsar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alPulsar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [anclaRef, onCerrar])

  /** Calco de mostrarStockEnPedidos / mostrarStockEnActual (MainController): cierra el panel y abre la pestaña de Stock
   *  correspondiente, sin aplicar filtros (sub-proyecto 4a). */
  function irA(ruta: '/stock' | '/stock/pedidos') {
    onCerrar()
    navigate(ruta)
  }

  /** "Pedir" de una alerta y "Pedir todas las piezas" (calco de MainController :699-704 y :275-278): "Nuevo pedido" con una
   *  línea por componente, cantidad 1, en el orden de la campana. El formulario es un modal sobre la vista actual (P1)
   *  y el panel se cierra antes de abrirlo (spec §6 "Campana"). */
  function pedirComponentes(idsCom: number[]) {
    onCerrar()
    abrirNuevoPedido({ modo: 'componentes', idsCom })
  }

  /** "Pedir todas las piezas" sin alertas no hace nada (calco de MainController :276). */
  function pedirTodas() {
    if (alertas.length === 0) return
    pedirComponentes(alertas.map((a) => a.componente.idCom))
  }

  /** "Pedir piezas" (calco de MainController :334-351): relee las PENDIENTE; con las dos listas vacías no hace nada, sin
   *  aviso; si no, "Nuevo pedido" con las solicitudes, que el lote marcará GESTIONADA al guardar (D10). Un fallo de la
   *  relectura se avisa (mostrarError del JavaFX) y el panel sigue abierto. */
  async function pedirPiezas() {
    setPidiendo(true)
    try {
      const { urgentes, preventivas } = await pedirPendientes()
      if (urgentes.length === 0 && preventivas.length === 0) return
      onCerrar()
      abrirNuevoPedido({ modo: 'solicitudes', urgentes, preventivas })
    } catch (e) {
      if (!esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e))
    } finally {
      setPidiendo(false)
    }
  }

  const tarjeta = (t: TarjetaDatos, i: number) => (
    <TarjetaSolicitud
      key={`${t.clase}-${t.id}`}
      datos={t}
      alterna={i % 2 === 1}
      onRechazar={() => cambiarEstado.mutate({ clase: t.clase, id: t.id, estado: 'RECHAZADA' })}
      onRecuperar={() => cambiarEstado.mutate({ clase: t.clase, id: t.id, estado: 'PENDIENTE' })}
      onQuitar={() => quitar.mutate({ clase: t.clase, id: t.id })}
    />
  )

  return (
    <div ref={panelRef} data-testid="panel-notificaciones" className="fixed z-40 flex w-[480px] flex-col gap-3 border border-notif-panel-brd bg-fondo-vista p-5">
      <div className="flex items-center">
        <div role="tablist" className="flex rounded-[20px] border border-notif-segmento-brd bg-superficie p-[3px]">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={pestana === p.clave}
              onClick={() => setPestana(p.clave)}
              className={cn('cursor-pointer px-[18px] py-[7px] text-[12px]', pestana === p.clave ? 'rounded-[17px] bg-azul-medio font-bold text-superficie' : 'text-azul-gris')}
            >
              {p.texto}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => irA('/stock/pedidos')} className="cursor-pointer text-[12px] font-bold text-azul-noche hover:underline">→ Ir a pedidos</button>
      </div>

      {pestana === 'solicitudes' ? (
        <>
          <div role="tabpanel" aria-label="Solicitudes" className="h-[370px] overflow-x-hidden overflow-y-auto bg-fondo-vista">
            <h2 className="mb-1.5 text-[14px] font-bold text-azul-medio">Solicitudes de pieza</h2>
            <div className="flex flex-col gap-1.5">{pintadas.pendientes.map(tarjeta)}</div>
            <h3 className="mt-3 mb-1.5 text-[12px] font-bold text-texto-fecha-inicio">Rechazadas</h3>
            <div className="flex flex-col gap-1.5">{pintadas.rechazadas.map(tarjeta)}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={pidiendo} onClick={() => void pedirPiezas()} className={cn(BOTON_INFERIOR, 'flex-1 cursor-pointer bg-azul-medio text-superficie')}>
              Pedir piezas
            </button>
            <button type="button" onClick={() => rechazarTodo.mutate()} className={cn(BOTON_INFERIOR, 'flex-1 cursor-pointer bg-notif-rechazar-bg text-notif-rechazar-text')}>
              Rechazar todo
            </button>
          </div>
        </>
      ) : (
        <>
          <div role="tabpanel" aria-label="Alertas" className="h-[320px] overflow-x-hidden overflow-y-auto bg-fondo-vista">
            <h2 className="mb-1.5 text-[16px] font-bold text-azul-medio">Alertas de Stock</h2>
            {alertas.length === 0 ? (
              <p className="text-[13px] text-texto-fecha-inicio">Sin alertas de stock</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {alertas.map((a, i) => (
                  <TarjetaAlerta key={a.componente.idCom} alerta={a} alterna={i % 2 === 1} onPedir={() => pedirComponentes([a.componente.idCom])} />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={pedirTodas} className={cn(BOTON_INFERIOR, 'flex-1 cursor-pointer bg-azul-medio text-superficie')}>Pedir todas las piezas</button>
            <button type="button" onClick={() => irA('/stock')} className={cn(BOTON_INFERIOR, 'flex-1 cursor-pointer bg-azul-medio text-superficie')}>Ver Stock Completo</button>
          </div>
        </>
      )}
    </div>
  )
}
