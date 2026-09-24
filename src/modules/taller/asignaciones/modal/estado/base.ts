import type { Cola, Efecto, EfectoSinId, Entrada, EstadoModal } from './tipos'

export const colaDe = (s: EstadoModal, cola: Cola): Entrada[] => (cola === 'GLASS' ? s.glass : s.rep)

export const setCola = (s: EstadoModal, cola: Cola, entradas: Entrada[]): EstadoModal =>
  cola === 'GLASS' ? { ...s, glass: entradas } : { ...s, rep: entradas }

export function buscar(s: EstadoModal, seq: number | null): Entrada | undefined {
  if (seq == null) return undefined
  return s.rep.find((e) => e.seq === seq) ?? s.glass.find((e) => e.seq === seq)
}

export function actualizar(s: EstadoModal, seq: number, fn: (e: Entrada) => Entrada): EstadoModal {
  const e = buscar(s, seq)
  if (!e) return s
  return setCola(s, e.tipo, colaDe(s, e.tipo).map((x) => (x.seq === seq ? fn(x) : x)))
}

/** Aplica `fn` a todas las entradas (de las dos colas) que cumplan `pred`. */
export function actualizarTodas(s: EstadoModal, pred: (e: Entrada) => boolean, fn: (e: Entrada) => Entrada): EstadoModal {
  const m = (xs: Entrada[]) => xs.map((x) => (pred(x) ? fn(x) : x))
  return { ...s, rep: m(s.rep), glass: m(s.glass) }
}

export function conEfecto(s: EstadoModal, efecto: EfectoSinId): EstadoModal {
  return { ...s, efectos: [...s.efectos, { ...efecto, id: s.sigEfecto } as Efecto], sigEfecto: s.sigEfecto + 1 }
}

export function nuevaEntrada(seq: number, imei: string, tipo: Cola): Entrada {
  return {
    seq, imei, tipo, modelo: null, tecnicos: [], idCli: null, sinCliente: false, comentario: '', esChasis: false,
    asignada: false, modeloBuscado: false, buscando: false, modeloNoEncontrado: false, llevaGlass: false,
    auto: false, calculando: false, tokenPrediccion: 0,
  }
}
