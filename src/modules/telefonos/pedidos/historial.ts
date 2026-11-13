import type { CambioImei, FilaVista } from '@/shared/api/client'

/** Una entrada del «Historial» del panel: un cambio de IMEI (del servidor) o un hito de la propia fila. `cuando` es el instante
 *  para ordenar («2026-11-09T10:30:00»); `conHora` es false en el hito que solo trae el día (la entrada desde ShippyPro). */
export type EntradaHistorial =
  | { tipo: 'imei'; clave: string; cuando: string; conHora: true; cambio: CambioImei }
  | { tipo: 'marca'; clave: string; cuando: string; conHora: true; texto: string; quien: string }
  | { tipo: 'entro' | 'etiqueta' | 'enviado' | 'sincronizado'; clave: string; cuando: string; conHora: boolean; transportista?: string }

// Entre hitos de la propia fila con el mismo instante, el más avanzado va arriba.
const RANGO = { imei: 3, marca: 3, enviado: 2, sincronizado: 2, etiqueta: 1, entro: 0 } as const

/** El historial de una fila, del más reciente al más antiguo, con lo que la web ya tiene: los cambios de IMEI y tres hitos que salen de
 *  la fila (entró desde ShippyPro con `fecha`, que es solo un día y cuenta como su inicio; etiqueta generada con `envioFecha`;
 *  enviado con `impresaEn`, y sincronizada con la web con `sincronizadaEn`). Con el mismo instante, el cambio de IMEI va por encima del hito. */
export function construirHistorial(fila: FilaVista, cambios: CambioImei[]): EntradaHistorial[] {
  const entradas: EntradaHistorial[] = cambios.map((cambio, i): EntradaHistorial => {
    const cuando = cambio.fecha.slice(0, 19)
    // Las marcas de «falta por enviar» (envío parcial de web) no son cambios de IMEI; un apunte de IMEI sin usuario es el traspaso de la hoja.
    if (cambio.tipo === 'FALTA_ENVIAR') return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Marcada: falta por enviar', quien: cambio.usuario ?? '' }
    if (cambio.tipo === 'YA_ENVIADO') {
      return cambio.usuario
        ? { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Ya ha salido (marca quitada)', quien: cambio.usuario }
        : { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Ya ha salido: sincronizado con la web', quien: 'plugin de la web' }
    }
    return { tipo: 'imei', clave: `i${i}`, cuando, conHora: true, cambio }
  })
  if (fila.fecha) entradas.push({ tipo: 'entro', clave: 'entro', cuando: `${fila.fecha.slice(0, 10)}T00:00:00`, conHora: false })
  if (fila.envioFecha) entradas.push({ tipo: 'etiqueta', clave: 'etiqueta', cuando: fila.envioFecha.slice(0, 19), conHora: true, transportista: fila.transportista ?? undefined })
  if (fila.impresaEn) entradas.push({ tipo: 'enviado', clave: 'enviado', cuando: fila.impresaEn.slice(0, 19), conHora: true })
  if (fila.sincronizadaEn) entradas.push({ tipo: 'sincronizado', clave: 'sincronizado', cuando: fila.sincronizadaEn.slice(0, 19), conHora: true })
  return entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.cuando === b.e.cuando ? RANGO[b.e.tipo] - RANGO[a.e.tipo] || a.i - b.i : a.e.cuando < b.e.cuando ? 1 : -1))
    .map(({ e }) => e)
}
