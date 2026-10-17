import { useMemo } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { useHistorial } from '../api'

/** La uniÃ³n de los tres historiales (R + G + P), las mismas consultas cacheadas que usa el Historial. */
export function useTrabajos(): ReparacionResumen[] {
  const rep = useHistorial('REPARACION')
  const glass = useHistorial('GLASS')
  const pul = useHistorial('PULIDO')
  return useMemo(() => [...(rep.data ?? []), ...(glass.data ?? []), ...(pul.data ?? [])], [rep.data, glass.data, pul.data])
}

/** True solo cuando los tres historiales se han cargado bien: antes (o si alguno falla) `useTrabajos` devuelve un array
 *  incompleto y de él no se puede deducir que un IMEI «no tiene trabajos». Reutiliza las mismas consultas cacheadas. */
export function useTrabajosCargados(): boolean {
  const rep = useHistorial('REPARACION')
  const glass = useHistorial('GLASS')
  const pul = useHistorial('PULIDO')
  return rep.isSuccess && glass.isSuccess && pul.isSuccess
}
