import { useEffect } from 'react'

/**
 * Aviso del navegador al recargar, cerrar la pestaña o salir de la web (`beforeunload`) mientras `hayCambios` sea verdadero.
 * El listener solo está registrado mientras hay cambios: sin ellos, salir no pregunta. El texto del aviso lo pone el
 * navegador (no se puede personalizar).
 */
export function useAvisoAlSalir(hayCambios: boolean): void {
  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Navegadores antiguos: el aviso solo sale si returnValue lleva algo asignado.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])
}
