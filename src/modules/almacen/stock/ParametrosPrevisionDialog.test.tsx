import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_ADMIN } from '@/test/render'
import { server } from '@/test/server'
import { ParametrosPrevisionDialog } from './ParametrosPrevisionDialog'

function abrir(onCerrar = vi.fn()) {
  server.use(http.get('*/api/parametros/prevision', () => HttpResponse.json({ peso1: 50, peso2: 30, peso3: 20 })))
  renderConProviders(<ParametrosPrevisionDialog abierto onCerrar={onCerrar} />, { sesion: SESION_ADMIN })
  return onCerrar
}
const dlg = () => within(screen.getByRole('dialog', { name: 'Parámetros de previsión' }))

describe('ParametrosPrevisionDialog', () => {
  it('carga los pesos guardados, enseña la ayuda y la suma', async () => {
    abrir()
    await waitFor(() => expect(dlg().getByLabelText('Días 1-30 (%)')).toHaveValue('50'))
    expect(dlg().getByLabelText('Días 31-60 (%)')).toHaveValue('30')
    expect(dlg().getByLabelText('Días 61-90 (%)')).toHaveValue('20')
    expect(dlg().getByText('Lo reciente pesa más. Los tres tienen que sumar 100.')).toBeInTheDocument()
    expect(dlg().getByText('Suma: 100 %')).not.toHaveClass('text-texto-error')
  })
  it('si no suman 100, la suma en rojo y "Guardar" desactivado', async () => {
    abrir()
    const campo = await dlg().findByDisplayValue('20')
    await userEvent.clear(campo)
    await userEvent.type(campo, '30')
    expect(dlg().getByText('Suma: 110 %')).toHaveClass('text-texto-error')
    expect(dlg().getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
  it('guarda con PUT y cierra', async () => {
    const cuerpos: unknown[] = []
    server.use(http.put('*/api/parametros/prevision', async ({ request }) => { cuerpos.push(await request.json()); return new HttpResponse(null, { status: 200 }) }))
    const onCerrar = abrir()
    const p1 = await dlg().findByDisplayValue('50')
    await userEvent.clear(p1)
    await userEvent.type(p1, '40')
    const p2 = dlg().getByLabelText('Días 31-60 (%)')
    await userEvent.clear(p2)
    await userEvent.type(p2, '35')
    const p3 = dlg().getByLabelText('Días 61-90 (%)')
    await userEvent.clear(p3)
    await userEvent.type(p3, '25')
    await userEvent.click(dlg().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(cuerpos).toEqual([{ peso1: 40, peso2: 35, peso3: 25 }]))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
  })
  it('un 422 del servidor se pinta dentro y el diálogo sigue abierto', async () => {
    server.use(http.put('*/api/parametros/prevision', () =>
      HttpResponse.json({ message: 'Los tres pesos tienen que ser enteros entre 0 y 100 y sumar 100.' }, { status: 422 })))
    const onCerrar = abrir()
    await dlg().findByDisplayValue('50')
    await userEvent.click(dlg().getByRole('button', { name: 'Guardar' }))
    expect(await dlg().findByRole('alert')).toHaveTextContent('Los tres pesos tienen que ser enteros entre 0 y 100 y sumar 100.')
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
