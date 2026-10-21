import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type PeticionPreviaTaller, type PreviaTaller } from '@/shared/api/client'

/** Lo que espera la banda tras el último cambio de filas antes de preguntar: el mismo patrón de temporizador que el
 *  autoguardado del borrador, pero corto (el aviso tiene que verse antes del segundo clic de «Terminar»; Ajuste 12). */
export const RETARDO_PREVIA_MS = 500

/** El valor, `ms` después de su último cambio. */
function useDiferido<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return diferido
}

/** POST /api/reparaciones/sku-taller/previsualizar (0.9.21, spec «SKU del taller», pieza 2, §2.4): lo que el guardado
 *  cambiará en el móvil. Pregunta con un pequeño retraso tras cada cambio de filas; sin capa de carga y sin diálogo de
 *  error (si falla, no hay banda: el guardado aplica igual). Un IMEI que NSYS no conoce (`enNsys` false en una respuesta) no
 *  vuelve a preguntar mientras el formulario siga abierto (Ajuste 13). null: nada que enseñar. */
export function usePreviaTaller(peticion: PeticionPreviaTaller | null, retrasoMs = RETARDO_PREVIA_MS): PreviaTaller | null {
  const diferida = useDiferido(peticion === null ? null : JSON.stringify(peticion), retrasoMs)
  const [fueraDeNsys, setFueraDeNsys] = useState<string | null>(null)
  const activa = peticion !== null && diferida !== null && fueraDeNsys !== peticion.imei
  const previa = useQuery({
    queryKey: ['formulario', 'previa-taller', diferida],
    enabled: activa,
    queryFn: async () => {
      const cuerpo = JSON.parse(diferida ?? 'null') as PeticionPreviaTaller
      const datos = (await api.POST('/api/reparaciones/sku-taller/previsualizar', { body: cuerpo })).data ?? null
      if (datos !== null && !datos.enNsys) setFueraDeNsys(cuerpo.imei)
      return datos
    },
    // Mientras llega la previa de las filas nuevas, la banda sigue con la anterior: sin parpadeos.
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { silenciarError: true, sinCapa: true },
  })
  return activa ? (previa.data ?? null) : null
}
