import { describe, expect, it } from 'vitest'
import type { CambioImei } from '@/shared/api/client'
import { fila } from '../test/fabrica'
import { construirHistorial } from './historial'

const cambio = (fecha: string, p: Partial<CambioImei> = {}): CambioImei => ({ usuario: 'Supertécnico 1', fecha, imeiAnterior: null, imeiNuevo: '350000000000010', tipo: 'IMEI', detalle: null, ...p })
const claves = (f: ReturnType<typeof fila>, c: CambioImei[]) => construirHistorial(f, c).map((e) => e.tipo)

describe('construirHistorial', () => {
  it('sin cambios ni envío, solo «entró» con el día', () => {
    const h = construirHistorial(fila({ fecha: '2026-11-09' }), [])
    expect(h).toEqual([{ tipo: 'entro', clave: 'entro', cuando: '2026-11-09T00:00:00', conHora: false }])
  })

  it('mezcla cambios y hitos, del más reciente al más antiguo', () => {
    const f = fila({ fecha: '2026-11-09', envioFecha: '2026-11-09T10:30:00', impresaEn: '2026-11-10T09:15:00', transportista: 'UPSv2' })
    const h = construirHistorial(f, [cambio('2026-11-09T12:00:00'), cambio('2026-11-10T08:00:00'), cambio('2026-11-08T23:00:00')])
    expect(h.map((e) => e.cuando)).toEqual(['2026-11-10T09:15:00', '2026-11-10T08:00:00', '2026-11-09T12:00:00', '2026-11-09T10:30:00', '2026-11-09T00:00:00', '2026-11-08T23:00:00'])
    expect(h.map((e) => e.tipo)).toEqual(['enviado', 'imei', 'imei', 'etiqueta', 'entro', 'imei'])
    expect(h.find((e) => e.tipo === 'etiqueta')).toMatchObject({ transportista: 'UPSv2', conHora: true })
  })

  it('un cambio anterior al día de entrada queda debajo de «entró»; el día cuenta como su inicio', () => {
    expect(claves(fila({ fecha: '2026-11-09' }), [cambio('2026-11-09T00:00:01'), cambio('2026-11-08T23:59:59')])).toEqual(['imei', 'entro', 'imei'])
  })

  it('con el mismo instante, el cambio de IMEI va por encima del hito', () => {
    const f = fila({ fecha: '2026-11-09', envioFecha: '2026-11-09T10:30:00' })
    expect(claves(f, [cambio('2026-11-09T10:30:00')])).toEqual(['imei', 'etiqueta', 'entro'])
    expect(claves(fila({ fecha: '2026-11-09' }), [cambio('2026-11-09T00:00:00')])).toEqual(['imei', 'entro'])
  })

  it('con el mismo instante entre cambios, se respeta el orden recibido', () => {
    const h = construirHistorial(fila({ fecha: '2026-11-01' }), [cambio('2026-11-09T10:00:00', { imeiNuevo: '350000000000011' }), cambio('2026-11-09T10:00:00', { imeiNuevo: '350000000000012' })])
    expect(h.map((e) => (e.tipo === 'imei' ? e.cambio.imeiNuevo : null)).slice(0, 2)).toEqual(['350000000000011', '350000000000012'])
  })

  it('no inventa hitos que la fila no tiene', () => {
    expect(claves(fila({ fecha: '2026-11-09', envioFecha: null, impresaEn: null }), [])).toEqual(['entro'])
  })

  it('las marcas de «falta por enviar» salen con su texto y su autor, y no como cambios de IMEI', () => {
    const marca = (tipo: string, usuario: string | null, fecha: string) => cambio(fecha, { tipo, usuario, imeiNuevo: null })
    const h = construirHistorial(fila({ fecha: '2026-11-01' }), [
      marca('YA_ENVIADO', null, '2026-11-12T09:00:00'),
      marca('YA_ENVIADO', 'Técnico 2', '2026-11-11T09:00:00'),
      marca('FALTA_ENVIAR', 'Técnico 1', '2026-11-10T09:00:00'),
    ])
    expect(h.slice(0, 3)).toEqual([
      { tipo: 'marca', clave: 'i0', cuando: '2026-11-12T09:00:00', conHora: true, texto: 'Ya ha salido: sincronizado con la web', quien: 'plugin de la web' },
      { tipo: 'marca', clave: 'i1', cuando: '2026-11-11T09:00:00', conHora: true, texto: 'Ya ha salido (marca quitada)', quien: 'Técnico 2' },
      { tipo: 'marca', clave: 'i2', cuando: '2026-11-10T09:00:00', conHora: true, texto: 'Marcada: falta por enviar', quien: 'Técnico 1' },
    ])
  })

  it('un apunte de IMEI sin usuario sigue siendo el traspaso de la hoja (tipo IMEI)', () => {
    const h = construirHistorial(fila({ fecha: '2026-11-09' }), [cambio('2026-11-09T08:00:00', { usuario: null })])
    expect(h[0]).toMatchObject({ tipo: 'imei' })
  })

  it('«sincronizadaEn» es un hito «Sincronizado con la web» en su fecha', () => {
    const h = construirHistorial(fila({ fecha: '2026-11-09', sincronizadaEn: '2026-11-12T09:00:00' }), [])
    expect(h[0]).toEqual({ tipo: 'sincronizado', clave: 'sincronizado', cuando: '2026-11-12T09:00:00', conHora: true })
  })

  it('MARCA y MARCA_QUITADA salen como marcas con su texto, su nota y quién', () => {
    const h = construirHistorial(fila({ fecha: '2026-11-09' }), [
      cambio('2026-11-12T10:00:00', { tipo: 'MARCA', imeiNuevo: null, detalle: 'ESPERA_STOCK — llega el lunes — y el martes' }),
      cambio('2026-11-12T09:00:00', { tipo: 'MARCA', imeiNuevo: null, detalle: 'CANCELADO' }),
      cambio('2026-11-11T09:00:00', { tipo: 'MARCA_QUITADA', imeiNuevo: null, detalle: 'EN_REVISION' }),
      cambio('2026-11-10T09:00:00', { tipo: 'MARCA_QUITADA', imeiNuevo: null, detalle: 'ESPERA_STOCK — al poner el IMEI' }),
    ])
    expect(h.slice(0, 4)).toMatchObject([
      { tipo: 'marca', texto: 'Marca: En espera de stock — llega el lunes — y el martes', quien: 'Supertécnico 1' },
      { tipo: 'marca', texto: 'Marca: Cancelado' },
      { tipo: 'marca', texto: 'Marca quitada (En revisión)' },
      { tipo: 'marca', texto: 'Marca quitada al poner el IMEI (En espera de stock)' },
    ])
  })

  it('una validación vieja (COLOR_O_GRADO) sigue leyéndose «otro color o grado», en corto', () => {
    const h = construirHistorial(fila(), [cambio('2026-11-16T09:30:00', { tipo: 'VALIDADA', detalle: 'COLOR_O_GRADO', imeiNuevo: null })])
    expect(h.find((e) => e.tipo === 'marca')).toMatchObject({ texto: 'SKU validado (otro color o grado)' })
  })

  it('una validación sin detalle se lee «SKU validado», sin «(revisar)»', () => {
    const h = construirHistorial(fila(), [cambio('2026-11-16T09:30:00', { tipo: 'VALIDADA', detalle: null, imeiNuevo: null })])
    expect(h.find((e) => e.tipo === 'marca')).toMatchObject({ texto: 'SKU validado' })
  })
})

