import type { ReparacionResumen } from '@/shared/api/client'
import { tipoDe } from '@/shared/lib/tipoTrabajo'

/** Calco de GrupoImei: un grupo por IMEI con los trabajos de los tres tipos (R/G/P). */
export type GrupoImei = {
  imei: string
  modelo: string
  observacion: string | null
  cliente: string | null
  fechaMasAntigua: string | null
  fechaMasReciente: string | null
  trabajos: ReparacionResumen[]
  incAbiertas: number
  countRep: number
  countGlass: number
  countPul: number
  telefonoUpdatedAt: string | null
}

const primero = (valores: (string | null | undefined)[]) => valores.find((v) => v && v !== '') ?? null

function construir(imei: string, trabajos: ReparacionResumen[]): GrupoImei {
  let countRep = 0, countGlass = 0, countPul = 0
  for (const t of trabajos) {
    const tipo = tipoDe(t.idRep)
    if (tipo === 'GLASS') countGlass++
    else if (tipo === 'PULIDO') countPul++
    else countRep++
  }
  const asignaciones = trabajos.map((t) => t.fechaAsig).filter((f): f is string => !!f)
  const fines = trabajos.map((t) => t.fechaFin).filter((f): f is string => !!f)
  return {
    imei,
    modelo: primero(trabajos.map((t) => t.modelo)) ?? '',
    observacion: primero(trabajos.map((t) => t.observacionTelefono)),
    cliente: primero(trabajos.map((t) => t.cliente)),
    fechaMasAntigua: asignaciones.length ? asignaciones.reduce((a, b) => (a < b ? a : b)) : null,
    fechaMasReciente: fines.length ? fines.reduce((a, b) => (a > b ? a : b)) : null,
    trabajos,
    incAbiertas: trabajos.filter((t) => t.esIncidencia && !t.esResuelto).length,
    countRep,
    countGlass,
    countPul,
    telefonoUpdatedAt: trabajos[0]?.telefonoUpdatedAt ?? null,
  }
}

/** Agrupa en orden de primera aparición (LinkedHashMap del JavaFX); ordenar después con ordenarPorActividad. */
export function agruparPorImei(trabajos: ReparacionResumen[]): GrupoImei[] {
  const porImei = new Map<string, ReparacionResumen[]>()
  for (const t of trabajos) {
    const lista = porImei.get(t.imei)
    if (lista) lista.push(t)
    else porImei.set(t.imei, [t])
  }
  return [...porImei].map(([imei, lista]) => construir(imei, lista))
}

/** "2 Rep · 1 Glass · 1 Pul", omitiendo los tipos a cero. */
export function resumenTipos(g: GrupoImei): string {
  const partes: string[] = []
  if (g.countRep > 0) partes.push(`${g.countRep} Rep`)
  if (g.countGlass > 0) partes.push(`${g.countGlass} Glass`)
  if (g.countPul > 0) partes.push(`${g.countPul} Pul`)
  return partes.length ? partes.join(' · ') : '0'
}

/** Actividad más reciente arriba, cuente el tipo que cuente; sin fecha al final. */
export function ordenarPorActividad(grupos: GrupoImei[]): GrupoImei[] {
  return [...grupos].sort((a, b) => {
    if (a.fechaMasReciente === b.fechaMasReciente) return 0
    if (a.fechaMasReciente === null) return 1
    if (b.fechaMasReciente === null) return -1
    return a.fechaMasReciente > b.fechaMasReciente ? -1 : 1
  })
}
