import { useEffect } from 'react'
import { esSesionDeEstaPestana, leerSesion } from '@/shared/session/storage'

/**
 * Aviso del navegador al recargar, cerrar la pestaña o salir de la web (`beforeunload`) mientras `hayCambios` sea verdadero.
 * El listener solo está registrado mientras hay cambios: sin ellos, salir no pregunta. El texto del aviso lo pone el
 * navegador (no se puede personalizar).
 *
 * Sin sesión guardada no avisa: la salida por sesión caducada (main.tsx borra la sesión y hace `location.assign('/login')`)
 * no debe quedarse parada en el aviso, porque quedarse dejaría al usuario en una página que ya no puede guardar nada. Se
 * comprueba la sesión en el momento de salir en vez de un indicador que ponga quien redirige: así vale para cualquier
 * salida que venga de haber borrado la sesión (caducidad, cierre de sesión), sin depender de que cada una lo recuerde.
 * Tampoco avisa si la sesión guardada ya no es la de esta pestaña (otra pestaña entró con otra): esta se va a recargar.
 */
export function useAvisoAlSalir(hayCambios: boolean): void {
  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e: BeforeUnloadEvent) => {
      if (leerSesion() === null || !esSesionDeEstaPestana()) return
      e.preventDefault()
      // Navegadores antiguos: el aviso solo sale si returnValue lleva algo asignado.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])
}
