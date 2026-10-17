import { traducirModelo } from './modelos'

/** Piezas del espejo de NSYS (0.9.17, spec «Pieza 1 del módulo de teléfonos») que usan dos módulos: el stock de teléfonos
 *  y el detalle del IMEI del taller. */

/** Nombre de un modelo de NSYS: el código del ERP traducido o, si no está en el catálogo, el texto del maestro. */
export function nombreModeloNsys(modelo: string | null, modeloMaestro: string | null): string {
  if (modelo) return traducirModelo(modelo)
  if (modeloMaestro) return `iPhone ${modeloMaestro}`
  return 'Sin modelo en el maestro'
}

/** Colores de las ubicaciones del ERP (los nombres de Nsys_ubicacion); las que no están aquí, en gris. */
const CLASES_UBICACION: Record<string, string> = {
  'En revisión': 'bg-fila-solicitud-bg text-fila-solicitud-brd',
  Devolución: 'bg-fila-solicitud-bg text-notif-urgente-text',
  'Taller · Pulir': 'bg-tipo-pulido-bg text-tipo-pulido-text',
  'Taller · Glass': 'bg-tipo-glass-bg text-tipo-glass-text',
  'Taller · Reparación': 'bg-tipo-reparacion-bg text-tipo-reparacion-text',
  'Taller · Pantalla rota': 'bg-entrega-bg text-entrega-text',
  Listos: 'bg-fila-recibido-bg text-fila-recibido-brd',
}

export function clasesUbicacion(ubicacion: string | null | undefined): string {
  return (ubicacion && CLASES_UBICACION[ubicacion]) || 'bg-badge-neutro-bg text-azul-gris'
}

const TEXTO_ESTADO: Record<string, string> = {
  DE_PEDIDO: 'De pedido', NO_CUENTA: 'No cuenta como stock', VENDIDO: 'Vendido', BAJA: 'Baja en NSYS',
}

export function textoEstadoMovil(estado: string): string {
  return TEXTO_ESTADO[estado] ?? 'Libre'
}

/** «2023-05-02» (o «2023-05-02T13:01:00») → «02/05/2023». Las fechas del espejo ya son de Madrid: se cortan del texto,
 *  sin pasar por `formatear` de `fechas.ts`, que da por hecho UTC. */
export function diaNsys(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}
