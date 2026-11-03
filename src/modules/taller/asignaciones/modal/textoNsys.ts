import { cuandoItems } from '@/shared/lib/telefonoNsys'

/** Textos del aviso «no está en NSYS» del modal (0.9.23, spec 2026-11-03 §2.2). `ultimoItems`: la hora (de Madrid, sin zona)
 *  de la última exportación de NSYS; sin ella, los textos no la dicen. */
export function textoLineaNoNsys(ultimoItems: string | null | undefined, ahora: Date = new Date()): string {
  return ultimoItems ? `No está en NSYS · último Items: ${cuandoItems(ultimoItems, ahora)}` : 'No está en NSYS'
}

export function textoAyudaNoNsys(ultimoItems: string | null | undefined, ahora: Date = new Date()): string {
  const items = ultimoItems ? `último Items (${cuandoItems(ultimoItems, ahora)})` : 'último Items'
  return `NSYS no tiene este IMEI en ningún lote del ${items}. Al guardar saldrá en «No está en NSYS».`
}
