/** Lo único que el conteo mira de una fila. `ReparacionResumen` encaja tal cual; el IMEI nulo entra para poder
 *  probar la fila sin teléfono, que el JavaFX descarta. */
type FilaAsignada = { imei: string | null; idTec: number }

/**
 * IMEI → nº de **técnicos distintos** (`idTec`) con asignación pendiente, calco de
 * `PendientesSuperTecnicoController.contarTecnicosPorImei` (spec indicador-asignados 2026-06-29 §4.1). Se cuentan
 * técnicos, no filas, y las filas con IMEI nulo se ignoran.
 *
 * Se calcula sobre la lista **descargada**, no sobre la filtrada: en el JavaFX vive en `cargar()`, antes del
 * `setAll`, así que filtrar la tabla no hace bajar el "N asignados" de las filas que quedan a la vista.
 */
export function contarTecnicosPorImei(filas: readonly FilaAsignada[]): Map<string, number> {
  const tecnicosPorImei = new Map<string, Set<number>>()
  for (const fila of filas) {
    if (fila.imei === null) continue
    const tecnicos = tecnicosPorImei.get(fila.imei)
    if (tecnicos) tecnicos.add(fila.idTec)
    else tecnicosPorImei.set(fila.imei, new Set([fila.idTec]))
  }
  return new Map([...tecnicosPorImei].map(([imei, tecnicos]) => [imei, tecnicos.size]))
}
