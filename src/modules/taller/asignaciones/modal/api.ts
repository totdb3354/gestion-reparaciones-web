import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PeticionLote, type PeticionPrediccion, type RespuestaLote } from '@/shared/api/client'
import { CLAVE_CONTADORES } from '../../api'
import { CLAVE_ASIGNACIONES_TODAS, CLAVE_CARGA_TECNICOS } from '../api'

/** Cliente del IMEI en BD, o null (vacío, desconocido en la lista o error: calco, se traga). */
export async function pedirClienteBd(imei: string, idsClientes: Set<number>): Promise<number | null> {
  try {
    const { data } = await api.GET('/api/telefonos/{imei}/cliente', { params: { path: { imei } } })
    const v = data?.value
    if (!v) return null
    const id = Number(v)
    return idsClientes.has(id) ? id : null
  } catch {
    return null
  }
}

/** Lookup de una entrada roja: modelo (si le falta; el servidor ya consulta el servicio de IMEI) y cliente de BD. */
export async function pedirLookup(
  imei: string,
  buscarModelo: boolean,
  idsClientes: Set<number>,
): Promise<{ modelo: string | null; idCliBd: number | null }> {
  let modelo: string | null = null
  if (buscarModelo) {
    try {
      const { data } = await api.GET('/api/telefonos/{imei}/modelo', { params: { path: { imei } } })
      modelo = data?.value || null
    } catch {
      modelo = null
    }
  }
  return { modelo, idCliBd: await pedirClienteBd(imei, idsClientes) }
}

/** Guardado inmediato del modelo decidido a mano (D3). Si falla, nada: el lote lo vuelve a mandar. */
export async function guardarModelo(imei: string, modelo: string): Promise<void> {
  try {
    await api.POST('/api/telefonos', { body: { imei, modelo, idCli: null, clienteExplicito: null } })
  } catch {
    // el lote vuelve a mandar el modelo
  }
}

/** Técnico de la glass automática, o null si no hay candidato. Los errores se propagan (glass roja + aviso). */
export async function pedirPrediccion(cuerpo: PeticionPrediccion): Promise<number | null> {
  const { data } = await api.POST('/api/glass/prediccion', { body: cuerpo })
  return data?.idTec ?? null
}

export function useGuardarLote() {
  const qc = useQueryClient()
  return useMutation<RespuestaLote, unknown, { cuerpo: PeticionLote; clave: string }>({
    mutationFn: async ({ cuerpo, clave }) =>
      (await api.POST('/api/asignaciones/lote', { params: { header: { 'Idempotency-Key': clave } }, body: cuerpo })).data ?? {
        creadas: [],
        conflictos: [],
      },
    meta: { silenciarError: true },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CLAVE_ASIGNACIONES_TODAS })
      void qc.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS })
      void qc.invalidateQueries({ queryKey: ['asignaciones'] }) // pendientes de los técnicos
      void qc.invalidateQueries({ queryKey: CLAVE_CONTADORES })
    },
  })
}
