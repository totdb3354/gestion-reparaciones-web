import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/shared/api/client'
import { CLAVE_TECNICOS_LITERAL, CLAVE_USUARIOS } from '../api'
import type { CuerpoAlta } from './validacion'

/** Tras una escritura con éxito (spec 6, §7): la tabla de esta página (['usuarios', …]) y los combos y listas de técnicos
 *  del resto de la web (['tecnicos', …]); equivale a la recarga de la vista al cerrar el modal del JavaFX. */
function useRecargaUsuarios(): () => void {
  const qc = useQueryClient()
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: CLAVE_USUARIOS })
    void qc.invalidateQueries({ queryKey: CLAVE_TECNICOS_LITERAL })
  }, [qc])
}

/** Las tres escrituras silencian el diálogo global: el error va a la línea inline de la página (spec 6, G9). El corte de
 *  conexión lo sigue avisando el MutationCache. Recargan solo si salen bien (calco: el JavaFX recarga tras el éxito). */
export function useRegistrar(): UseMutationResult<void, Error, CuerpoAlta> {
  const recargar = useRecargaUsuarios()
  return useMutation({
    mutationFn: async (cuerpo: CuerpoAlta) => {
      await api.POST('/api/usuarios/tecnicos', { body: cuerpo })
    },
    meta: { silenciarError: true },
    onSuccess: recargar,
  })
}

export function useCambiarActivo(): UseMutationResult<void, Error, { idTec: number; activar: boolean }> {
  const recargar = useRecargaUsuarios()
  return useMutation({
    mutationFn: async ({ idTec, activar }: { idTec: number; activar: boolean }) => {
      const params = { path: { idTec } }
      if (activar) await api.PATCH('/api/usuarios/tecnicos/{idTec}/activar', { params })
      else await api.PATCH('/api/usuarios/tecnicos/{idTec}/desactivar', { params })
    },
    meta: { silenciarError: true },
    onSuccess: recargar,
  })
}

/** DELETE con el `idUsu` de la fila, como el JavaFX (el servidor lo resuelve desde idTec desde la Task 2 y lo ignora). */
export function useEliminar(): UseMutationResult<void, Error, { idTec: number; idUsu: number }> {
  const recargar = useRecargaUsuarios()
  return useMutation({
    mutationFn: async ({ idTec, idUsu }: { idTec: number; idUsu: number }) => {
      await api.DELETE('/api/usuarios/tecnicos/{idTec}', { params: { path: { idTec }, query: { idUsu } } })
    },
    meta: { silenciarError: true },
    onSuccess: recargar,
  })
}

/** Lectura bajo demanda antes de borrar (no es una consulta de caché: la pide la papelera en cada clic, como el JavaFX). */
export async function consultarTieneReparaciones(idTec: number): Promise<boolean> {
  const { data } = await api.GET('/api/usuarios/tecnicos/{idTec}/tiene-reparaciones', { params: { path: { idTec } } })
  return data?.value === true
}
