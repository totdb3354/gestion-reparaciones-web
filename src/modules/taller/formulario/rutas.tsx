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

const LISTA_DE_ORIGEN = { historial: '/reparaciones/historial', 'historial-glass': '/reparaciones/historial/glass' } as const

/** Ruta hija `editar/:idRep` del Historial (dos pestañas) y del detalle de IMEIs. Cierra a la lista de la que cuelga, con
 *  replace (con F5 no hay entrada previa en el historial); en el detalle de IMEIs usa el :imei de la URL, no el de la
 *  reparación. La recarga de la lista de debajo la hace el propio formulario al desmontarse —✕, Escape, guardado, "Salir sin
 *  guardar" o Atrás—, igual que en el flujo nuevo (`useCierreDeCarga` en FormularioReparacion.tsx). */
export function FormularioEditarRuta({ origen }: { origen: 'historial' | 'historial-glass' | 'imei' }) {
  const { idRep = '', imei = '' } = useParams()
  const navigate = useNavigate()
  const lista = origen === 'imei' ? `/reparaciones/imeis/${imei}` : LISTA_DE_ORIGEN[origen]
  return <FormularioReparacion key={idRep} modo="editar" idRep={idRep} onCerrar={() => navigate(lista, { replace: true })} />
}
