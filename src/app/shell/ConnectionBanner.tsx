import { useConexion } from '@/shared/api/conexion'

export function ConnectionBanner() {
  const conectado = useConexion()
  if (conectado) return null
  return (
    <div role="status" className="bg-fila-solicitud-bg px-4 py-1.5 text-center text-[12px] font-bold text-fila-solicitud-brd">
      ⚠ Sin conexión con el servidor. Reintentando…
    </div>
  )
}
