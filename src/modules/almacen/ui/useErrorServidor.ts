import { useState } from 'react'

/** Error de un 422 del servidor para un diálogo abierto (spec 4a §8): se muestra en la línea de error del diálogo y se
 *  oculta en cuanto el usuario teclea. La vista lo pone a null antes de cada envío, así que dos 422 seguidos con el mismo
 *  texto vuelven a verse (null → texto es un cambio). Patrón "ajustar estado al cambiar una prop" durante el render. */
export function useErrorServidor(errorServidor: string | null | undefined): { error: string | null; ocultar: () => void } {
  const actual = errorServidor ?? null
  const [visto, setVisto] = useState(actual)
  const [oculto, setOculto] = useState(false)
  if (actual !== visto) {
    setVisto(actual)
    setOculto(false)
  }
  return { error: oculto ? null : actual, ocultar: () => setOculto(true) }
}
