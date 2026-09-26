import type { LogActividad } from '@/shared/api/client'

/** Filtros del visor "Log de actividad" (LogController :23-40, :79-90 de `hotfix/0.16.3`). `texto` es el buscador en
 *  memoria; `accion` y `usuario`, lo elegido en "Acción..." y "Técnico..." (null = sin filtro); `desde`/`hasta`, los
 *  valores de RangoFechas ('yyyy-MM-dd' o ''). */
export type FiltrosLogs = { texto: string; accion: string | null; usuario: string | null; desde: string; hasta: string }

/** Al abrir y tras "Limpiar filtros" (:229-238): todo vacío. */
export const FILTROS_LOGS_VACIOS: FiltrosLogs = { texto: '', accion: null, usuario: null, desde: '', hasta: '' }

/** G3: la web pide las 1.000 filas más recientes (el servidor admite 1..5000 en `limite`; sin él, todo, como el JavaFX). */
export const LIMITE_LOGS = 1000
export const MSG_TOPE = 'Mostrando los 1.000 registros más recientes; acota con los filtros.'
/** Placeholder por defecto del TableView (no lo fija LogView.fxml); fijado con la captura del JavaFX el 2026-09-26. */
export const TEXTO_VACIO_LOGS = 'Tabla sin contenido'

/** Parámetros de GET /api/logs (`getAll_6`): los nombres del servidor. El usuario viaja como `tecnico`, igual que en el
 *  LogDAO del JavaFX (:14-18), porque el servidor filtra por `NOMBRE_USUARIO` con ese nombre de parámetro. */
export type QueryLogs = { accion?: string; tecnico?: string; desde?: string; hasta?: string; limite: number }

/** Omite lo vacío (el JavaFX solo concatena los que no son null) y lleva siempre el límite. El buscador no viaja. */
export function queryLogs(f: FiltrosLogs): QueryLogs {
  const q: QueryLogs = { limite: LIMITE_LOGS }
  if (f.accion) q.accion = f.accion
  if (f.usuario) q.tecnico = f.usuario
  if (f.desde) q.desde = f.desde
  if (f.hasta) q.hasta = f.hasta
  return q
}

function contiene(campo: string | null | undefined, texto: string): boolean {
  return campo != null && campo.toLowerCase().includes(texto)
}

/** Calco de `LogController.coincideTexto` (:245-255): texto null o en blanco coincide siempre; si no, `contains` sin
 *  mayúsculas del texto recortado sobre usuario, acción o detalle (ni motivo ni fecha). Un campo null no coincide. */
export function coincideTexto(log: LogActividad, texto: string | null | undefined): boolean {
  if (texto == null || texto.trim() === '') return true
  const t = texto.toLowerCase().trim()
  return contiene(log.nombreUsuario, t) || contiene(log.accion, t) || contiene(log.detalle, t)
}

/** La FilteredList del JavaFX (:79-82): en memoria, sobre lo cargado, sin reordenar. En blanco devuelve la misma lista. */
export function aplicarBuscador(logs: LogActividad[], texto: string): LogActividad[] {
  return texto.trim() === '' ? logs : logs.filter((l) => coincideTexto(l, texto))
}
