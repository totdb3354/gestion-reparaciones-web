import { useEffect } from 'react'
import { NavigationType, useBlocker, type Blocker } from 'react-router'

/** Para Atrás (y Adelante) del navegador mientras `activa` sea verdadero y entrega el bloqueo a quien lo monta, que enseña su
 *  confirmación y luego llama a `proceed()` o `reset()`. Se monta solo cuando hay algo que perder: `useBlocker` exige data
 *  router (el de app/router.tsx). */
export function GuardiaAtras({ activa, onBloqueo }: { activa: boolean; onBloqueo: (b: Blocker) => void }) {
  const blocker = useBlocker(({ historyAction }) => activa && historyAction === NavigationType.Pop)
  useEffect(() => {
    onBloqueo(blocker)
  }, [blocker, onBloqueo])
  return null
}
