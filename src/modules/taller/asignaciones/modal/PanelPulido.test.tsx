import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer } from 'react'
import { PanelPulido } from './PanelPulido'
import { reducir } from './estado/reductor'
import { estadoInicial } from './estado/tipos'
import { filaCarga, tecnico } from '../../test/fabrica'

const IMEI = '111111111111111'
const tecnicos = [tecnico({ idTec: 3, nombre: 'Técnico A' }), tecnico({ idTec: 4, nombre: 'Técnico B' })]
const clientes = [{ idCli: 5, nombre: 'CLIENTE UNO', activo: true, updatedAt: '' }]

function Harness() {
  const [estado, dispatch] = useReducer(reducir, { ...estadoInicial([]), pestana: 'PULIDO' as const })
  return <PanelPulido estado={estado} dispatch={dispatch} tecnicos={tecnicos} carga={[filaCarga({ idTec: 3, pctPendiente: 62, pctHecho: 0 })]} clientes={clientes} />
}
const campo = () => screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...')

describe('PanelPulido', () => {
  it('sin nada: "Nada añadido aún" y detalle deshabilitado', () => {
    render(<Harness />)
    expect(screen.getByText('Nada añadido aún')).toBeInTheDocument()
    expect(screen.getByTestId('imei-pulido')).toHaveTextContent('—')
  })
  it('sin técnico arriba la fila sale en rojo "(sin técnico) · —"', async () => {
    render(<Harness />)
    await userEvent.type(campo(), IMEI)
    expect(screen.getByText('1 en pulido')).toBeInTheDocument()
    expect(screen.getByText('(sin técnico) · —')).toBeInTheDocument()
  })
  it('el técnico de arriba se aplica a lo que se escanea y se ve con su carga', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Técnico para los IMEIs que escanees' }))
    await userEvent.click(screen.getByRole('button', { name: 'Técnico A (P62%)' }))
    await userEvent.type(campo(), IMEI)
    expect(screen.getByText('Técnico A · —')).toBeInTheDocument()
  })
  it('detalle: "— Sin cliente —" se resume como "sin cliente"', async () => {
    render(<Harness />)
    await userEvent.type(campo(), IMEI)
    await userEvent.type(screen.getByRole('combobox', { name: 'Cliente' }), '— Sin cliente —{Enter}')
    expect(screen.getByText('(sin técnico) · sin cliente')).toBeInTheDocument()
  })
  it('repetido: mensaje', async () => {
    render(<Harness />)
    await userEvent.type(campo(), IMEI)
    await userEvent.type(campo(), IMEI)
    expect(screen.getByText('Ese IMEI ya está en la lista de pulido.')).toBeInTheDocument()
  })
})
