import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderConRouter, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { asignacionActiva } from '../test/fabrica'
import { FormularioReparacion } from './FormularioReparacion'
import { handlersFormulario, type EscenarioFormulario } from './test/handlers'

const TITULO = 'Nueva reparación — IMEI 355400000000111'

/** Monta el formulario de la asignación A20260916_1 (IMEI 355400000000111, del técnico de SESION_TEC) sobre un data router. */
function abrir(escenario: EscenarioFormulario = {}) {
  const onCerrar = vi.fn()
  server.use(...handlersFormulario(escenario))
  const r = renderConRouter([{ path: '/', element: <FormularioReparacion modo="nuevo" idAsignacion="A20260916_1" onCerrar={onCerrar} /> }], { sesion: SESION_TEC, ruta: '/' })
  return { ...r, onCerrar }
}

async function elegirModelo(nombre: string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
  // El manejador de clic vive en el <button> interior de cada <li role="option"> (ComboNavy): clicar la opción misma
  // (el <li>) no lo dispara, porque el evento no baja a un descendiente (ver ComboNavy.test.tsx, que clica el botón).
  await userEvent.click(await screen.findByRole('button', { name: nombre }))
}

describe('FormularioReparacion · cabecera, avisos y cierre (ficha docs/paridad/formulario.md)', () => {
  it('sin modelo: cabecera de columnas visible y "Selecciona un modelo de iPhone para continuar"', async () => {
    abrir()
    expect(await screen.findByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(screen.getByText('IMEI: 355400000000111')).toBeInTheDocument()
    expect(screen.getByText('Filtrar por modelo:')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('— Selecciona modelo —')
    for (const columna of ['Unit (+/-)', 'Componente', 'SKU', 'Stock', '¿Reutilizado?', 'Observación']) expect(screen.getByText(columna)).toBeInTheDocument()
    expect(screen.getByText('Selecciona un modelo de iPhone para continuar')).toBeInTheDocument()
    expect(screen.queryByTestId('fila-bat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('banda-conflicto')).not.toBeInTheDocument()
    expect(screen.queryByTestId('banda-incidencia')).not.toBeInTheDocument()
  })

  it('elegir modelo muestra las filas (data-testid fila-*) en el orden del servidor, sin glass, marco ni otro', async () => {
    abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    expect(screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))).toEqual(['fila-bat', 'fila-cha', 'fila-lcd', 'fila-cam'])
    expect(screen.queryByText('Selecciona un modelo de iPhone para continuar')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('iPhone 13')
  })

  it('las opciones del combo son los modelos con SKU activo, traducidos y en orden de tienda', async () => {
    abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['iPhone 13', 'iPhone 13 Pro Max', 'iPhone 14'])
  })

  it('modelo autodetectado: combo deshabilitado y filas a la vista', async () => {
    abrir({ modeloTelefono: '13' })
    await screen.findByRole('dialog', { name: TITULO })
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    expect(combo).toBeDisabled()
    expect(combo).toHaveTextContent('iPhone 13')
    expect(screen.getByTestId('fila-bat')).toBeInTheDocument()
  })

  it('banda de conflicto con el literal, sin la asignación propia y con "(tú)"', async () => {
    abrir({
      activas: [
        asignacionActiva(),
        asignacionActiva({ idRep: 'A20260916_1', nombreTecnico: 'Técnico A', idTec: 4 }),
        asignacionActiva({ idRep: 'AP20260916_3', nombreTecnico: 'Técnico A', idTec: 4 }),
      ],
    })
    const banda = await screen.findByTestId('banda-conflicto')
    expect(banda.textContent).toBe('⚠ Este IMEI también está asignado a — Glass: Técnico H · Pulido: Técnico A (tú)')
    expect(banda).toHaveClass('bg-aviso-conflicto-bg', 'text-aviso-conflicto-text')
  })

  it('banda de incidencia con el idRep', async () => {
    abrir({ incidencia: 'R20260910_3' })
    const banda = await screen.findByTestId('banda-incidencia')
    expect(banda.textContent).toBe('⚠ Resuelve incidencia: R20260910_3')
    expect(banda).toHaveClass('text-aviso-incidencia-text')
  })

  it('✕ y Escape piden cerrar sin preguntar', async () => {
    const { onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Salir sin guardar')).not.toBeInTheDocument()
  })

  it('con el diálogo abierto, Escape en el combo de modelo cierra la lista sin cerrar el formulario', async () => {
    const { onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
