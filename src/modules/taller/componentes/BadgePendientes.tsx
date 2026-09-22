import { useContadoresPendientes } from '../api'
import { BadgeLateral } from './BadgeLateral'

/** Badge de "Pendientes": suma rep + glass + pulidos del técnico en sesión. */
export function BadgePendientes({ activo }: { activo: boolean }) {
  const { data } = useContadoresPendientes()
  return <BadgeLateral total={data ? data.reparaciones + data.glass + data.pulidos : undefined} activo={activo} />
}
