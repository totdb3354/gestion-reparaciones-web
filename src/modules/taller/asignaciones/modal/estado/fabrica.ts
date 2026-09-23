import { estadoInicial, type Entrada, type EstadoModal, type FilaTabla } from './tipos'
import { nuevaEntrada } from './base'

export const IMEI_1 = '111111111111111'
export const IMEI_2 = '222222222222222'
export const IMEI_3 = '333333333333333'

export function filaTabla(p: Partial<FilaTabla> & Pick<FilaTabla, 'idRep' | 'imei' | 'idTec'>): FilaTabla {
  return { nombreTecnico: 'Técnico A', ...p }
}

export function entrada(p: Partial<Entrada> & Pick<Entrada, 'seq' | 'imei'>): Entrada {
  return { ...nuevaEntrada(p.seq, p.imei, p.tipo ?? 'REPARACION'), ...p }
}

export function estado(p: Partial<EstadoModal> = {}): EstadoModal {
  return { ...estadoInicial([]), ...p }
}