describe('construirHistorial: la reserva de IMEI', () => {
  const A = '350000000000010', B = '350000000000020'
  const una = (c: Partial<CambioImei>) => construirHistorial(fila({ fecha: '2026-11-09' }), [cambio('2026-11-24T10:00:00', { usuario: null, imeiNuevo: null, ...c })]).filter((e) => e.tipo === 'reserva')

  it('RESERVADO: etiqueta azul, el IMEI con el porqué y la caja aparte (aunque la caja lleve « · »)', () => {
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 1 · Caja · Listos · A-' })).toMatchObject([{ etiqueta: 'Reservado', tono: 'res', texto: `${A} · Puesto 1 · A-`, caja: 'Caja · Listos', quien: 'ERP' }])
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 2 · Caja · Pantalla rota · A' })).toMatchObject([{ texto: `${A} · Puesto 2 · A`, caja: 'Caja · Pantalla rota' }])
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 3' })).toMatchObject([{ texto: `${A} · Puesto 3`, caja: undefined }])
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 3 · Devolución · A-' })).toMatchObject([{ texto: `${A} · Puesto 3 · A-`, caja: 'Devolución' }])
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 3 · En revisión · A' })).toMatchObject([{ texto: `${A} · Puesto 3 · A`, caja: 'En revisión' }])
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 1 · Caja · Listos · N/A (es A)' })).toMatchObject([{ texto: `${A} · Puesto 1 · N/A (es A)`, caja: 'Caja · Listos' }])
    expect(una({ tipo: 'RESERVADO', imeiNuevo: A, detalle: 'Puesto 2 · CAJA RARA · B' })).toMatchObject([{ texto: `${A} · Puesto 2 · B`, caja: 'CAJA RARA' }])
  })
  it('RESERVA_CONFIRMADA: verde, por quién; sin usuario, por el ERP', () => {
    expect(una({ tipo: 'RESERVA_CONFIRMADA', imeiAnterior: A, imeiNuevo: A, usuario: 'Fati' })).toMatchObject([{ etiqueta: 'Confirmado', tono: 'ok', texto: `por Fati · ${A}`, quien: 'Fati' }])
    expect(una({ tipo: 'RESERVA_CONFIRMADA', imeiAnterior: A, imeiNuevo: A })).toMatchObject([{ texto: `por el ERP · ${A}`, quien: 'ERP' }])
  })
  it('RESERVA_SUSTITUIDA: dos entradas, «Picó otro» (gris, con el usuario) y «Vuelve a stock» (morado)', () => {
    const h = una({ tipo: 'RESERVA_SUSTITUIDA', imeiAnterior: A, imeiNuevo: B, usuario: 'Fati' })
    expect(h).toHaveLength(2)
    expect(h.map((e) => e.etiqueta)).toEqual(['Picó otro', 'Vuelve a stock'])
    expect(h.find((e) => e.etiqueta === 'Picó otro')).toMatchObject({ tono: 'gris', texto: `${B} en lugar del reservado ${A}`, quien: 'Fati' })
    expect(h.find((e) => e.etiqueta === 'Vuelve a stock')).toMatchObject({ tono: 'dev', texto: A })
    expect(new Set(h.map((e) => e.clave)).size).toBe(2)
  })
  it('RESERVA_QUITADA: según el motivo', () => {
    const q = (detalle: string) => una({ tipo: 'RESERVA_QUITADA', imeiAnterior: A, detalle })[0]
    expect(q('CANCELADA')).toMatchObject({ etiqueta: 'Cancelado', tono: 'mal', texto: `${A}: el pedido ya no está en ShippyPro o se marcó` })
    expect(q('ENVIADA_SIN_IMEI')).toMatchObject({ etiqueta: 'Reserva quitada', tono: 'aviso', texto: `${A}: se envió sin picar el IMEI` })
    expect(q('NO_ENCONTRADO')).toMatchObject({ etiqueta: 'Reserva quitada', tono: 'aviso', texto: `${A} está en «Pendiente revisar…» en NSYS` })
    expect(q('NO_DISPONIBLE')).toMatchObject({ etiqueta: 'Reserva quitada', tono: 'aviso', texto: `${A} ya no está disponible` })
  })
  it('SIN_STOCK: naranja', () => {
    expect(una({ tipo: 'SIN_STOCK' })).toMatchObject([{ etiqueta: 'Sin stock', tono: 'mal', texto: 'Ningún teléfono cumple los criterios' }])
  })
})
