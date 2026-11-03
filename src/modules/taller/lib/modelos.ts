import type { Componente } from '@/shared/api/client'

// traducirModelo y MODELOS_ORDENADOS viven en shared (los usan también almacén y telefonos): se reexportan para taller.
import { MODELOS_ORDENADOS, traducirModelo } from '@/shared/lib/modelos'
import { conEsim, descripcionMovil } from '@/shared/lib/telefonoNsys'
export { MODELOS_ORDENADOS, traducirModelo } from '@/shared/lib/modelos'

/** Lo que hace falta de un trabajo (`ReparacionResumen`) o de un grupo de IMEIs para nombrar su móvil. `esEsim` opcional: un
 *  servidor anterior a la 0.9.24 no lo manda. */
type MovilDelTaller = { modelo?: string | null; capacidad?: string | null; color?: string | null; esEsim?: boolean }

/** 0.9.21 (spec «Descripción completa donde pone «Modelo»» §2): lo que enseñan las listas del taller donde pone «Modelo»: el
 *  modelo del taller (`Telefono.MODELO`, traducido) con la capacidad y el color de NSYS que manda el servidor («iPhone 13 128GB
 *  Azul»); fuera de NSYS, el modelo solo; sin modelo, vacío. Vale para un trabajo (`ReparacionResumen`) y para un grupo de IMEIs.
 *  Desde la 0.9.24, con «eSIM» detrás del modelo si lo es («iPhone 14 eSIM 256GB Azul»). */
export function descripcionTrabajo(t: MovilDelTaller): string {
  return descripcionMovil(nombreTrabajo(t), t.capacidad, t.color)
}

/** 0.9.24 (spec «La descripción del móvil dice si es eSIM» §2.1): el modelo del taller traducido con «eSIM» detrás si NSYS dice
 *  que el móvil es eSIM («iPhone 14 eSIM»); sin modelo, vacío. Es el nombre de `descripcionTrabajo` y la columna «Modelo» de los
 *  CSV del taller. */
export function nombreTrabajo(t: MovilDelTaller): string {
  return conEsim(traducirModelo(t.modelo), t.esEsim)
}

/** Código de modelo de un SKU (calco de extraerModelo): en minúsculas, sin el prefijo del tipo y, si lo que queda empieza por
 *  "i", sin esa "i"; de los códigos de MODELOS_ORDENADOS que sean prefijo del resto gana el MÁS LARGO
 *  ('bati13promaxneg' → '13promax', no '13'). null si ninguno. */
export function extraerModelo(sku: string, prefijo: string): string | null {
  let resto = sku.toLowerCase().slice(prefijo.length)
  if (resto.startsWith('i')) resto = resto.slice(1)
  let mejor: string | null = null
  for (const m of MODELOS_ORDENADOS) {
    if (resto.startsWith(m) && (mejor === null || m.length > mejor.length)) mejor = m
  }
  return mejor
}

/** Modelos de MODELOS_ORDENADOS (en ese orden) presentes en algún SKU ACTIVO de los grupos indicados. Quien llama decide qué
 *  grupos pasa: el formulario pasa los tipos que son fila (nunca 'otro'). */
export function modelosDisponibles(grupos: { prefijo: string; skus: Componente[] }[]): string[] {
  const presentes = new Set<string>()
  for (const { prefijo, skus } of grupos) {
    for (const c of skus) {
      if (!c.activo) continue
      const m = extraerModelo(c.tipo, prefijo)
      if (m !== null) presentes.add(m)
    }
  }
  return MODELOS_ORDENADOS.filter((m) => presentes.has(m))
}
