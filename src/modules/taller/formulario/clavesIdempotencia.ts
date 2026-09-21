import { claveUnica } from '@/shared/lib/claveUnica'

/** 'fila:<prefijo>' | 'accion:<id>' | 'agotar:<prefijo>' | 'completa' | 'editarAccion' | 'editarFila'
 *  | 'completaFilas' | 'completaAcciones'. */
export type Operacion = string

/** Una clave por operación lógica del formulario abierto. Misma operación + mismo cuerpo (comparado con
 *  `JSON.stringify`) = misma clave: es un reintento. Si el cuerpo cambia, clave nueva. */
export type ClavesIdempotencia = {
  /** Devuelve la clave vigente de la operación para ese cuerpo (la crea si no hay o si el cuerpo cambió). */
  para(operacion: Operacion, cuerpo: unknown): string
  /** La operación terminó bien: la próxima vez será otra operación, con otra clave. */
  hecha(operacion: Operacion): void
}

export function crearClavesIdempotencia(generar: () => string = claveUnica): ClavesIdempotencia {
  const vigentes = new Map<Operacion, { cuerpo: string; clave: string }>()
  return {
    para(operacion, cuerpo) {
      const cuerpoJson = JSON.stringify(cuerpo)
      const actual = vigentes.get(operacion)
      if (actual && actual.cuerpo === cuerpoJson) return actual.clave
      const clave = generar()
      vigentes.set(operacion, { cuerpo: cuerpoJson, clave })
      return clave
    },
    hecha(operacion) {
      vigentes.delete(operacion)
    },
  }
}
