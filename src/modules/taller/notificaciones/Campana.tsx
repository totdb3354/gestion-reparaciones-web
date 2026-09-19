import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { alertasOrdenadas, hayAlertas } from './alertas'
import { CLAVE_NOTIF_CONTADOR, useComponentesGestionados, useContadorNotificaciones } from './api'
import { PanelNotificaciones } from './PanelNotificaciones'

/** 'pendiente' = aún no ha llegado la primera respuesta de componentes; se decide una sola vez por montaje ("inicio de
 *  sesión" = carga de la aplicación con sesión) y, una vez parado, no vuelve a arrancar. */
type Pulso = 'pendiente' | 'latiendo' | 'parado'

/** Campana de la barra superior: solo SUPERTECNICO. Para el resto no pinta nada ni pide datos. */
export function Campana() {
  const { sesion } = useSession()
  if (!esSuperTecnico(sesion)) return null
  return <CampanaSupertecnico />
}

function CampanaSupertecnico() {
  const qc = useQueryClient()
  const anclaRef = useRef<HTMLButtonElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [pestanaInicial, setPestanaInicial] = useState<'solicitudes' | 'alertas'>('solicitudes')
  const [pulso, setPulso] = useState<Pulso>('pendiente')
  const contador = useContadorNotificaciones(true)
  const componentes = useComponentesGestionados(abierto)

  // Ajuste de estado durante el render (patrón de React para "derivar una vez"): la PRIMERA respuesta decide el pulso.
  if (pulso === 'pendiente' && (componentes.data !== undefined || componentes.isError)) {
    setPulso(hayAlertas(componentes.data ?? []) ? 'latiendo' : 'parado')
  }

  const total = contador.data ?? 0
  const latiendo = pulso === 'latiendo'
  // Única suscripción a los componentes gestionados (también usada por el pulso): el panel recibe la lista ya calculada
  // en vez de sondear la misma clave por su cuenta (así abrirlo no dispara una petición extra).
  const alertas = alertasOrdenadas(componentes.data ?? [])
  // Calco: la imagen encendida se fuerza mientras late y con el panel abierto, aunque el total sea 0.
  const encendida = total > 0 || latiendo || abierto

  function alternar() {
    if (!abierto) setPestanaInicial(latiendo ? 'alertas' : 'solicitudes')
    setPulso('parado')
    setAbierto(!abierto)
    // El contador se recalcula al abrir y al cerrar el panel.
    void qc.invalidateQueries({ queryKey: CLAVE_NOTIF_CONTADOR })
  }

  // Cierre desde el panel (clic fuera o Escape): también recalcula el contador.
  const cerrar = useCallback(() => {
    setAbierto(false)
    void qc.invalidateQueries({ queryKey: CLAVE_NOTIF_CONTADOR })
  }, [qc])

  return (
    <>
      <button
        ref={anclaRef}
        type="button"
        aria-label="Notificaciones"
        aria-expanded={abierto}
        data-testid="campana"
        data-pulso={latiendo ? 'true' : 'false'}
        data-encendida={encendida ? 'true' : 'false'}
        onClick={alternar}
        className="cursor-pointer rounded-lg p-0.5 hover:bg-white/8"
      >
        {/* El pulso envuelve imagen y badge: laten juntos. */}
        <span className={cn('relative block', latiendo && 'campana-pulso')}>
          <img data-testid="campana-imagen" src={encendida ? '/NotfON.png' : '/NotifOFF.png'} alt="" className="h-[30px] w-[30px]" />
          {total > 0 && (
            <span data-testid="campana-badge" className="pointer-events-none absolute top-0 right-0 flex h-4 w-4 translate-x-[10px] -translate-y-[7px] items-center justify-center">
              <img src="/Badge.png" alt="" className="absolute inset-0 h-4 w-4" />
              <span className="relative text-[10px] leading-none font-bold text-amarillo">{total}</span>
            </span>
          )}
        </span>
      </button>
      {abierto && <PanelNotificaciones pestanaInicial={pestanaInicial} anclaRef={anclaRef} onCerrar={cerrar} alertas={alertas} />}
    </>
  )
}
