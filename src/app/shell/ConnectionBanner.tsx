import { useConexion } from '@/shared/api/conexion'

export function ConnectionBanner() {
  const conectado = useConexion()
  if (conectado) return null
  return (
    <div role="status" className="min-h-6 bg-banner-bg px-3 py-1 text-center text-[12px] font-bold text-banner-text">
      ⚠ Sin conexión con el servidor. Reintentando…
    </div>
  )
}
