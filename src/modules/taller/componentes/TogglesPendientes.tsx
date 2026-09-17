import { TogglePill } from '@/shared/ui/TogglePill'
import { useContadoresPendientes } from '../api'
import { sufijoToggle } from '../lib/filtros'

/** Toggles de Pendientes con el sufijo "(n)" siempre presente (tope 99+), alimentado por los contadores del servidor. */
export function TogglesPendientes() {
  const { data } = useContadoresPendientes()
  const c = data ?? { reparaciones: 0, glass: 0, pulidos: 0 }
  return (
    <TogglePill
      className="mb-2"
      opciones={[
        { to: '/reparaciones/pendientes', etiqueta: `Reparaciones ${sufijoToggle(c.reparaciones)}` },
        { to: '/reparaciones/pendientes/glass', etiqueta: `Glass ${sufijoToggle(c.glass)}` },
        { to: '/reparaciones/pendientes/pulidos', etiqueta: `Pulidos ${sufijoToggle(c.pulidos)}` },
      ]}
    />
  )
}
