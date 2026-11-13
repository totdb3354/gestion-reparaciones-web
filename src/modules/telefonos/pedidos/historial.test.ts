import { describe, expect, it } from 'vitest'
import type { CambioImei } from '@/shared/api/client'
import { fila } from '../test/fabrica'
import { construirHistorial } from './historial'

const cambio = (fecha: string, p: Partial<CambioImei> = {}): CambioImei => ({ usuario: 'Supertécnico 1', fecha, imeiAnterior: null, imeiNuevo: '350000000000010', tipo: 'IMEI', ...p })
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
})
