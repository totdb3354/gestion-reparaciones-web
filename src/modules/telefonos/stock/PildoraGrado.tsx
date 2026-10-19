import { clasesGrado } from './grado'

/** El grado con su color de familia (spec §4.8): en la tabla de móviles, en la tabla color × grado y en el diálogo de
 *  varios IMEIs. Sin grado, una raya. */
export function PildoraGrado({ grado }: { grado: string | null | undefined }) {
  return <span className={clasesGrado(grado)}>{grado || '—'}</span>
}
