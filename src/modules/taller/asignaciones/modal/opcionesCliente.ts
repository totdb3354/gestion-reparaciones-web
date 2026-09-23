import type { Cliente } from '@/shared/api/client'
import type { RefCliente } from './estado/tipos'

export const SIN = 'SIN'

export type OpcionCliente = { clave: string; etiqueta: string }

/** Opciones del buscador de cliente: "— Sin cliente —" + los activos, más el que ya tenga la entrada aunque esté
 *  inactivo (un inactivo de BD se muestra, D6) — pero solo a esa entrada, no al buscador de las demás. Compartido
 *  por DetalleEntrada (Reparación/Glass) y PanelPulido: mismo cálculo, un único sitio. */
export function opcionesCliente(clientes: Cliente[], idCliActual: number | null | undefined): OpcionCliente[] {
  return [
    { clave: SIN, etiqueta: '— Sin cliente —' },
    ...clientes.filter((c) => c.activo || c.idCli === idCliActual).map((c) => ({ clave: String(c.idCli), etiqueta: c.nombre })),
  ]
}

/** Valor seleccionado del buscador a partir de la decisión de cliente de la entrada/fila (o `null` si no hay entrada). */
export function valorCliente(x: { idCli: number | null; sinCliente: boolean } | null | undefined): string | null {
  if (!x) return null
  if (x.sinCliente) return SIN
  return x.idCli != null ? String(x.idCli) : null
}

/** Clave elegida en el buscador → decisión de cliente (RefCliente) que consume el reductor. */
export function refDeClave(clave: string): RefCliente {
  return clave === SIN ? { idCli: null, sin: true } : { idCli: Number(clave), sin: false }
}
