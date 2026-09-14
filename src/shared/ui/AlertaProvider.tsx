import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'

const Ctx = createContext<{ mostrarError: (msg: string) => void } | null>(null)

/** Equivalente a Alertas.mostrarError: diálogo modal con el mensaje y "Aceptar". */
export function AlertaProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const mostrarError = useCallback((m: string) => setMsg(m), [])
  const value = useMemo(() => ({ mostrarError }), [mostrarError])
  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={msg !== null} onOpenChange={(o) => !o && setMsg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>{msg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setMsg(null)}>Aceptar</Button>
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
