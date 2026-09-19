import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ConexionError, esErrorGestionadoGlobalmente, mensajeDeError, mensajeSinConexion } from './errors'
import { emitirError } from '@/shared/ui/alertas'

// Tipa `meta` de consultas y mutaciones: sin esto es `Record<string, unknown> | undefined` y `silenciarError` no está
// comprobado por tsc (un typo como `silenciarErrores` compilaría sin avisar).
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { silenciarError?: boolean }
    mutationMeta: { silenciarError?: boolean }
  }
}

/** Equivalente al catch de las llamadas del JavaFX: cualquier fallo que no gestione ya otro mecanismo
 *  (401 → redirección a login, 5xx/red → banner de conexión) abre el diálogo de error genérico. */
function avisar(error: unknown) {
  if (esErrorGestionadoGlobalmente(error)) return
  emitirError(mensajeDeError(error))
}

/** Calco de `enRefresco` del JavaFX: si el servidor se cae mientras el usuario hace algo (una acción o el
 *  primer intento de carga de una vista), además del banner se abre el diálogo con la causa; en los refrescos
 *  de fondo —con datos ya en pantalla o reintentando una carga que ya falló— se queda solo el banner. */
function avisarSinConexion(error: ConexionError) {
  emitirError(mensajeSinConexion(error))
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
        // `meta: { silenciarError: true }`: la consulta no avisa de NADA por esta vía. O bien el aviso lo pone la vista con su
        // propio literal (cargas del formulario), o bien es un sondeo de fondo (campana). Tampoco del corte de conexión: el
        // banner ya lo cuenta (lo enciende el cliente HTTP, no este callback).
        if (query.meta?.silenciarError === true) return
        // Diálogo solo en el PRIMER fallo de carga de una vista que nunca tuvo datos (calco de `enRefresco`):
        // sin datos previos = la carga inicial que ha pedido el usuario al navegar, y `errorUpdateCount === 1`
        // = es su primer fallo (TanStack despacha el estado de error antes de este callback, así que en el
        // primero ya vale 1). Los reintentos automáticos posteriores —refetch por foco de ventana, por
        // intervalo o manual— dejan solo el banner, para no repetir el modal mientras el servidor siga caído.
        // Contrato completo documentado en shared/api/refresco.ts.
        if (error instanceof ConexionError) {
          if (query.state.data === undefined && query.state.errorUpdateCount === 1) avisarSinConexion(error)
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
