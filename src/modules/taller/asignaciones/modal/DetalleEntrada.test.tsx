import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetalleEntrada } from './DetalleEntrada'
import { entrada, estado } from './estado/fabrica'
import { filaCarga, tecnico } from '../../test/fabrica'

const IMEI = '111111111111111'

describe('DetalleEntrada', () => {
  it('marcar un técnico despacha MARCAR_TECNICO con el orden de la lista mostrada', async () => {
    const dispatch = vi.fn()
    const tecnicos = [tecnico({ idTec: 3, nombre: 'Técnico A' }), tecnico({ idTec: 4, nombre: 'Técnico B' })]
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI, modelo: '14' })], actual: 1 })
    render(<DetalleEntrada estado={s} dispatch={dispatch} tecnicos={tecnicos} carga={[filaCarga({ idTec: 3 })]} clientes={[]} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /Técnico A/ }))
    expect(dispatch).toHaveBeenCalledWith({ tipo: 'MARCAR_TECNICO', idTec: 3, marcado: true, orden: [3, 4] })
  })

  it('sin entrada cargada el fieldset está deshabilitado', () => {
    const dispatch = vi.fn()
    render(<DetalleEntrada estado={estado()} dispatch={dispatch} tecnicos={[]} carga={[]} clientes={[]} />)
    expect(screen.getByTestId('imei-en-curso')).toHaveTextContent('—')
  })

  it('0.9.23: «No está en NSYS» con la hora del último Items bajo el IMEI; sin respuesta o si NSYS lo tiene, nada', () => {
    const con = (enNsys: boolean | null) => estado({ rep: [entrada({ seq: 1, imei: IMEI, modelo: '14' })], actual: 1, enNsys: { [IMEI]: enNsys } })
    const { rerender } = render(<DetalleEntrada estado={con(false)} dispatch={vi.fn()} tecnicos={[]} carga={[]} clientes={[]} ultimoItems="2026-10-16T13:31:00" />)
    expect(screen.getByText(/^No está en NSYS · último Items: .*13:31$/)).toHaveClass('text-texto-error')
    rerender(<DetalleEntrada estado={con(false)} dispatch={vi.fn()} tecnicos={[]} carga={[]} clientes={[]} />)
    expect(screen.getByText('No está en NSYS')).toBeInTheDocument()
    rerender(<DetalleEntrada estado={con(true)} dispatch={vi.fn()} tecnicos={[]} carga={[]} clientes={[]} />)
    expect(screen.queryByText(/No está en NSYS/)).not.toBeInTheDocument()
    rerender(<DetalleEntrada estado={con(null)} dispatch={vi.fn()} tecnicos={[]} carga={[]} clientes={[]} />)
    expect(screen.queryByText(/No está en NSYS/)).not.toBeInTheDocument()
  })
})
