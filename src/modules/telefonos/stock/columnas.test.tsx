import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/shared/ui/DataTable'
import { visto } from '../test/fabrica'
import { columnasMoviles, compararTexto } from './columnas'

// Cuatro móviles, en este orden «de siempre»; el 4 no tiene capacidad, color, grado, SKU, caja ni días.
const MOVILES = [
  visto({ imeiSn: '350000000000001', capacidad: '1TB', color: 'Rosa', grado: 'B', sku: 'i13RosaB', ubicacion: 'Caja 10', dias: 0 }),
  visto({ imeiSn: '350000000000002', capacidad: '128GB', color: 'azul', grado: 'A-', sku: 'i13AzulA-', ubicacion: 'Caja 2', dias: 12 }),
  visto({ imeiSn: '350000000000003', capacidad: '256GB', color: 'Blanco', grado: 'A+', sku: 'i13BlancoA+', ubicacion: 'caja 3', dias: 5 }),
  visto({ imeiSn: '350000000000004', capacidad: '', color: undefined, grado: undefined, sku: undefined, ubicacion: undefined, dias: undefined }),
]

function pintar() {
  render(<DataTable columns={columnasMoviles(() => {}, { conCapacidad: true })} data={MOVILES} vacio="" ordenacion getRowId={(m) => m.imeiSn} />)
}
/** La última cifra del IMEI de cada fila, en el orden en que se pintan. */
const orden = () => screen.getAllByRole('row').slice(1).map((f) => within(f).getByRole('button', { name: /^Abrir / }).textContent?.slice(-1)).join('')
const pulsar = (columna: string) => userEvent.click(screen.getByRole('button', { name: columna }))

describe('columnas de la tabla de móviles: por qué se ordena cada una (0.9.29, spec «ordenar por columna» §5)', () => {
  it('compararTexto: sin mirar mayúsculas ni acentos y con los números como números', () => {
    expect(['Caja 10', 'caja 3', 'Caja 2', 'Árbol', 'azul'].sort(compararTexto)).toEqual(['Árbol', 'azul', 'Caja 2', 'caja 3', 'Caja 10'])
  })

  it.each([
    ['IMEI', '1234', '4321'],
    ['Cap.', '2314', '1324'],
    ['Color', '2314', '1324'],
    ['Grado', '3214', '1234'],
    ['SKU', '2314', '1324'],
    ['Ubicación', '2314', '1324'],
  ])('%s: primer clic de menor a mayor y segundo al revés, con lo vacío siempre al final', async (columna, asc, desc) => {
    pintar()
    expect(orden()).toBe('1234')
    await pulsar(columna)
    expect(orden()).toBe(asc)
    await pulsar(columna)
    expect(orden()).toBe(desc)
    await pulsar(columna)
    expect(orden()).toBe('1234')
  })

  it('Días: primer clic de mayor a menor (el 0 es un valor, no un vacío) y segundo al revés, con el que no tiene días al final', async () => {
    pintar()
    await pulsar('Días')
    expect(orden()).toBe('2314')
    await pulsar('Días')
    expect(orden()).toBe('1324')
  })

  it('la celda de «Cap.» sigue diciendo «128 GB» y «—»', () => {
    pintar()
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[1]).getAllByRole('cell')[1]).toHaveTextContent('128 GB')
    expect(within(filas[3]).getAllByRole('cell')[1]).toHaveTextContent('—')
  })
})
