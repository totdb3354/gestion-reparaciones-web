import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarBlob, elegirDestino, guardarEn, nombreDeDescarga } from './descargas'

describe('descargas (0.9.22: las plantillas de NSYS)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('el nombre sale de Content-Disposition; sin él, null', () => {
    expect(nombreDeDescarga('attachment; filename="NSYS_color_2026-10-25.xlsx"')).toBe('NSYS_color_2026-10-25.xlsx')
    expect(nombreDeDescarga('attachment')).toBeNull()
    expect(nombreDeDescarga(null)).toBeNull()
  })

  it('descarga con un enlace que se pulsa y se quita', () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    descargarBlob(new Blob(['PK']), 'NSYS_altas_2026-10-25.xlsx')
    expect(crear).toHaveBeenCalledTimes(1)
    expect((clic.mock.instances[0] as HTMLAnchorElement).download).toBe('NSYS_altas_2026-10-25.xlsx')
    expect(revocar).toHaveBeenCalledWith('blob:x')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})

describe('«Guardar como» antes de pedir el fichero (0.9.22.1)', () => {
  const XLSX = { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' }
  const fichero = { blob: new Blob(['PK']), nombre: 'NSYS_color_2026-11-03.xlsx' }

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
  const elegido = (nombre: string, escritura: Partial<FileSystemWritableFileStream>) =>
    ({ name: nombre, createWritable: async () => escritura }) as unknown as FileSystemFileHandle

  afterEach(() => {
    delete window.showSaveFilePicker
    vi.restoreAllMocks()
  })

  it('sin la ventana en el navegador, la descarga clásica (null)', async () => {
    await expect(elegirDestino('NSYS_color_2026-11-03.xlsx', XLSX)).resolves.toBeNull()
  })

  it('abre la ventana con el nombre propuesto y el tipo, y da el fichero elegido', async () => {
    const destino = elegido('mio.xlsx', {})
    const ventana = ofrecerVentana(async () => destino)
    await expect(elegirDestino('NSYS_color_2026-11-03.xlsx', XLSX)).resolves.toBe(destino)
    expect(ventana).toHaveBeenCalledWith({
      suggestedName: 'NSYS_color_2026-11-03.xlsx',
      types: [{ accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
    })
  })

  it('si el usuario cancela la ventana, «cancelado»', async () => {
    ofrecerVentana(async () => { throw new DOMException('cancelado', 'AbortError') })
    await expect(elegirDestino('NSYS_color_2026-11-03.xlsx', XLSX)).resolves.toBe('cancelado')
  })

  it('si la ventana falla por otro motivo (sin gesto de usuario), la descarga clásica (null)', async () => {
    ofrecerVentana(async () => { throw new DOMException('sin gesto', 'SecurityError') })
    await expect(elegirDestino('NSYS_color_2026-11-03.xlsx', XLSX)).resolves.toBeNull()
  })

  it('escribe en el fichero elegido, lo cierra y da su nombre, sin descargar', async () => {
    const clic = espiarDescarga()
    const escrito: Blob[] = []
    const cerrar = vi.fn(async () => {})
    const destino = elegido('mio.xlsx', { write: async (b) => { escrito.push(b as Blob) }, close: cerrar })
    await expect(guardarEn(destino, fichero)).resolves.toBe('mio.xlsx')
    expect(escrito).toEqual([fichero.blob])
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(clic).not.toHaveBeenCalled()
  })

  it('sin fichero elegido, la descarga clásica con el nombre del fichero', async () => {
    const clic = espiarDescarga()
    await expect(guardarEn(null, fichero)).resolves.toBe('NSYS_color_2026-11-03.xlsx')
    expect((clic.mock.instances[0] as HTMLAnchorElement).download).toBe('NSYS_color_2026-11-03.xlsx')
  })

  it('si escribir falla a medias, aborta el elegido (no queda a medias) y después descarga', async () => {
    const clic = espiarDescarga()
    const abortar = vi.fn(async () => {})
    const cerrar = vi.fn(async () => {})
    const destino = elegido('mio.xlsx', {
      write: async () => { throw new DOMException('disco lleno', 'QuotaExceededError') }, close: cerrar, abort: abortar,
    })
    await expect(guardarEn(destino, fichero)).resolves.toBe('NSYS_color_2026-11-03.xlsx')
    expect(abortar).toHaveBeenCalledTimes(1)
    expect(cerrar).not.toHaveBeenCalled()
    expect(clic).toHaveBeenCalledTimes(1)
    expect(abortar.mock.invocationCallOrder[0]).toBeLessThan(clic.mock.invocationCallOrder[0])
  })

  it('si no se puede ni abrir para escribir, descarga igual', async () => {
    const clic = espiarDescarga()
    const destino = { name: 'mio.xlsx', createWritable: async () => { throw new DOMException('no', 'NotAllowedError') } } as unknown as FileSystemFileHandle
    await expect(guardarEn(destino, fichero)).resolves.toBe('NSYS_color_2026-11-03.xlsx')
    expect(clic).toHaveBeenCalledTimes(1)
  })
})
