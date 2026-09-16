import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { copiarAlPortapapeles } from './copiar'
import { onError } from './alertas'

type Aviso = { titulo: string; msg: string }
type Texto = { titulo: string; texto: string }
type Alertas = {
  mostrarError: (msg: string) => void
  mostrarAviso: (titulo: string, msg: string) => void
  mostrarTexto: (titulo: string, texto: string) => void
}
const Ctx = createContext<Alertas | null>(null)

/** Equivalente a Alertas.mostrarError: diálogo modal con el mensaje y "Aceptar". mostrarAviso es la variante con
 *  título propio (p. ej. "No se puede borrar"), usada por useAccionesTrabajo. mostrarTexto es ConfirmDialog.mostrarTexto,
 *  el popup de TextoExpandible. */
export function AlertaProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  // El contenido del popup de texto va aparte de si está abierto: así no se vacía durante la animación de cierre.
  const [texto, setTexto] = useState<Texto>({ titulo: '', texto: '' })
  const [textoAbierto, setTextoAbierto] = useState(false)
  const mostrarError = useCallback((m: string) => setAviso({ titulo: 'Error', msg: m }), [])
  const mostrarAviso = useCallback((titulo: string, msg: string) => setAviso({ titulo, msg }), [])
  const mostrarTexto = useCallback((titulo: string, t: string) => {
    setTexto({ titulo, texto: t })
    setTextoAbierto(true)
  }, [])
  // Suscripción al store externo: permite que QueryCache.onError (fuera de React) abra este mismo diálogo.
  useEffect(() => onError(mostrarError), [mostrarError])
  const value = useMemo(() => ({ mostrarError, mostrarAviso, mostrarTexto }), [mostrarError, mostrarAviso, mostrarTexto])
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
      {/* Calco de ConfirmDialog.mostrarTexto: título, texto completo de solo lectura y "Copiar" (copia y cierra). Se pinta
          aquí y no en la celda que lo abre: React propaga los eventos de un portal por el árbol de componentes, y desde
          una fila de DataTable el doble clic en el texto abriría la fila, las flechas moverían la selección y el clic
          derecho abriría el menú de la fila en vez del del navegador. Además no desaparece si esa fila deja de pintarse
          (virtualización, o un sondeo que la reordena). */}
      <Dialog open={textoAbierto} onOpenChange={setTextoAbierto}>
        <DialogContent aria-describedby={undefined} className="max-w-[420px] gap-2.5 bg-crema p-5">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-bold text-azul-medio">{texto.titulo}</DialogTitle>
          </DialogHeader>
          <textarea readOnly value={texto.texto} rows={6} className="w-full resize-none rounded border border-fila-sep bg-superficie p-2 text-[13px] text-azul-medio" />
          <Button
            className="h-auto w-full rounded bg-azul-medio py-2 text-[12px] text-crema hover:bg-azul-medio/90"
            onClick={() => {
              void copiarAlPortapapeles(texto.texto)
              setTextoAbierto(false)
            }}
          >
            Copiar
          </Button>
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
