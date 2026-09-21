import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/shared/lib/utils'
import { TOOLTIP_ALMACEN } from '../lib/textos'
import type { AlertaStock } from './alertas'
import { useCambiarEstadoSolicitud, useQuitarSolicitud, useRechazarTodo, useSolicitudesPanel } from './api'
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

/** Botón reservado para Almacén: visible, deshabilitado y con tooltip en un envoltorio que sí recibe el hover. */
function BotonAlmacen({ texto, className, envoltorio }: { texto: string; className: string; envoltorio?: string }) {
  return (
    <span title={TOOLTIP_ALMACEN} className={envoltorio ?? 'inline-block'}>
      <button type="button" disabled className={cn('pointer-events-none disabled:opacity-50', className)}>
        {texto}
      </button>
    </span>
  )
}

/** Panel flotante de la campana: 480 px, sin cabecera ni botón de cerrar, no modal (sin overlay ni trampa de foco). Borde
 *  derecho alineado con el de la campana y 6 px por debajo; se recoloca al cambiar el tamaño de la ventana. Se cierra al
 *  pulsar fuera del panel y de la campana, y con Escape. */
export function PanelNotificaciones({ pestanaInicial, anclaRef, onCerrar, alertas }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial)
  // Copia que pintan las tarjetas: solo se sustituye cuando cambia el conjunto de identificadores con su grupo y clase.
  const [pintadas, setPintadas] = useState<ListasSolicitudes>(VACIAS)
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
        <BotonAlmacen texto="→ Ir a pedidos" className="text-[12px] font-bold text-azul-noche" />
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
            <BotonAlmacen texto="Pedir piezas" envoltorio="flex-1" className={cn(BOTON_INFERIOR, 'bg-azul-medio text-superficie')} />
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
                  <TarjetaAlerta key={a.componente.idCom} alerta={a} alterna={i % 2 === 1} />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <BotonAlmacen texto="Pedir todas las piezas" envoltorio="flex-1" className={cn(BOTON_INFERIOR, 'bg-azul-medio text-superficie')} />
            <BotonAlmacen texto="Ver Stock Completo" envoltorio="flex-1" className={cn(BOTON_INFERIOR, 'bg-azul-medio text-superficie')} />
          </div>
        </>
      )}
    </div>
  )
}
