import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ConexionError, esErrorGestionadoGlobalmente, mensajeDeError, mensajeSinConexion } from './errors'
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

/** Calco de `enRefresco` del JavaFX: si el servidor se cae mientras el usuario hace algo (una acción o la
 *  carga inicial de una vista), además del banner se abre el diálogo con la causa; en los refrescos de
 *  fondo, con datos ya en pantalla, se queda solo el banner. */
function avisarSinConexion(error: ConexionError) {
  emitirError(mensajeSinConexion(error.detalle))
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
    queryCache: new QueryCache({
      onError(error, query) {
        // Sin datos previos = primera carga de la vista (la ha pedido el usuario al navegar).
        if (error instanceof ConexionError) {
          if (query.state.data === undefined) avisarSinConexion(error)
          return
        }
        avisar(error)
      },
    }),
    // Las mutaciones avisan igual que las consultas. `meta: { silenciarError: true }` deja el aviso en manos
    // de la vista (p. ej. Clientes, que traduce el 409 a "modificado por otro usuario") sin diálogo doble.
    mutationCache: new MutationCache({
      onError(error, _variables, _context, mutation) {
        // `silenciarError` solo cubre los conflictos propios de la vista (409); una caída del servidor se
        // avisa siempre, porque la acción del usuario no se ha llegado a guardar.
        if (error instanceof ConexionError) {
          avisarSinConexion(error)
          return
        }
        if (mutation.meta?.silenciarError === true) return
        avisar(error)
      },
    }),
  })
}
