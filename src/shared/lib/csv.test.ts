import { describe, expect, it, vi } from 'vitest'
import { descargarCsv, escaparCsv, generarCsv, textoForzado } from './csv'

describe('csv (calco de CsvExporter)', () => {
  it('textoForzado envuelve en ="…" y escapa comillas; vacío o nulo → vacío', () => {
    expect(textoForzado('123456789012345')).toBe('="123456789012345"')
    expect(textoForzado('valor con "comillas"')).toBe('="valor con ""comillas"""')
    expect(textoForzado('42')).toBe('="42"')
    expect(textoForzado('')).toBe('')
    expect(textoForzado(null)).toBe('')
  })
  it('escapa ; comillas y saltos de línea, y solo entonces', () => {
    expect(escaparCsv('hola')).toBe('hola')
    expect(escaparCsv('a;b')).toBe('"a;b"')
    expect(escaparCsv('di "x"')).toBe('"di ""x"""')
    expect(escaparCsv('l1\nl2')).toBe('"l1\nl2"')
    expect(escaparCsv(null)).toBe('')
  })
  it('genera BOM, cabecera sin escapar, filas con ; y CRLF', () => {
    const csv = generarCsv(['ID', 'IMEI'], [['R1', textoForzado('351')], ['R2', 'a;b']])
    expect(csv).toBe('\uFEFFID;IMEI\r\nR1;"=""351"""\r\nR2;"a;b"\r\n')
  })
  it('descargarCsv crea un enlace con el nombre <base>_yyyy-MM-dd_HH-mm.csv y lo pulsa', () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    descargarCsv('mis_pendientes', ['ID'], [['R1']], new Date(2026, 8, 16, 9, 5))
    expect(crear).toHaveBeenCalledTimes(1)
    const blob = crear.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(clic).toHaveBeenCalledTimes(1)
    const enlace = clic.mock.instances[0] as HTMLAnchorElement
    expect(enlace.download).toBe('mis_pendientes_2026-09-16_09-05.csv')
    expect(revocar).toHaveBeenCalledWith('blob:x')
    vi.restoreAllMocks()
  })
})
