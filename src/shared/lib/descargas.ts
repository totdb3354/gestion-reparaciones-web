/** Descargas de ficheros que no son CSV (0.9.22: las plantillas de NSYS, que hace el servidor). */

/** Descarga clásica del navegador: un enlace con `download` que se pulsa; el fichero va a la carpeta de descargas. */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** El nombre de fichero de una cabecera `Content-Disposition: attachment; filename="…"`; null si no lo trae. */
export function nombreDeDescarga(cabecera: string | null | undefined): string | null {
  const m = /filename="([^"]+)"/.exec(cabecera ?? '')
  return m ? m[1] : null
}

/** El tipo de fichero que propone «Guardar como». */
export type TipoFichero = { mime: string; extension: string }

/** Un fichero ya hecho y el nombre con el que se descarga si no hay fichero elegido. */
export type Fichero = { blob: Blob; nombre: string }

/** Dónde guardar: el fichero elegido en «Guardar como», `null` para la descarga clásica o `'cancelado'`. */
export type Destino = FileSystemFileHandle | null | 'cancelado'

/**
 * 0.9.22.1: «Guardar como» (`showSaveFilePicker`, Chrome y Edge) ANTES de pedir el fichero al servidor, en el mismo clic, como
 * descargarCsv. La ventana exige un gesto reciente, y la descarga clásica lanzada después de esperar al servidor el navegador la
 * pierde sin avisar (las plantillas de NSYS no bajaban en producción). Sin la ventana, o si falla por otro motivo, null: la
 * descarga clásica, como siempre.
 */
export async function elegirDestino(sugerido: string, tipo: TipoFichero): Promise<Destino> {
  if (typeof window.showSaveFilePicker !== 'function') return null
  try {
    return await window.showSaveFilePicker({ suggestedName: sugerido, types: [{ accept: { [tipo.mime]: [tipo.extension] } }] })
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelado' : null
  }
}

/** Escribe el fichero en el elegido y da el nombre que tiene. Sin elegido, o si escribir falla (se aborta antes: no se queda a
 *  medias), la descarga clásica con el nombre del fichero. */
export async function guardarEn(destino: FileSystemFileHandle | null, fichero: Fichero): Promise<string> {
  if (destino) {
    let escritura: FileSystemWritableFileStream | null = null
    try {
      escritura = await destino.createWritable()
      await escritura.write(fichero.blob)
      await escritura.close()
      return destino.name
    } catch {
      await escritura?.abort().catch(() => {})
    }
  }
  descargarBlob(fichero.blob, fichero.nombre)
  return fichero.nombre
}
