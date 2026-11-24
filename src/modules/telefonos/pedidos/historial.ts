import type { CambioImei, FilaVista } from '@/shared/api/client'
import { textoMarca, textoMotivoCorto } from './filas'

/** Una entrada del «Historial» del panel: un cambio de IMEI (del servidor) o un hito de la propia fila. `cuando` es el instante
 *  para ordenar («2026-11-09T10:30:00»); `conHora` es false en el hito que solo trae el día (la entrada desde ShippyPro). */
export type TonoReserva = 'res' | 'ok' | 'gris' | 'dev' | 'mal' | 'aviso'

export type EntradaHistorial =
  | { tipo: 'reserva'; clave: string; cuando: string; conHora: true; etiqueta: string; tono: TonoReserva; texto: string; caja?: string; quien: string }
  | { tipo: 'imei'; clave: string; cuando: string; conHora: true; cambio: CambioImei }
  | { tipo: 'marca'; clave: string; cuando: string; conHora: true; texto: string; quien: string }
  | { tipo: 'entro' | 'etiqueta' | 'enviado' | 'sincronizado'; clave: string; cuando: string; conHora: boolean; transportista?: string }

// Entre hitos de la propia fila con el mismo instante, el más avanzado va arriba.
const RANGO = { imei: 3, marca: 3, reserva: 3, enviado: 2, sincronizado: 2, etiqueta: 1, entro: 0 } as const

/** El historial de una fila, del más reciente al más antiguo, con lo que la web ya tiene: los cambios de IMEI y tres hitos que salen de
 *  la fila (entró desde ShippyPro con `fecha`, que es solo un día y cuenta como su inicio; etiqueta generada con `envioFecha`;
 *  enviado con `impresaEn`, y sincronizada con la web con `sincronizadaEn`). Con el mismo instante, el cambio de IMEI va por encima del hito. */
export function construirHistorial(fila: FilaVista, cambios: CambioImei[]): EntradaHistorial[] {
  const entradas: EntradaHistorial[] = cambios.flatMap((cambio, i): EntradaHistorial[] => {
    const cuando = cambio.fecha.slice(0, 19)
    const reserva = entradasDeReserva(cambio, i, cuando)
    if (reserva) return reserva
    return [entradaDeCambio(cambio, i, cuando)]
  })
  return ordenar(fila, entradas)
}

/** Los apuntes de la reserva de IMEI (etiqueta de color + texto); null si el cambio no es de la reserva. La sustitución son dos
 *  entradas: el que picó otro y el reservado que vuelve a stock. */
function entradasDeReserva(c: CambioImei, i: number, cuando: string): EntradaHistorial[] | null {
  const base = { tipo: 'reserva' as const, cuando, conHora: true as const }
  const erp = (c.usuario ?? 'ERP')
  const imei = c.imeiAnterior ?? c.imeiNuevo ?? ''
  switch (c.tipo) {
    case 'RESERVADO': {
      // detalle = «Puesto 1 · Caja · Listos · A-»: la caja (el nombre de la ubicación del ERP, «Caja · Listos»; puede llevar más « · ») sale aparte, como píldora.
      const partes = (c.detalle ?? '').split(' · ')
      const k = partes.indexOf('Caja')
      let caja: string | undefined
      let resto = partes
      if (k >= 0 && partes.length > k + 1) {
        const fin = partes.length > k + 2 ? partes.length - 1 : partes.length
        caja = `Caja · ${partes.slice(k + 1, fin).join(' · ')}`
        resto = [...partes.slice(0, k), ...partes.slice(fin)]
      }
      return [{ ...base, clave: `i${i}`, etiqueta: 'Reservado', tono: 'res', texto: [imei, ...resto.filter(Boolean)].join(' · '), caja, quien: erp }]
    }
    case 'RESERVA_CONFIRMADA':
      return [{ ...base, clave: `i${i}`, etiqueta: 'Confirmado', tono: 'ok', texto: `por ${c.usuario ?? 'el ERP'} · ${imei}`, quien: erp }]
    case 'RESERVA_SUSTITUIDA':
      return [
        { ...base, clave: `i${i}a`, etiqueta: 'Picó otro', tono: 'gris', texto: `${c.imeiNuevo ?? ''} en lugar del reservado ${c.imeiAnterior ?? ''}`, quien: erp },
        { ...base, clave: `i${i}b`, etiqueta: 'Vuelve a stock', tono: 'dev', texto: c.imeiAnterior ?? '', quien: erp },
      ]
    case 'RESERVA_QUITADA': {
      const quitada = (texto: string): EntradaHistorial[] => [{ ...base, clave: `i${i}`, etiqueta: 'Reserva quitada', tono: 'aviso', texto, quien: erp }]
      switch (c.detalle) {
        case 'CANCELADA': return [{ ...base, clave: `i${i}`, etiqueta: 'Cancelado', tono: 'mal', texto: `${imei}: el pedido ya no está en ShippyPro o se marcó`, quien: erp }]
        case 'ENVIADA_SIN_IMEI': return quitada(`${imei}: se envió sin picar el IMEI`)
        case 'NO_ENCONTRADO': return quitada(`${imei} está en «Pendiente revisar…» en NSYS`)
        default: return quitada(`${imei} ya no está disponible`)
      }
    }
    case 'SIN_STOCK':
      return [{ ...base, clave: `i${i}`, etiqueta: 'Sin stock', tono: 'mal', texto: 'Ningún teléfono cumple los criterios', quien: erp }]
    default: return null
  }
}

