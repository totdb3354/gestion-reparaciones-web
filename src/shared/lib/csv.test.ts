import { afterEach, describe, expect, it, vi } from 'vitest'
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
  it('descargarCsv, sin "Guardar como" en el navegador, crea un enlace con el nombre <base>_yyyy-MM-dd_HH-mm.csv y lo pulsa', async () => {
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

describe('descargarCsv con "Guardar como" (calco del FileChooser de CsvExporter.exportar)', () => {
  const ahora = new Date(2026, 8, 16, 9, 5)
  const cabeceras = ['ID', 'IMEI']
  const filas = [['R1', textoForzado('351')], ['R2', 'a;b']]

  function espiarDescarga() {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  }
  function ofrecerVentana(impl: () => Promise<FileSystemFileHandle>) {
    const ventana = vi.fn(impl)
    window.showSaveFilePicker = ventana
    return ventana
  }

  afterEach(() => {
    delete window.showSaveFilePicker
    vi.restoreAllMocks()
  })

  it('abre la ventana con el nombre propuesto y el tipo CSV, y escribe el mismo contenido que la descarga', async () => {
    const clic = espiarDescarga()
    const escrito: Blob[] = []
    const cerrar = vi.fn(async () => {})
    const ventana = ofrecerVentana(async () => ({
      createWritable: async () => ({ write: async (b: Blob) => { escrito.push(b) }, close: cerrar }),
    }) as unknown as FileSystemFileHandle)
    await descargarCsv('mis_pendientes', cabeceras, filas, ahora)
    expect(ventana).toHaveBeenCalledWith({ suggestedName: 'mis_pendientes_2026-09-16_09-05.csv', types: [{ accept: { 'text/csv': ['.csv'] } }] })
    expect(escrito).toHaveLength(1)
    expect(escrito[0].type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await escrito[0].arrayBuffer())
    expect(Array.from(bytes)).toEqual(Array.from(new TextEncoder().encode(generarCsv(cabeceras, filas))))
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(clic).not.toHaveBeenCalled()
  })

  it('si el usuario cancela la ventana, no descarga nada ni lanza', async () => {
    const clic = espiarDescarga()
    ofrecerVentana(async () => { throw new DOMException('cancelado', 'AbortError') })
    await expect(descargarCsv('mis_pendientes', cabeceras, filas, ahora)).resolves.toBeUndefined()
    expect(clic).not.toHaveBeenCalled()
  })

  it('si la ventana falla por otro motivo (sin gesto de usuario), descarga como siempre', async () => {
    const clic = espiarDescarga()
    ofrecerVentana(async () => { throw new DOMException('sin gesto', 'SecurityError') })
    await descargarCsv('mis_pendientes', cabeceras, filas, ahora)
    expect(clic).toHaveBeenCalledTimes(1)
    expect((clic.mock.instances[0] as HTMLAnchorElement).download).toBe('mis_pendientes_2026-09-16_09-05.csv')
  })

  it('si escribir el fichero elegido falla, descarga como siempre', async () => {
    const clic = espiarDescarga()
    ofrecerVentana(async () => ({ createWritable: async () => { throw new DOMException('no', 'NotAllowedError') } }) as unknown as FileSystemFileHandle)
    await descargarCsv('mis_pendientes', cabeceras, filas, ahora)
    expect(clic).toHaveBeenCalledTimes(1)
  })
})
