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

/**
 * Calco de CsvExporter.exportar: abre "Guardar como" con el nombre propuesto `<base>_yyyy-MM-dd_HH-mm.csv` donde el
 * navegador lo permite (`showSaveFilePicker`, Chrome y Edge). Si el usuario cancela, no se guarda nada, como con el
 * FileChooser. Si el navegador no ofrece la ventana, o falla por otro motivo (por ejemplo, sin gesto de usuario
 * vigente), descarga a la carpeta de descargas. La ventana exige un gesto reciente: los exportadores la llaman en el
 * mismo clic de "Descargar CSV", sin nada asíncrono antes.
 */
export async function descargarCsv(nombreBase: string, cabeceras: string[], filas: string[][], ahora: Date = new Date()): Promise<void> {
  const nombre = `${nombreBase}_${marcaFichero(ahora)}.csv`
  const blob = new Blob([generarCsv(cabeceras, filas)], { type: 'text/csv;charset=utf-8' })
  if (typeof window.showSaveFilePicker !== 'function') {
    descargarEnlace(blob, nombre)
    return
  }
  let fichero: FileSystemFileHandle
  try {
    fichero = await window.showSaveFilePicker({ suggestedName: nombre, types: [{ accept: { 'text/csv': ['.csv'] } }] })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    descargarEnlace(blob, nombre)
    return
  }
  try {
    const escritura = await fichero.createWritable()
    await escritura.write(blob)
    await escritura.close()
  } catch {
    descargarEnlace(blob, nombre)
  }
}

/** Descarga clásica del navegador: un enlace con `download` que se pulsa; el fichero va a la carpeta de descargas. */
function descargarEnlace(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
