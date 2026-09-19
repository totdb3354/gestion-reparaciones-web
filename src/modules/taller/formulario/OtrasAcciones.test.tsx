import { useReducer } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderConProviders } from '@/test/render'
import { agrupados } from '../test/fabrica'
import { estadoInicial, reducir, type DatosNuevo, type EstadoFormulario } from './estado'
import { OtrasAcciones } from './OtrasAcciones'

const DATOS: DatosNuevo = { modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000111', agrupados: agrupados(), solicitudes: [], incidencia: null, modeloTelefono: null }

/** Arnés: el reductor real. "✓ Guardar" aquí solo pide la confirmación (el POST es de useGuardado). */
function Arnes({ preparar, alGuardar }: { preparar: (e: EstadoFormulario) => EstadoFormulario; alGuardar: (id: number) => void }) {
  const [estado, dispatch] = useReducer(reducir, DATOS, (d) => preparar(estadoInicial(d)))
  return <OtrasAcciones estado={estado} dispatch={dispatch} onGuardarAccion={(id) => { alGuardar(id); dispatch({ tipo: 'PEDIR_CONFIRMACION_ACCION', id }) }} />
}
function montar(preparar: (e: EstadoFormulario) => EstadoFormulario) {
  const alGuardar = vi.fn()
  renderConProviders(<Arnes preparar={preparar} alGuardar={alGuardar} />)
  return { alGuardar }
}
const conModelo = (modelo: string) => (e: EstadoFormulario) => reducir(e, { tipo: 'CAMBIAR_MODELO', modelo })
/** Modelo 13 con una acción ya guardada ("Limpieza de conector") y otra pendiente con texto. */
function conUnaGuardadaYUnaPendiente(e: EstadoFormulario): EstadoFormulario {
  let s = reducir(conModelo('13')(e), { tipo: 'ANADIR_ACCION' })
  const id = s.otros[0].id
  s = reducir(s, { tipo: 'ESCRIBIR_ACCION', id, texto: 'Limpieza de conector' })
  s = reducir(s, { tipo: 'PEDIR_CONFIRMACION_ACCION', id })
  s = reducir(s, { tipo: 'INICIO_GUARDAR_ACCION', id })
  s = reducir(s, { tipo: 'ACCION_GUARDADA', id, idRep: 'R20260916_7', fecha: '16/09 09:15' })
  s = reducir(s, { tipo: 'ANADIR_ACCION' })
  return reducir(s, { tipo: 'ESCRIBIR_ACCION', id: s.otros[1].id, texto: 'Cambio de tornillos' })
}

describe('OtrasAcciones (ficha docs/paridad/formulario.md · Otras acciones)', () => {
  it('sección oculta sin modelo o sin componente otro del modelo', () => {
    montar((e) => e)
    expect(screen.queryByTestId('otras-acciones')).not.toBeInTheDocument()
  })
  it('sección oculta con un modelo sin componente otro (13 Pro Max) y visible con el 13', () => {
    const { unmount } = renderConProviders(<Arnes preparar={conModelo('13promax')} alGuardar={() => {}} />)
    expect(screen.queryByTestId('otras-acciones')).not.toBeInTheDocument()
    unmount()
    montar(conModelo('13'))
    const seccion = screen.getByTestId('otras-acciones')
    expect(seccion).toHaveClass('bg-form-otros-bg', 'border-l-4', 'border-l-azul-medio')
    expect(within(seccion).getByText('OTRAS ACCIONES')).toBeInTheDocument()
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('0')
    expect(screen.queryByTestId('accion-1')).not.toBeInTheDocument()
  })

  it('"+ Añadir acción" añade una línea con foco y se deshabilita con una línea vacía', async () => {
    montar(conModelo('13'))
    const anadir = screen.getByRole('button', { name: '+ Añadir acción' })
    expect(anadir).toBeEnabled()
    await userEvent.click(anadir)
    const campo = within(screen.getByTestId('accion-1')).getByPlaceholderText('Describe la acción')
    expect(campo).toHaveFocus()
    expect(anadir).toBeDisabled()
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('0')
    await userEvent.type(campo, 'Limpieza de conector')
    expect(anadir).toBeEnabled()
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('1')
    await userEvent.click(anadir)
    expect(within(screen.getByTestId('accion-2')).getByPlaceholderText('Describe la acción')).toHaveFocus()
  })

  it('"✓ Guardar" deshabilitado sin texto; el primer clic pasa a "✓ Confirmar" y escribir lo devuelve a "✓ Guardar"', async () => {
    const { alGuardar } = montar(conModelo('13'))
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir acción' }))
    const linea = within(screen.getByTestId('accion-1'))
    expect(linea.getByRole('button', { name: '✓ Guardar' })).toBeDisabled()
    await userEvent.type(linea.getByPlaceholderText('Describe la acción'), 'Limpieza')
    expect(linea.getByRole('button', { name: '✓ Guardar' })).toBeEnabled()
    expect(linea.getByRole('button', { name: '✓ Guardar' })).toHaveClass('bg-azul-noche')
    await userEvent.click(linea.getByRole('button', { name: '✓ Guardar' }))
    expect(alGuardar).toHaveBeenCalledTimes(1)
    expect(linea.getByRole('button', { name: '✓ Confirmar' })).toBeInTheDocument()
    await userEvent.type(linea.getByPlaceholderText('Describe la acción'), ' de conector')
    expect(linea.getByRole('button', { name: '✓ Guardar' })).toBeInTheDocument()
    expect(linea.queryByRole('button', { name: '✓ Confirmar' })).not.toBeInTheDocument()
  })

  it('papelera quita la línea sin confirmación', async () => {
    montar(conModelo('13'))
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir acción' }))
    await userEvent.type(within(screen.getByTestId('accion-1')).getByPlaceholderText('Describe la acción'), 'Limpieza')
    await userEvent.click(within(screen.getByTestId('accion-1')).getByRole('button', { name: 'Quitar acción' }))
    expect(screen.queryByTestId('accion-1')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('0')
  })

  it('línea guardada: campo deshabilitado y "✓ Guardada dd/MM HH:mm", sin "✓ Guardar" ni papelera; el badge cuenta guardadas y con texto', () => {
    montar(conUnaGuardadaYUnaPendiente)
    const guardada = within(screen.getByTestId('accion-1'))
    expect(guardada.getByPlaceholderText('Describe la acción')).toBeDisabled()
    expect(guardada.getByPlaceholderText('Describe la acción')).toHaveValue('Limpieza de conector')
    expect(guardada.getByText('✓ Guardada 16/09 09:15')).toHaveClass('font-bold', 'text-recibido-text')
    expect(guardada.queryByRole('button')).not.toBeInTheDocument()
    const pendiente = within(screen.getByTestId('accion-2'))
    expect(pendiente.getByRole('button', { name: '✓ Guardar' })).toBeEnabled()
    expect(pendiente.getByRole('button', { name: 'Quitar acción' })).toBeInTheDocument()
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('2')
  })
})
