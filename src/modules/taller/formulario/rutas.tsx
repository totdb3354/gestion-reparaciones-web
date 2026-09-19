import { useNavigate, useParams } from 'react-router'
import { FormularioReparacion } from './FormularioReparacion'

/** Ruta hija de Pendientes (`reparar/:idAsignacion`): el formulario se pinta sobre la lista, que sigue montada debajo. Cerrar
 *  navega a la lista con `replace`: con F5 o acceso directo no hay entrada previa a la que volver. El Atrás del navegador sale
 *  de la ruta por sí solo y desmonta el formulario, que es lo mismo que cerrarlo. */
export function FormularioNuevoRuta({ glass }: { glass: boolean }) {
  const { idAsignacion = '' } = useParams()
  const navigate = useNavigate()
  const lista = glass ? '/reparaciones/pendientes/glass' : '/reparaciones/pendientes'
  // Manda el prefijo del id, no la ruta: una AG… abierta bajo /pendientes/reparar/ sigue siendo glass, y al revés.
  // La prop `glass` (la ruta) solo decide a qué lista se vuelve al cerrar.
  const modo = idAsignacion.startsWith('AG') ? 'glass' : 'nuevo'
  return <FormularioReparacion key={idAsignacion} modo={modo} idAsignacion={idAsignacion} onCerrar={() => navigate(lista, { replace: true })} />
}
