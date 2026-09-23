import type { AsignacionDelLote, PeticionLote, TelefonoDelLote } from '@/shared/api/client'
import type { EstadoModal } from './estado/tipos'

/** Estado → cuerpo de POST /api/asignaciones/lote (spec 3b §4.2). Un teléfono por IMEI (el primer modelo no nulo
 *  gana: el cliente ya es el mismo en todas las colas porque se propaga); una asignación por verde × técnico. */
export function construirLote(s: EstadoModal): PeticionLote {
  const telefonos = new Map<string, TelefonoDelLote>()
  const anotar = (imei: string, modelo: string | null, idCli: number | null, sin: boolean) => {
    const t = telefonos.get(imei)
    if (!t) telefonos.set(imei, { imei, modelo, idCli, clienteExplicito: sin })
    else if (!t.modelo && modelo) telefonos.set(imei, { ...t, modelo })
  }
  const verdes = [...s.rep, ...s.glass].filter((e) => e.asignada)
  for (const e of verdes) anotar(e.imei, e.modelo, e.idCli, e.sinCliente)
  for (const f of s.pulido) anotar(f.imei, null, f.idCli, f.sinCliente)
  const asignaciones: AsignacionDelLote[] = [
    ...verdes.flatMap((e) => e.tecnicos.map((idTec): AsignacionDelLote => ({
      imei: e.imei, categoria: e.tipo === 'GLASS' ? 'G' : 'R', idTec,
      comentario: e.comentario.trim() || null, esChasis: e.tipo === 'REPARACION' && e.esChasis,
    }))),
    ...s.pulido.filter((f) => f.idTec != null).map((f): AsignacionDelLote => ({
      imei: f.imei, categoria: 'P', idTec: f.idTec!, comentario: f.comentario.trim() || null, esChasis: false,
    })),
  ]
  return { telefonos: [...telefonos.values()], asignaciones }
}
