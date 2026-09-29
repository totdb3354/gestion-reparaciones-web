import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { AVISO_MS, INACTIVIDAD_MS, escribirActividad, leerActividad } from './actividad'
import { dispararSesionExpirada } from './expiracion'
import { leerSesion } from './storage'

/** Cada cuánto se mira la marca. Un segundo es suficiente y no gasta nada. */
const LATIDO_VIGILANCIA_MS = 1_000

export const MSG_AVISO_TITULO = 'Vas a salir por inactividad'
export const MSG_AVISO_CUERPO =
  'Llevas dos horas sin usar el programa y la sesión se va a cerrar en un minuto. ' +
  'Lo que tengas sin guardar en un pedido o en el reparto de trabajos se perderá; ' +
  'las reparaciones a medias se guardan solas.'

/**
 * Cierra la sesión cuando nadie ha tocado el ERP en dos horas, avisando un minuto antes con un botón para seguir
 * (spec sp7b §6.1). Cuenta el ratón y el teclado, nunca el refresco de las tablas ni volver a la ventana; la
 * marca vive en `localStorage`, así que la actividad de cualquier pestaña cuenta para todas.
 *
 * Expulsa por `dispararSesionExpirada`, el mismo camino que un 401: borra la sesión en todas las pestañas y lleva
 * al login con su mensaje. Se monta dentro del layout de la aplicación, así que solo vive con sesión abierta.
 */
export function VigilanciaInactividad() {
  const [avisando, setAvisando] = useState(false)
  const expulsado = useRef(false)
  const avisandoRef = useRef(false)

  const seguir = useCallback(() => {
    escribirActividad()
    avisandoRef.current = false
    setAvisando(false)
  }, [])

  useEffect(() => {
    // El latido corre cada segundo durante horas y casi siempre no cambia nada: se toca el estado solo
    // cuando el aviso entra o sale. Sin esta guarda React recibiría una actualización por segundo para
    // dejarlo todo igual.
    const avisar = (valor: boolean) => {
      if (avisandoRef.current === valor) return
      avisandoRef.current = valor
      setAvisando(valor)
    }

    if (leerSesion() === null) return
    // Sin marca previa (primera carga tras entrar) se cuenta desde ahora.
    if (leerActividad() === null) escribirActividad()

    const mirar = () => {
      if (expulsado.current) return
      if (leerSesion() === null) return
      const marca = leerActividad() ?? Date.now()
      const inactivo = Date.now() - marca
      if (inactivo >= INACTIVIDAD_MS) {
        expulsado.current = true
        avisar(false)
        dispararSesionExpirada()
        return
      }
      avisar(inactivo >= INACTIVIDAD_MS - AVISO_MS)
    }

    mirar()
    const intervalo = window.setInterval(mirar, LATIDO_VIGILANCIA_MS)
    return () => window.clearInterval(intervalo)
  }, [])

  if (!avisando) return null
  return (
    <ConfirmDialog
      abierto
      titulo={MSG_AVISO_TITULO}
      descripcion={MSG_AVISO_CUERPO}
      textoAccion="Seguir trabajando"
      onConfirmar={seguir}
      onCancelar={seguir}
    />
  )
}
