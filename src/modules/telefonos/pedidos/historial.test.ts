import { describe, expect, it } from 'vitest'
import type { CambioImei } from '@/shared/api/client'
import { fila } from '../test/fabrica'
import { construirHistorial } from './historial'

const cambio = (fecha: string, p: Partial<CambioImei> = {}): CambioImei => ({ usuario: 'Supertécnico 1', fecha, imeiAnterior: null, imeiNuevo: '350000000000010', ...p })
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
})
