import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConRouter, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { asignacionActiva } from '../test/fabrica'
import { FormularioReparacion } from './FormularioReparacion'
import { conRegistro, type EscenarioFormulario, type LlamadaRegistrada } from './test/handlers'

const TITULO = 'Nueva reparación — IMEI 355400000000111'

/** Monta el formulario de la asignación A20260916_1 (IMEI 355400000000111, del técnico de SESION_TEC) sobre un data router. */
function abrir(escenario: EscenarioFormulario = {}) {
  const onCerrar = vi.fn()
  const { handlers, llamadas } = conRegistro(escenario)
  server.use(...handlers)
  const r = renderConRouter([{ path: '/', element: <FormularioReparacion modo="nuevo" idAsignacion="A20260916_1" onCerrar={onCerrar} /> }], { sesion: SESION_TEC, ruta: '/' })
  return { ...r, onCerrar, llamadas }
}

/** Escrituras del formulario en orden, sin las del borrador. `conRegistro` anota `metodo` en mayúsculas (`request.method`), `ruta` =
 *  pathname (`/api/reparaciones/...`) y `cuerpo` = JSON recibido (null si no hay): se comparan tal cual. */
const escrituras = (llamadas: LlamadaRegistrada[]) =>
  llamadas.filter((l) => !l.ruta.endsWith('/borrador'))

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

describe('FormularioReparacion · filas y "✓ Guardar fila"', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 16, 9, 15))
  })
  afterEach(() => vi.useRealTimers())

  it('"✓ Guardar fila" → "✓ Confirmar" → POST con el cuerpo exacto; éxito: fila verde con "✓ Guardada dd/MM HH:mm" y controles deshabilitados', async () => {
    const { llamadas } = abrir({ incidencia: 'R20260910_3' })
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Confirmar')
    expect(escrituras(llamadas)).toEqual([])
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await waitFor(() => expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardada 16/09 09:15'))
    expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'guardada')
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeDisabled()
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toBeDisabled()
    expect(escrituras(llamadas)).toEqual([
      {
        metodo: 'POST',
        ruta: '/api/reparaciones/A20260916_1/filas',
        cuerpo: {
          filas: [{ idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }],
          imei: '355400000000111',
          idTec: 4,
          idRepAnterior: 'R20260910_3',
        },
      },
    ])
  })

  it('cambiar algo tras el primer clic vuelve a "✓ Guardar fila" y no se llama al servidor', async () => {
    const { llamadas } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardar fila')
    expect(escrituras(llamadas)).toEqual([])
  })

  it('error 409: aviso "No se pudo guardar la fila: <mensaje del servidor>" y la fila sigue editable', async () => {
    abrir()
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => HttpResponse.json({ message: 'La asignación ya fue eliminada o completada' }, { status: 409 })))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await userEvent.click(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    expect(await screen.findByText('No se pudo guardar la fila: La asignación ya fue eliminada o completada')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'normal')
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardar fila')
    expect(screen.getByTestId('boton-derecho-bat')).toBeEnabled()
    expect(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Sumar Batería' })).toBeEnabled()
  })

  it('mientras guarda el botón está deshabilitado', async () => {
    abrir()
    let soltar: () => void = () => {}
    const puerta = new Promise<void>((resolve) => { soltar = resolve })
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', async () => { await puerta; return HttpResponse.json({ value: 'R20260916_9' }) }))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await userEvent.click(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await waitFor(() => expect(screen.getByTestId('boton-derecho-bat')).toBeDisabled())
    expect(screen.getByTestId('boton-derecho-bat')).not.toHaveTextContent('Guardada')
    soltar()
    await waitFor(() => expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardada 16/09 09:15'))
  })
})
