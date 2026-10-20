/** Clave de la carga de técnicos (`GET /api/reparaciones/carga-tecnicos`). En shared desde la 0.9.20: la regla general del
 *  QueryClient (queryClient.ts) la vuelve a pedir tras cada escritura, y shared no importa de los módulos. */
export const CLAVE_CARGA_TECNICOS = ['carga-tecnicos'] as const
