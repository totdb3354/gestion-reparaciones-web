import { useContadoresPendientes } from '../api'
import { useTotalAsignaciones } from '../asignaciones/api'
import { BadgeLateral } from './BadgeLateral'

type Props = { pendientes: boolean; asignaciones: boolean; sondeaAsignaciones: boolean }
type Contadores = { reparaciones: number; glass: number; pulidos: number }

const totalPendientes = (c: Contadores | undefined) => (c ? c.reparaciones + c.glass + c.pulidos : undefined)

/**
 * Suma de los números de un grupo plegado de la columna lateral (0.9.12, spec «Navegación por grupos» §3): Pendientes,
 * Asignaciones o los dos, según las pestañas del grupo. Va en la cabecera, navy como sobre un enlace inactivo, con el
 * tope 99+ y oculta a cero (BadgeLateral). Con el grupo plegado sus pestañas no se pintan, así que esta suma es la que
 * mantiene vivos los sondeos. `sondeaAsignaciones`: con la vista de Asignaciones abierta su total no se sondea por su
 * cuenta (lo lleva la vista y su congelado D4), igual que BadgeAsignaciones.
 */
export function BadgeSumaLateral({ pendientes, asignaciones, sondeaAsignaciones }: Props) {
  if (pendientes && asignaciones) return <SumaAmbos sondeaAsignaciones={sondeaAsignaciones} />
  if (pendientes) return <SumaPendientes />
  if (asignaciones) return <SumaAsignaciones sondeaAsignaciones={sondeaAsignaciones} />
  return null
}

function SumaPendientes() {
  const { data } = useContadoresPendientes()
  return <BadgeLateral total={totalPendientes(data)} activo={false} />
}

function SumaAsignaciones({ sondeaAsignaciones }: { sondeaAsignaciones: boolean }) {
  const { data } = useTotalAsignaciones({ sondea: sondeaAsignaciones })
  return <BadgeLateral total={data} activo={false} />
}

function SumaAmbos({ sondeaAsignaciones }: { sondeaAsignaciones: boolean }) {
  const { data: contadores } = useContadoresPendientes()
  const { data: asignaciones } = useTotalAsignaciones({ sondea: sondeaAsignaciones })
  const pendientes = totalPendientes(contadores)
  const total = pendientes === undefined && asignaciones === undefined ? undefined : (pendientes ?? 0) + (asignaciones ?? 0)
  return <BadgeLateral total={total} activo={false} />
}
