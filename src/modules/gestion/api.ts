import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type Usuario } from '@/shared/api/client'

/** Prefijo de todo lo de usuarios: invalidarlo recarga la lista de técnicos de esta página y el filtro "Técnico..." de logs. */
export const CLAVE_USUARIOS = ['usuarios'] as const
export const CLAVE_USUARIOS_TECNICOS = ['usuarios', 'tecnicos'] as const
/** La CLAVE_TECNICOS de modules/taller/api.ts (combos y listas de técnicos del resto de la web; cubre ['tecnicos','activos']
 *  por prefijo). Literal porque un módulo no importa de otro, como ['notificaciones'] en el 4b. */
export const CLAVE_TECNICOS_LITERAL = ['tecnicos'] as const

/** GET /api/usuarios/tecnicos (ADMIN): TECNICO y SUPERTECNICO, sin ADMIN, ordenados por nombre de técnico en el servidor.
 *  Sin diálogo global de error (la página de técnicos pinta "Error al cargar los usuarios." en su línea y el filtro de logs
 *  falla en silencio, calco) y sin recarga por foco ni sondeo (spec 6, §7). */
export function useUsuariosTecnicos(opciones: { habilitada?: boolean } = {}): UseQueryResult<Usuario[]> {
  return useQuery({
    queryKey: CLAVE_USUARIOS_TECNICOS,
    queryFn: async () => (await api.GET('/api/usuarios/tecnicos')).data ?? [],
    enabled: opciones.habilitada ?? true,
    meta: { silenciarError: true },
    refetchOnWindowFocus: false,
  })
}
