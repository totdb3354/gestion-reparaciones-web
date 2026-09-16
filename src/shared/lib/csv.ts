import { marcaFichero } from './fechas'

/** Calco de CsvExporter: separador `;`, BOM para Excel, escapado de `;`, comillas y saltos, `="…"` para los IMEIs. */
export function escaparCsv(valor: string | null | undefined): string {
  if (valor == null) return ''
  return /[;"\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

/** Fuerza que Excel trate el valor como texto (IMEIs): `="valor"`. */
export function textoForzado(valor: string | null | undefined): string {
  if (!valor) return ''
  return `="${valor.replace(/"/g, '""')}"`
}

export function generarCsv(cabeceras: string[], filas: string[][]): string {
  const lineas = [cabeceras.join(';'), ...filas.map((f) => f.map(escaparCsv).join(';'))]
  return `\uFEFF${lineas.join('\r\n')}\r\n`
}

/** Descarga del navegador (diferencia aceptada respecto al FileChooser del JavaFX). */
export function descargarCsv(nombreBase: string, cabeceras: string[], filas: string[][], ahora: Date = new Date()): void {
  const blob = new Blob([generarCsv(cabeceras, filas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreBase}_${marcaFichero(ahora)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
