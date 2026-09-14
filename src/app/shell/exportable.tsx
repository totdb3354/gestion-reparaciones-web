import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Exportador = (() => void) | null
const Ctx = createContext<{ exportador: Exportador; registrar: (e: Exportador) => void } | null>(null)

/** "Descargar CSV" del menú de usuario delega en la vista activa, como Exportable en el JavaFX. */
export function ExportableProvider({ children }: { children: ReactNode }) {
  const [exportador, registrar] = useState<Exportador>(null)
  return <Ctx.Provider value={{ exportador, registrar }}>{children}</Ctx.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components -- hook colocado con su Provider, patrón del proyecto
export function useExportable(): Exportador {
  return useContext(Ctx)?.exportador ?? null
}
/** La vista que exporta llama a esto con su función; al desmontarse se desregistra. */
// eslint-disable-next-line react-refresh/only-export-components -- hook colocado con su Provider, patrón del proyecto
export function useRegistrarExportable(fn: Exportador) {
  const ctx = useContext(Ctx)
  useEffect(() => {
    ctx?.registrar(() => fn)
    return () => ctx?.registrar(null)
  }, [ctx, fn])
}
