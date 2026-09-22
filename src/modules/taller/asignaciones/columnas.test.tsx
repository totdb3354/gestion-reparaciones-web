import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { AlertaProvider } from '@/shared/ui/AlertaProvider'
import { DataTable } from '@/shared/ui/DataTable'
import { glass, resumen, tecnico } from '../test/fabrica'
import { claseFilaAsignacion, crearColumnas, type OpcionesColumnas } from './columnas'

const TECNICOS = [tecnico({ idTec: 4, nombre: 'Técnico A' }), tecnico({ idTec: 6, nombre: 'Técnico H' })]

const opciones = (p: Partial<OpcionesColumnas> = {}): OpcionesColumnas => ({
  soloLectura: false,
  tecnicos: TECNICOS,
  onReasignar: vi.fn(),
  onBorrar: vi.fn(),
  hoy: '2026-09-16',
  ...p,
})

function pintar(filas: ReparacionResumen[], o: OpcionesColumnas) {
  return render(
    <AlertaProvider>
      <DataTable columns={crearColumnas(o)} data={filas} vacio="sin filas" getRowId={(r) => r.idRep} filaClase={claseFilaAsignacion} />
    </AlertaProvider>,
  )
}

/** [id, cabecera, size]: los prefWidth de PendientesSuperTecnicoView.fxml, en el orden de la spec §7. */
const DIEZ_PRIMERAS = [
  ['id', 'Id Asignación', 90],
  ['tipo', 'Tipo', 90],
  ['tecnico', 'Técnico', 110],
  ['imei', 'IMEI', 130],
  ['modelo', 'Modelo', 120],
  ['fecha', 'Fecha asignación', 130],
  ['comentario', 'Comentario', 160],
  ['cliente', 'Cliente', 110],
  ['asignadoPor', 'Asignado por', 120],
  ['estado', 'Estado', 100],
]

describe('crearColumnas: las once columnas de la tabla de asignaciones', () => {
  it('el orden, las cabeceras y los anchos del FXML, con la papelera al final', () => {
    const cols = crearColumnas(opciones())
    expect(cols.map((c) => [c.id, c.header, c.size])).toEqual([...DIEZ_PRIMERAS, ['borrar', '', 45]])
  })

  it('ninguna columna ordena (D5: el orden de prioridad es funcional)', () => {
    expect(crearColumnas(opciones()).every((c) => c.enableSorting === false)).toBe(true)
  })

  it('en solo lectura la papelera no existe (ADMIN, spec §12)', () => {
    const cols = crearColumnas(opciones({ soloLectura: true }))
    expect(cols.map((c) => [c.id, c.header, c.size])).toEqual(DIEZ_PRIMERAS)
  })
})

describe('crearColumnas: "hoy" lo calcula la página, no la construcción de las columnas', () => {
  it('el badge de entrega de la misma fila cambia de forma según el "hoy" recibido (D3: no se congela a medianoche)', () => {
    const fila = glass('2026-09-16T07:02:00')

    const { unmount } = pintar([fila], opciones({ soloLectura: true, hoy: '2026-09-16' }))
    expect(screen.getByText('Llegó 09:02')).toBeInTheDocument()
    unmount()

    pintar([fila], opciones({ soloLectura: true, hoy: '2026-09-17' }))
    expect(screen.getByText('Llegó 16/09')).toBeInTheDocument()
  })
})

describe('claseFilaAsignacion: la franja de 8 px de la fila', () => {
  it('ámbar con solicitud de pieza, roja en incidencia y transparente si no', () => {
    expect(claseFilaAsignacion(resumen({ esSolicitud: 1 }))).toContain('border-l-fila-solicitud-brd')
    expect(claseFilaAsignacion(resumen({ esIncidencia: true }))).toContain('border-l-fila-incidencia-brd')
    expect(claseFilaAsignacion(resumen())).toContain('border-l-transparent')
    expect(claseFilaAsignacion(resumen())).toContain('border-l-8')
  })
})

describe('crearColumnas: contenido de las celdas', () => {
  it('id, tipo con Chasis, IMEI con su píldora, modelo traducido, fecha, cliente y quien la asignó', () => {
    const fila = resumen({
      idRep: 'A20260916_1', imei: '000000000000001', esChasis: true, modelo: '14',
      fechaAsig: '2026-09-16T07:02:00', cliente: 'Cliente Uno', nombreTecnicoAsigna: 'Técnico F',
      glassAbierta: true, glassTecnicoNombre: 'Técnico H',
    })
    pintar([fila], opciones({ soloLectura: true }))
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
    expect(screen.getByText('Reparación')).toBeInTheDocument()
    expect(screen.getByText('Chasis')).toBeInTheDocument()
    expect(screen.getByText('000000000000001')).toBeInTheDocument()
    expect(screen.getByText('Glass: Técnico H')).toBeInTheDocument()
    expect(screen.getByText('iPhone 14')).toBeInTheDocument()
    expect(screen.getByText('2026/09/16 09:02')).toBeInTheDocument()
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument()
    expect(screen.getByText('Técnico F')).toBeInTheDocument()
  })

  it('sin asignador, "Asignado por" pinta "—" (calco del cAsignadoPor del JavaFX)', () => {
    pintar([resumen({ nombreTecnicoAsigna: null })], opciones({ soloLectura: true }))
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('el comentario abre el popup de lectura al pulsarlo', async () => {
    pintar([resumen({ comentarioAsignacion: 'Revisar el conector' })], opciones({ soloLectura: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar el conector' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Comentario')).toBeInTheDocument()
    expect(within(dialogo).getByText('Revisar el conector')).toBeInTheDocument()
  })

  it('Estado apila los badges de badgesEstado', () => {
    pintar([resumen({ urgente: true, porCerrar: true })], opciones({ soloLectura: true }))
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Por cerrar')).toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
  })
})

describe('crearColumnas: columna Técnico y papelera', () => {
  it('en solo lectura el técnico es texto plano, sin desplegable', () => {
    pintar([resumen({ idTec: 4, nombreTecnico: 'Técnico A' })], opciones({ soloLectura: true }))
    expect(screen.getByText('Técnico A')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar asignación' })).not.toBeInTheDocument()
  })

  it('editable: el desplegable muestra el técnico actual y al elegir otro llama a onReasignar', async () => {
    const onReasignar = vi.fn()
    pintar([resumen({ idRep: 'AG20260916_2', idTec: 4, nombreTecnico: 'Técnico A' })], opciones({ onReasignar }))
    const combo = screen.getByRole('combobox', { name: 'Técnico de AG20260916_2' })
    expect(combo).toHaveTextContent('Técnico A')
    await userEvent.click(combo)
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'Técnico H' }))
    expect(onReasignar).toHaveBeenCalledExactlyOnceWith('AG20260916_2', 6)
  })

  it('editable: la papelera llama a onBorrar con la fila', async () => {
    const onBorrar = vi.fn()
    const fila = resumen({ idRep: 'AP20260916_3' })
    pintar([fila], opciones({ onBorrar }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar asignación' }))
    expect(onBorrar).toHaveBeenCalledExactlyOnceWith(fila)
  })
})
