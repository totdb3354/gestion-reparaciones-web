import { useMemo } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { useHistorial } from '../api'

/** La unión de los tres historiales (R + G + P), las mismas consultas cacheadas que usa el Historial. */
export function useTrabajos(): ReparacionResumen[] {
  const rep = useHistorial('REPARACION')
  const glass = useHistorial('GLASS')
  const pul = useHistorial('PULIDO')
  return useMemo(() => [...(rep.data ?? []), ...(glass.data ?? []), ...(pul.data ?? [])], [rep.data, glass.data, pul.data])
}
