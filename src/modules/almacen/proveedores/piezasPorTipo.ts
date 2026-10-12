import { traducirModelo } from '@/shared/lib/modelos'

/** Un tipo de pieza tal como lo devuelve GET /api/proveedores/{id}/piezas (ProveedorPiezasTipo del contrato). */
export type TipoPiezas = { prefijo: string; vende: boolean; modelos: string[]; excluidos: string[] }
/** Lo que el diálogo lleva marcado: prefijo → modelos excluidos (vacío = todos). Los tipos que no vende no están. */
export type EstadoTipos = ReadonlyMap<string, ReadonlySet<string>>
/** Cuerpo del PUT /api/proveedores/{id}/piezas. */
export type CuerpoPiezas = { tipos: { prefijo: string; excluidos: string[] }[] }

export const AYUDA_PIEZAS =
  'Marca los tipos de pieza que vende. De entrada, de todos los modelos (también los que salgan más adelante); si alguno no lo vende, desmárcalo en el desplegable.'

export function estadoInicial(tipos: TipoPiezas[]): EstadoTipos {
  return new Map(tipos.filter((t) => t.vende).map((t) => [t.prefijo, new Set(t.excluidos)]))
}

/** Marcar un tipo empieza con todos los modelos; desmarcarlo lo quita. */
export function marcarTipo(estado: EstadoTipos, prefijo: string, vende: boolean): EstadoTipos {
  const nuevo = new Map(estado)
  if (vende) nuevo.set(prefijo, new Set())
  else nuevo.delete(prefijo)
  return nuevo
}

/** Los modelos marcados en el desplegable: el resto queda excluido. Sin ninguno marcado, el tipo deja de venderse. */
export function fijarVendidos(estado: EstadoTipos, tipo: TipoPiezas, marcados: ReadonlySet<string>): EstadoTipos {
  const nuevo = new Map(estado)
  const excluidos = new Set(tipo.modelos.filter((m) => !marcados.has(m)))
  if (tipo.modelos.length > 0 && excluidos.size === tipo.modelos.length) nuevo.delete(tipo.prefijo)
  else nuevo.set(tipo.prefijo, excluidos)
  return nuevo
}

/** Los modelos que salen marcados en el desplegable (los no excluidos); ninguno si no vende el tipo. */
export function vendidos(tipo: TipoPiezas, excluidos: ReadonlySet<string> | undefined): Set<string> {
  return new Set(excluidos === undefined ? [] : tipo.modelos.filter((m) => !excluidos.has(m)))
}

export function textoBoton(tipo: TipoPiezas, excluidos: ReadonlySet<string> | undefined): string {
  if (excluidos === undefined) return 'No lo vende'
  const fuera = tipo.modelos.filter((m) => excluidos.has(m)).length
  if (fuera === 0) return 'Todos los modelos'
  return `Seleccionados ${tipo.modelos.length - fuera} de ${tipo.modelos.length}`
}

/** «Sin iPhone 12 Mini · iPhone 13 Mini»: los que faltan, en el orden de los modelos; vacío si no falta ninguno. */
export function textoSinModelos(tipo: TipoPiezas, excluidos: ReadonlySet<string> | undefined): string {
  if (excluidos === undefined) return ''
  const fuera = tipo.modelos.filter((m) => excluidos.has(m))
  return fuera.length === 0 ? '' : `Sin ${fuera.map(traducirModelo).join(' · ')}`
}

export function textoRecuento(estado: EstadoTipos, total: number): string {
  return `Vende ${estado.size} de ${total} tipos`
}

/** El PUT entero: los tipos que vende, en el orden del servidor, con sus excluidos en el orden de los modelos. */
export function cuerpoGuardar(tipos: TipoPiezas[], estado: EstadoTipos): CuerpoPiezas {
  return {
    tipos: tipos.flatMap((t) => {
      const excluidos = estado.get(t.prefijo)
      return excluidos === undefined ? [] : [{ prefijo: t.prefijo, excluidos: t.modelos.filter((m) => excluidos.has(m)) }]
    }),
  }
}
