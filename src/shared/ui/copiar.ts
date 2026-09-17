/** Portapapeles con fallback para contextos sin `navigator.clipboard` (http en local) ni `execCommand`
 *  (navegadores que ya lo han retirado). Nunca rechaza: los llamantes hacen `void copiarAlPortapapeles(...)`. */
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
  // fixed + top/left 0: fuera de la vista sin el salto de scroll que daría otra posición
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.left = '0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.focus()
  area.select()
  try {
    document.execCommand('copy')
  } catch {
    /* execCommand ausente o rechazado: sin más fallback, se resuelve en silencio */
  } finally {
    area.remove()
  }
}
