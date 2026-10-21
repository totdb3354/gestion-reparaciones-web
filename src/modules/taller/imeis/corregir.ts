import type { FichaMovil, OpcionesTaller } from '@/shared/api/client'

/** Reglas puras del diálogo «Corregir color, grado o batería…» (0.9.21, spec «SKU del taller» §2.3). */

export const LETRAS = ['A', 'A-', 'B', 'C'] as const
export type Letra = (typeof LETRAS)[number]
/** El grado en el diálogo: la letra (vacía si el grado que vale no es de la forma [Ms]<letra>, p. ej. ID, F o n/a: entonces
 *  el grado solo cambia si se elige una), el mensaje de pieza («Ms») y la batería nueva («100»). */
export type GradoElegido = { letra: Letra | ''; ms: boolean; bateria: boolean }
export type Eleccion = { color: string; grado: GradoElegido; motivo: string }

const FORMA = /^(Ms)?(A-|A|B|C)$/

/** El grado entero como lo escribe NSYS: el servidor lo manda sin el 100 (`grado`) y con `bateriaNueva` aparte. */
export const gradoCompleto = (grado: string, bateriaNueva: boolean): string => `${grado}${bateriaNueva ? '100' : ''}`

export function leerGrado(grado: string, bateriaNueva: boolean): GradoElegido {
  const r = FORMA.exec(grado)
  if (!r) return { letra: '', ms: false, bateria: bateriaNueva }
  return { letra: r[2] as Letra, ms: r[1] === 'Ms', bateria: bateriaNueva }
}

/** `[Ms]<letra>[100]` («A100», «MsA-»); null sin letra: el grado no cambia. */
export function escribirGrado(g: GradoElegido): string | null {
  return g.letra ? `${g.ms ? 'Ms' : ''}${g.letra}${g.bateria ? '100' : ''}` : null
}

/** Lo que enseña el diálogo al abrirse: lo que vale. */
export function eleccionInicial(f: FichaMovil): Eleccion {
  return { color: f.color ?? '', grado: leerGrado(f.grado, f.bateriaNueva), motivo: '' }
}

/** Los colores del desplegable: el que vale primero y después los del maestro (spec §2.3). */
export function ordenColores(opciones: OpcionesTaller | null | undefined, colorVale: string): string[] {
  const delMaestro = (opciones?.colores ?? []).map((c) => c.color)
  return [...(colorVale ? [colorVale] : []), ...delMaestro.filter((c) => c !== colorVale)]
}

/** La vista previa y lo que se manda. `colorAntes`/`gradoAntes`: lo que vale ahora; `sku`: el del maestro para el color y el
 *  grado que quedarían (null: «sin SKU en el maestro»); `producto`: lo que habría que poner en NSYS (null: búscalo a mano);
 *  `coincideConNsys`: lo que queda es lo de NSYS (se quita lo del taller); `cuerpo`: solo los datos que cambian. */
export type Previa = {
  cambiaColor: boolean
  cambiaGrado: boolean
  colorAntes: string
  colorFinal: string
  gradoAntes: string
  gradoFinal: string
  sku: string | null
  producto: string | null
  coincideConNsys: boolean
  cuerpo: { color: string | null; grado: string | null }
  valido: boolean
}

export function previa(f: FichaMovil, e: Eleccion, opciones: OpcionesTaller | null | undefined): Previa {
  const colorAntes = f.color ?? ''
  const gradoAntes = gradoCompleto(f.grado, f.bateriaNueva)
  const colorNsys = f.colorNsys ?? colorAntes
  const gradoNsys = f.gradoNsys ?? gradoAntes
  const nuevo = escribirGrado(e.grado)
  const cambiaColor = e.color !== '' && e.color !== colorAntes
  const cambiaGrado = nuevo !== null && nuevo !== gradoAntes
  const colorFinal = cambiaColor ? e.color : colorAntes
  const gradoFinal = cambiaGrado && nuevo !== null ? nuevo : gradoAntes
  const sku = opciones?.skus.find((s) => s.color === colorFinal && s.grado === gradoFinal)?.sku ?? null
  const producto = colorFinal === colorNsys
    ? (opciones?.productoActual ?? null)
    : (opciones?.colores.find((c) => c.color === colorFinal)?.producto ?? null)
  return {
    cambiaColor, cambiaGrado, colorAntes, colorFinal, gradoAntes, gradoFinal, sku, producto,
    coincideConNsys: colorFinal === colorNsys && gradoFinal === gradoNsys,
    cuerpo: { color: cambiaColor ? e.color : null, grado: cambiaGrado ? nuevo : null },
    valido: (cambiaColor || cambiaGrado) && e.motivo.trim() !== '',
  }
}
