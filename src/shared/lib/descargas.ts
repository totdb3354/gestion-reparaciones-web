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
