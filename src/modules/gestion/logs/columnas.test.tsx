import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LogActividad } from '@/shared/api/client'
import { DataTable } from '@/shared/ui/DataTable'
import { COLUMNAS_LOGS, textoDetalle } from './columnas'

const log = (o: Partial<LogActividad> = {}): LogActividad => ({
  idLog: 1,
  fecha: '2026-06-09T23:30:05',
  nombreUsuario: 'usuario-a',
  accion: 'CREAR_ASIGNACION',
  detalle: 'ID_REP: R1, IMEI: 000000000000000, MODELO: X, TECNICO: tecnico-a',
  motivo: null,
  ...o,
})

function celdas(l: LogActividad): (string | null)[] {
  render(<DataTable columns={COLUMNAS_LOGS} data={[l]} vacio="vacío" />)
  const fila = screen.getAllByRole('row')[1]
  return within(fila).getAllByRole('cell').map((c) => c.textContent)
}

describe('COLUMNAS_LOGS (LogView.fxml :48-59)', () => {
  it('Fecha, Usuario, Acción y Detalle con los prefWidth del JavaFX (Detalle es la columna flexible)', () => {
    expect(COLUMNAS_LOGS.map((c) => c.header)).toEqual(['Fecha', 'Usuario', 'Acción', 'Detalle'])
    expect(COLUMNAS_LOGS.map((c) => c.size)).toEqual([150, 80, 180, 400])
  })
  it('fecha "dd/MM/yyyy HH:mm:ss" en hora de Madrid (verano, +2 h); usuario, acción y detalle tal cual', () => {
    expect(celdas(log())).toEqual(['10/06/2026 01:30:05', 'usuario-a', 'CREAR_ASIGNACION', 'ID_REP: R1, IMEI: 000000000000000, MODELO: X, TECNICO: tecnico-a'])
  })
  it('en invierno la diferencia es de 1 h y los segundos se conservan', () => {
    expect(celdas(log({ fecha: '2026-01-15T23:00:09' }))[0]).toBe('16/01/2026 00:00:09')
  })
  it('detalle null: celda vacía; el detalle va en una sola línea con elipsis', () => {
    expect(celdas(log({ detalle: null }))[3]).toBe('')
    const { container } = render(<DataTable columns={COLUMNAS_LOGS} data={[log()]} vacio="vacío" />)
    const detalle = container.querySelectorAll('tbody tr')[0].querySelectorAll('td')[3].firstElementChild
    expect(detalle).toHaveClass('block', 'truncate')
  })
})

describe('textoDetalle (doble clic, LogController :93-103)', () => {
  it('sin motivo: el detalle tal cual', () => {
    expect(textoDetalle(log())).toBe('ID_REP: R1, IMEI: 000000000000000, MODELO: X, TECNICO: tecnico-a')
  })
  it('con motivo: línea en blanco y "MOTIVO: …"', () => {
    expect(textoDetalle(log({ detalle: 'ID_REP: R2', motivo: 'Duplicada' }))).toBe('ID_REP: R2\n\nMOTIVO: Duplicada')
  })
  it('motivo en blanco no añade nada; detalle null cuenta como ""', () => {
    expect(textoDetalle(log({ detalle: 'ID_REP: R3', motivo: '   ' }))).toBe('ID_REP: R3')
    expect(textoDetalle(log({ detalle: null, motivo: null }))).toBe('')
    expect(textoDetalle(log({ detalle: null, motivo: 'Error de alta' }))).toBe('\n\nMOTIVO: Error de alta')
  })
})
