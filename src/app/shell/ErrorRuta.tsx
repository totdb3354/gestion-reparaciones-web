import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { mensajeDeError } from '@/shared/api/errors'

/** Último recinto: si una ruta revienta (loader, render), en vez de una pantalla en blanco se ve el error
 *  y un enlace de vuelta, como el diálogo de error del JavaFX cuando falla abrir una vista. */
export function ErrorRuta() {
  const error = useRouteError()
  const mensaje = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : mensajeDeError(error)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-fondo-vista p-6 text-center">
      <h1 className="text-2xl font-bold text-azul-medio">Error</h1>
      <p className="text-[13px] text-texto-error">{mensaje}</p>
      <Link to="/" className="text-[13px] font-bold text-texto-accion underline">
        Volver al inicio
      </Link>
    </div>
  )
}
