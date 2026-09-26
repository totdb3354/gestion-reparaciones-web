import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

export type CuerpoCambiarPassword = { passwordActual: string; passwordNueva: string }

/** PATCH /api/auth/cambiar-password (AuthCambiarPasswordRequest). Sin invalidaciones (spec §7) ni Idempotency-Key
 *  (inventario-password §17.6). `silenciarError`: el 422 y el resto los pinta el diálogo en su línea; el corte de conexión
 *  lo sigue avisando el MutationCache (queryClient.ts:59-69) y el 401, el flujo global de sesión caducada. */
export function useCambiarPassword(): UseMutationResult<void, Error, CuerpoCambiarPassword> {
  return useMutation({
    mutationFn: async (body: CuerpoCambiarPassword) => {
      await api.PATCH('/api/auth/cambiar-password', { body })
    },
    meta: { silenciarError: true },
  })
}
