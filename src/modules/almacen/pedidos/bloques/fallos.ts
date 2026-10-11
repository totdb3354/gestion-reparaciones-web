import { StaleDataError } from '@/shared/api/errors'
import { mensajeErrorGuardado } from '../formulario/errores'

export const MSG_BLOQUE_MODIFICADO = 'Este bloque fue modificado por otro usuario. Los datos se han recargado.'

/** Fallo de un diálogo de bloque (spec §6.5): un 409 (alguien cambió el bloque; no se aplicó nada) cierra y avisa como
 *  «Advertencia»; un 422 u otro error se queda en la línea de error del diálogo; lo que gestiona el mecanismo global
 *  (sin conexión, sesión) no se repite. */
export function tratarFalloBloque(e: unknown, cerrar: () => void, avisar: (titulo: string, msg: string) => void,
                                  setError: (msg: string | null) => void): void {
  if (e instanceof StaleDataError) {
    cerrar()
    avisar('Advertencia', MSG_BLOQUE_MODIFICADO)
    return
  }
  setError(mensajeErrorGuardado(e))
}
