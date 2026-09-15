import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { esErrorGestionadoGlobalmente, mensajeDeError } from './errors'
import { emitirError } from '@/shared/ui/alertas'

// Tipa `mutation.meta`: sin esto es `Record<string, unknown> | undefined` y `silenciarError` no está
// comprobado por tsc (un typo como `silenciarErrores` en una mutación compilaría sin avisar).
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silenciarError?: boolean }
  }
}

/** Equivalente al catch de las llamadas del JavaFX: cualquier fallo que no gestione ya otro mecanismo
 *  (401 → redirección a login, 5xx/red → banner de conexión) abre el diálogo de error genérico. */
function avisar(error: unknown) {
  if (esErrorGestionadoGlobalmente(error)) return
  emitirError(mensajeDeError(error))
}

/** Único QueryClient de la app: producción y tests comparten configuración y política de errores para que
 *  los tests ejerciten lo que corre en producción. Los tests solo pueden tocar `retry`. */
export function crearQueryClient(opciones: { retry?: boolean } = {}): QueryClient {
  const retry = opciones.retry ?? false
  return new QueryClient({
    defaultOptions: {
      queries: { retry, refetchOnWindowFocus: true, staleTime: 0 },
      mutations: { retry },
    },
    queryCache: new QueryCache({ onError: avisar }),
    // Las mutaciones avisan igual que las consultas. `meta: { silenciarError: true }` deja el aviso en manos
    // de la vista (p. ej. Clientes, que traduce el 409 a "modificado por otro usuario") sin diálogo doble.
    mutationCache: new MutationCache({
      onError(error, _variables, _context, mutation) {
        if (mutation.meta?.silenciarError === true) return
        avisar(error)
      },
    }),
  })
}
