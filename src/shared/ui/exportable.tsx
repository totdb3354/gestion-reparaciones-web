import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Exportador = (() => void) | null
const Ctx = createContext<{ exportador: Exportador; registrar: (e: Exportador) => void } | null>(null)

/** "Descargar CSV" del menú de usuario delega en la vista activa, como Exportable en el JavaFX. */
export function ExportableProvider({ children }: { children: ReactNode }) {
  const [exportador, registrar] = useState<Exportador>(null)
  const value = useMemo(() => ({ exportador, registrar }), [exportador])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useExportable(): Exportador {
  return useContext(Ctx)?.exportador ?? null
}
/** La vista que exporta llama a esto con su función; al desmontarse se desregistra. */
export function useRegistrarExportable(fn: Exportador) {
  // El setter de useState (registrar) es estable, así que no dispara el efecto en cada render.
  // La fn (a menudo un arrow inline en la vista) se guarda en un ref y se actualiza en cada
  // render sin pasar por deps: así el efecto solo se re-ejecuta cuando activo cambia, nunca
  // solo porque la vista pasó una función inline nueva (eso era lo que causaba el bucle:
  // ctx sin memoizar + fn nueva en cada render → deps siempre distintas → registrar en bucle).
  const registrar = useContext(Ctx)?.registrar
  const ref = useRef(fn)
  // Actualizar el ref en un layout effect (no durante el render, que debe ser puro: regla
  // react-hooks/refs) sigue dejando ref.current al día antes de que nadie pueda invocar el
  // exportador (el layout effect corre en el mismo commit, antes de pintar).
  useLayoutEffect(() => {
    ref.current = fn
  })
  const activo = fn !== null
  useEffect(() => {
    registrar?.(activo ? () => () => ref.current?.() : null)
    return () => registrar?.(null)
  }, [registrar, activo])
}
