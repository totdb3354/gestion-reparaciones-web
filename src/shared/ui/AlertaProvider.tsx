import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { onError } from './alertas'

type Aviso = { titulo: string; msg: string }
const Ctx = createContext<{ mostrarError: (msg: string) => void; mostrarAviso: (titulo: string, msg: string) => void } | null>(null)

/** Equivalente a Alertas.mostrarError: diálogo modal con el mensaje y "Aceptar". mostrarAviso es la variante con
 *  título propio (p. ej. "No se puede borrar"), usada por useAccionesTrabajo. */
export function AlertaProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const mostrarError = useCallback((m: string) => setAviso({ titulo: 'Error', msg: m }), [])
  const mostrarAviso = useCallback((titulo: string, msg: string) => setAviso({ titulo, msg }), [])
  // Suscripción al store externo: permite que QueryCache.onError (fuera de React) abra este mismo diálogo.
  useEffect(() => onError(mostrarError), [mostrarError])
  const value = useMemo(() => ({ mostrarError, mostrarAviso }), [mostrarError, mostrarAviso])
  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={aviso !== null} onOpenChange={(o) => !o && setAviso(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{aviso?.titulo}</DialogTitle>
            <DialogDescription>{aviso?.msg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAviso(null)}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}
export function useAlerta() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAlerta fuera de AlertaProvider')
  return ctx
}
