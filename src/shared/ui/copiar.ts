/** Portapapeles con fallback para contextos sin `navigator.clipboard` (http en local). */
export async function copiarAlPortapapeles(texto: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return
    }
  } catch {
    /* cae al fallback */
  }
  const area = document.createElement('textarea')
  area.value = texto
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    document.execCommand('copy')
  } finally {
    area.remove()
  }
}
