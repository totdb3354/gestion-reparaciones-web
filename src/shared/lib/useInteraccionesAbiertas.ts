import { useCallback, useState } from 'react'

/**
 * Cuenta menús, desplegables y diálogos abiertos. Mientras haya alguno, la vista no se refresca
 * (spec 3a, D4): si la tabla se recarga con un menú abierto, la fila se mueve bajo el cursor y la
 * acción se pierde o cae en otra fila. Es un contador porque pueden solaparse.
 *
 * `marcar` es estable a propósito (useCallback sin dependencias, con la forma funcional de setN): varios
 * consumidores la llevan en las dependencias de su efecto, y si cambiara de identidad el efecto se rearmaría en
 * cada render y el aviso parpadearía, descongelando el sondeo justo mientras el usuario interactúa.
 *
 * Vive en shared desde el sub-proyecto 4a porque Almacén también congela el sondeo con un menú o un diálogo abiertos.
 */
export function useInteraccionesAbiertas() {
  const [n, setN] = useState(0)
  const marcar = useCallback((abierta: boolean) => {
    setN((previo) => Math.max(0, previo + (abierta ? 1 : -1)))
  }, [])
  return { hayAlguna: n > 0, marcar }
}
