import { useConexion } from '@/shared/api/conexion'
import { cn } from '@/shared/lib/utils'

/** Calco de `.banner-conexion`. La región viva está montada siempre (vacía y solo para lectores de pantalla
 *  mientras hay conexión) para que el aviso se anuncie al aparecer: una región que nace con el texto no se lee. */
export function ConnectionBanner() {
  const conectado = useConexion()
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(conectado ? 'sr-only' : 'min-h-6 bg-banner-bg px-3 py-1 text-center text-[12px] font-bold text-banner-text')}
    >
      {conectado ? null : '⚠ Sin conexión con el servidor. Reintentando…'}
    </div>
  )
}
