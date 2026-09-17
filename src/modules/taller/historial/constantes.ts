import type { EstadoIncidencia } from '../lib/filtros'

/** Toggles "Reparaciones · Glass · Pulidos" del Historial (reutilizados por HistorialPulidosPage, Task 17). */
export const TOGGLES_HISTORIAL = [
  { to: '/reparaciones/historial', etiqueta: 'Reparaciones' },
  { to: '/reparaciones/historial/glass', etiqueta: 'Glass' },
  { to: '/reparaciones/historial/pulidos', etiqueta: 'Pulidos' },
]

/** Las tres casillas del Historial y del detalle de IMEIs (el maestro de IMEIs usa otras dos, Task 18). */
export const OPCIONES_INCIDENCIAS: { clave: EstadoIncidencia; etiqueta: string }[] = [
  { clave: 'abiertas', etiqueta: 'Abiertas' },
  { clave: 'cerradas', etiqueta: 'Cerradas' },
  { clave: 'sin', etiqueta: 'Sin incidencia' },
]
