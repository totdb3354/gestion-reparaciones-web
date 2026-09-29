import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { APP_VERSION } from '@/shared/lib/version'
import { BotonPrimario } from '@/shared/ui/Botones'
import { INTERVALO_VERSION_MS, leerVersionPublicada } from './versionPublicada'

export const MSG_VERSION_NUEVA = 'Hay una versión nueva del programa.'

/**
 * Avisa de que la versión publicada ya no es la que tiene cargada esta pestaña, con un botón para recargar
 * (spec sp7b §6.2). **Nunca recarga sola:** recargar pierde lo que haya escrito sin guardar, así que quien decide es la
 * persona. Comprueba la versión al montarse y luego cada `INTERVALO_VERSION_MS`; en cuanto ve la diferencia deja de
 * sondear, porque el aviso ya no va a cambiar, y al desmontarse no queda ningún sondeo vivo.
 *
 * Va en un portal al body, como la capa de carga: un diálogo modal abierto marca `aria-hidden` el resto de la app y el
 * aviso quedaría oculto a los lectores de pantalla si colgara de ella.
 */
export function AvisoVersion() {
  const [hayVersionNueva, setHayVersionNueva] = useState(false)

  useEffect(() => {
    let vivo = true
    let sondeo = 0

    const mirar = async () => {
      const publicada = await leerVersionPublicada()
      // La respuesta puede llegar después de desmontar, y sin versión publicada no hay nada que decir.
      if (!vivo || publicada === null || publicada === APP_VERSION) return
      window.clearInterval(sondeo)
      setHayVersionNueva(true)
    }

    sondeo = window.setInterval(() => void mirar(), INTERVALO_VERSION_MS)
    void mirar()
    return () => {
      vivo = false
      window.clearInterval(sondeo)
    }
  }, [])

  if (!hayVersionNueva) return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-testid="aviso-version"
      className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-3xl border border-banner-text/30 bg-banner-bg px-4 py-2 text-[12px] font-bold text-banner-text shadow-lg"
    >
      <span>{MSG_VERSION_NUEVA}</span>
      <BotonPrimario onClick={() => window.location.reload()}>Recargar</BotonPrimario>
    </div>,
    document.body,
  )
}