function entradaDeCambio(cambio: CambioImei, i: number, cuando: string): EntradaHistorial {
    // Las marcas de «falta por enviar» (envío parcial de web) no son cambios de IMEI; un apunte de IMEI sin usuario es el traspaso de la hoja.
    if (cambio.tipo === 'FALTA_ENVIAR') return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Marcada: falta por enviar', quien: cambio.usuario ?? '' }
    if (cambio.tipo === 'MARCA') {
      // detalle = «MARCA» o «MARCA — nota».
      const [marca, ...nota] = (cambio.detalle ?? '').split(' — ')
      return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: `Marca: ${textoMarca(marca)}${nota.length ? ` — ${nota.join(' — ')}` : ''}`, quien: cambio.usuario ?? '' }
    }
    if (cambio.tipo === 'MARCA_QUITADA') {
      // detalle = la marca que tenía; con « — al poner el IMEI», la quitó el ERP al poner el IMEI.
      const [marca, motivo] = (cambio.detalle ?? '').split(' — ')
      const cual = marca ? ` (${textoMarca(marca)})` : ''
      return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: `Marca quitada${motivo ? ` ${motivo}` : ''}${cual}`, quien: cambio.usuario ?? '' }
    }
    if (cambio.tipo === 'VALIDADA') {
      // detalle = el código del motivo de SKU que se dio por bueno.
      const que = cambio.detalle ? textoMotivoCorto({ motivo: cambio.detalle, skuMovil: null, detalle: null } as FilaVista) : null
      return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: `SKU validado${que ? ` (${que})` : ''}`, quien: cambio.usuario ?? '' }
    }
    if (cambio.tipo === 'VALIDACION_QUITADA') {
      return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Validación quitada', quien: cambio.usuario ?? '' }
    }
    // La asociación IMEI-pedido de Amazon la hace una máquina (los libros de ventas, o la carga del histórico): sin usuario.
    if (cambio.tipo === 'ASOCIADA') {
      return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: `Pedido asociado (${cambio.detalle === 'HISTORICO' ? 'histórico de la hoja' : 'libro de ventas'})`, quien: cambio.usuario ?? '' }
    }
    if (cambio.tipo === 'IMEI_INTERCAMBIADO') {
      return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: `IMEI intercambiado ${cambio.detalle ?? ''}`.trim(), quien: cambio.usuario ?? '' }
    }
    if (cambio.tipo === 'YA_ENVIADO') {
      // La quitó el ERP al cancelar la fila (cancelado y falta por enviar no van juntos).
      if (cambio.detalle === 'al cancelar') return { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Quitada «Falta por enviar» al cancelar', quien: cambio.usuario ?? '' }
      return cambio.usuario
        ? { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Ya ha salido (marca quitada)', quien: cambio.usuario }
        : { tipo: 'marca', clave: `i${i}`, cuando, conHora: true, texto: 'Ya ha salido: sincronizado con la web', quien: 'plugin de la web' }
    }
    return { tipo: 'imei', clave: `i${i}`, cuando, conHora: true, cambio }
}

function ordenar(fila: FilaVista, entradas: EntradaHistorial[]): EntradaHistorial[] {
  if (fila.fecha) entradas.push({ tipo: 'entro', clave: 'entro', cuando: `${fila.fecha.slice(0, 10)}T00:00:00`, conHora: false })
  if (fila.envioFecha) entradas.push({ tipo: 'etiqueta', clave: 'etiqueta', cuando: fila.envioFecha.slice(0, 19), conHora: true, transportista: fila.transportista ?? undefined })
  if (fila.impresaEn) entradas.push({ tipo: 'enviado', clave: 'enviado', cuando: fila.impresaEn.slice(0, 19), conHora: true })
  if (fila.sincronizadaEn) entradas.push({ tipo: 'sincronizado', clave: 'sincronizado', cuando: fila.sincronizadaEn.slice(0, 19), conHora: true })
  return entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.cuando === b.e.cuando ? RANGO[b.e.tipo] - RANGO[a.e.tipo] || a.i - b.i : a.e.cuando < b.e.cuando ? 1 : -1))
    .map(({ e }) => e)
}
