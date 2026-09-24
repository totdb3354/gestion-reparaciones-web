import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer } from 'react'
import { PanelRico } from './PanelRico'
import { reducir } from './estado/reductor'
import { estadoInicial, type EstadoModal } from './estado/tipos'
import { filaTabla } from './estado/fabrica'
import { filaCarga, tecnico } from '../../test/fabrica'

const IMEI = '111111111111111'
const tecnicos = [tecnico({ idTec: 3, nombre: 'Técnico A' }), tecnico({ idTec: 4, nombre: 'Técnico B', esGlass: true })]
const clientes = [{ idCli: 5, nombre: 'CLIENTE UNO', activo: true, updatedAt: '' }, { idCli: 6, nombre: 'CLIENTE VIEJO', activo: false, updatedAt: '' }]

function Harness({ inicial }: { inicial: EstadoModal }) {
  const [estado, dispatch] = useReducer(reducir, inicial)
  return <PanelRico estado={estado} dispatch={dispatch} tecnicos={tecnicos} carga={[filaCarga({ idTec: 3 })]} clientes={clientes} />
}

const escanear = async (imei = IMEI) => userEvent.type(screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...'), imei)

describe('PanelRico', () => {
  it('escanear añade a "Pendiente de asignar" y carga el detalle', async () => {
    render(<Harness inicial={estadoInicial([])} />)
    await escanear()
    expect(screen.getByText('Pendiente de asignar (1)')).toBeInTheDocument()
    expect(screen.getByTestId('imei-en-curso')).toHaveTextContent(IMEI)
    expect(screen.getByRole('button', { name: 'Asignar →' })).toBeDisabled()
  })
  it('repetido: mensaje y el IMEI se queda en el campo', async () => {
    render(<Harness inicial={estadoInicial([])} />)
    await escanear()
    await escanear()
    expect(screen.getByText('Ese IMEI ya está en la cola (Reparación).')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...')).toHaveValue(IMEI)
  })
  it('modelo + técnico habilitan Asignar; al asignar pasa a "Asignados (1) · sin guardar" con su técnico', async () => {
    render(<Harness inicial={estadoInicial([])} />)
    await escanear()
    await userEvent.type(screen.getByRole('combobox', { name: 'Modelo de iPhone' }), 'iPhone 14 Pro Max{Enter}')
    await userEvent.click(screen.getByRole('checkbox', { name: /Técnico A/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar →' }))
    expect(screen.getByText('Asignados (1) · sin guardar')).toBeInTheDocument()
    expect(screen.getAllByText('Técnico A')).toHaveLength(2)   // lista de técnicos + segunda línea de la fila verde
    expect(screen.getByTestId('imei-en-curso')).toHaveTextContent('—')
  })
  it('una verde se reabre con "Guardar cambios"', async () => {
    render(<Harness inicial={estadoInicial([])} />)
    await escanear()
    await userEvent.type(screen.getByRole('combobox', { name: 'Modelo de iPhone' }), 'iPhone 14{Enter}')
    await userEvent.click(screen.getByRole('checkbox', { name: /Técnico A/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar →' }))
    await userEvent.click(screen.getByText(IMEI))
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })
  it('bloqueo del duplicado al seleccionar y "ya tiene glass"', async () => {
    const tabla = [filaTabla({ idRep: 'A1', imei: IMEI, idTec: 3 }), filaTabla({ idRep: 'AG1', imei: IMEI, idTec: 4, nombreTecnico: 'Técnico B' })]
    render(<Harness inicial={estadoInicial(tabla)} />)
    await escanear()
    expect(screen.getByRole('checkbox', { name: /Técnico A/ })).toBeDisabled()
    expect(screen.getByText('1 asignado')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Lleva glass' })).toBeDisabled()
    expect(screen.getByText('ya tiene glass: Técnico B')).toBeInTheDocument()
  })
  it('el cliente inactivo que ya tiene el IMEI se muestra; el buscador no lo ofrece a otros', async () => {
    const IMEI2 = '444444444444444'
    let s = reducir(reducir(estadoInicial([]), { tipo: 'ESCANEAR', imei: IMEI }), { tipo: 'LOOKUP_RESUELTO', seq: 1, modelo: '14', idCliBd: 6 })
    // una segunda entrada, sin esa decisión: queda como "actual" tras escanearla
    s = reducir(s, { tipo: 'ESCANEAR', imei: IMEI2 })
    render(<Harness inicial={s} />)
    // a la entrada actual (IMEI2) no se le ofrece el inactivo de la otra
    await userEvent.type(screen.getByRole('combobox', { name: 'Cliente' }), 'CLIENTE')
    expect(screen.queryByText('CLIENTE VIEJO')).toBeNull()
    expect(screen.getByText('CLIENTE UNO')).toBeInTheDocument()
    // se recarga la primera entrada (IMEI): a ESA sí se le muestra su inactivo
    await userEvent.click(screen.getByText(IMEI))
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue('CLIENTE VIEJO')
  })
  it('en la cola Glass no hay chasis ni "Lleva glass"', async () => {
    render(<Harness inicial={{ ...estadoInicial([]), pestana: 'GLASS' }} />)
    await escanear()
    expect(screen.queryByRole('checkbox', { name: 'Reparación de chasis' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Lleva glass' })).toBeNull()
  })
  it('pegado: añade en rojo sin cargar el detalle', async () => {
    render(<Harness inicial={estadoInicial([])} />)
    await userEvent.click(screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...'))
    await userEvent.paste(`${IMEI}222222222222222`)
    expect(screen.getByText('Pendiente de asignar (2)')).toBeInTheDocument()
    expect(screen.getByText('2 IMEIs añadidos.')).toBeInTheDocument()
    expect(screen.getByTestId('imei-en-curso')).toHaveTextContent('—')
  })
})
