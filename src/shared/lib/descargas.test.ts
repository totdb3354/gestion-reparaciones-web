import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarBlob, nombreDeDescarga } from './descargas'

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
