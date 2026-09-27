/** Dispara un `beforeunload` cancelable en la ventana y dice si alguien lo canceló, es decir, si el navegador preguntaría
 *  antes de salir (useAvisoAlSalir). */
export function avisaAlSalir(): boolean {
  return !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
}
