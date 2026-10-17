import { describe, expect, it } from 'vitest'
import { clasesUbicacion, diaNsys, textoGrado, nombreModeloNsys, textoEstadoMovil } from './telefonoNsys'

describe('piezas compartidas del espejo de NSYS', () => {
  it('nombre del modelo: el código del ERP, si no el del maestro y si no un aviso', () => {
    expect(nombreModeloNsys('13pro', '13 PRO')).toBe('iPhone 13 Pro')
    expect(nombreModeloNsys(null, 'SE2022')).toBe('iPhone SE2022')
    expect(nombreModeloNsys(null, null)).toBe('Sin modelo en el maestro')
  })

  it('colores de las ubicaciones; las desconocidas en gris', () => {
    expect(clasesUbicacion('Listos')).toBe('bg-fila-recibido-bg text-fila-recibido-brd')
    expect(clasesUbicacion('Taller · Glass')).toBe('bg-tipo-glass-bg text-tipo-glass-text')
    expect(clasesUbicacion('Caja nueva')).toBe('bg-badge-neutro-bg text-azul-gris')
    expect(clasesUbicacion(null)).toBe('bg-badge-neutro-bg text-azul-gris')
  })

  it('texto del estado del móvil', () => {
    expect(['STOCK', 'DE_PEDIDO', 'NO_CUENTA', 'VENDIDO', 'BAJA'].map(textoEstadoMovil))
      .toEqual(['Libre', 'De pedido', 'No cuenta como stock', 'Vendido', 'Baja en NSYS'])
  })

  it('día de NSYS en dd/mm/aaaa, con o sin hora detrás', () => {
    expect(diaNsys('2023-05-02')).toBe('02/05/2023')
    expect(diaNsys('2026-09-12T13:01:00')).toBe('12/09/2026')
  })
})

describe('textoGrado', () => {
  it('el 100 del final es batería nueva; sin grado, raya', () => {
    expect(textoGrado('A100')).toBe('A · batería nueva')
    expect(textoGrado('A-100')).toBe('A- · batería nueva')
    expect(textoGrado('C')).toBe('C')
    expect(textoGrado('n/a')).toBe('n/a')
    expect(textoGrado('')).toBe('—')
    expect(textoGrado(null)).toBe('—')
    expect(textoGrado(undefined)).toBe('—')
  })
})
