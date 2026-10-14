import { useContadoresPendientes } from '../api'
import { BadgeLateral } from './BadgeLateral'

/** Badge de "Pendientes": suma rep + glass + pulidos del técnico en sesión. `compacto`: columna plegada (BadgeLateral). */
export function BadgePendientes({ activo, compacto = false }: { activo: boolean; compacto?: boolean }) {
  const { data } = useContadoresPendientes()
  return <BadgeLateral total={data ? data.reparaciones + data.glass + data.pulidos : undefined} activo={activo} compacto={compacto} />
}
