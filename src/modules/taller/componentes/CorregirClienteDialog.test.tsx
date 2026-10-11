import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { resumen } from '../test/fabrica'
import { CorregirClienteDialog } from './CorregirClienteDialog'

const IMEI = '355400000000111'
const cerrados = [
  { idRep: 'R20261002_1', fechaFin: '2026-10-02T09:30:00', descripcion: 'lcdi16', idCli: 19, cliente: 'AMAZON' },
  { idRep: 'R20261002_2', fechaFin: '2026-10-02T09:30:00', descripcion: 'bati16', idCli: 19, cliente: 'AMAZON' },
  { idRep: 'A20261001_7', fechaFin: '2026-10-02T09:30:01', descripcion: 'Asignación', idCli: 19, cliente: 'AMAZON' },
  { idRep: 'R20260714_5', fechaFin: '2026-07-14T10:00:00', descripcion: 'chai16negro', idCli: 19, cliente: 'AMAZON' },
  { idRep: 'R20260601_1', fechaFin: '2026-06-01T10:00:00', descripcion: 'otroi16', idCli: null, cliente: null },
]
const activos = [{ idCli: 19, nombre: 'AMAZON', activo: true, updatedAt: null }, { idCli: 2, nombre: 'WEB', activo: true, updatedAt: null }]
const rep = resumen({ idRep: 'R20261002_1', imei: IMEI, cliente: 'AMAZON', fechaFin: '2026-10-02T09:30:00' })

beforeEach(() => {
  server.use(
    http.get(`*/api/reparaciones/imei/${IMEI}/cerrados`, () => HttpResponse.json(cerrados)),
    http.get('*/api/clientes/activos', () => HttpResponse.json(activos)),
  )
})

async function abrir() {
  const onCerrar = vi.fn()
  renderConProviders(<CorregirClienteDialog rep={rep} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  const dlg = await screen.findByRole('dialog', { name: 'Corregir cliente' })
  await within(dlg).findByText('R20261002_1')
  await within(dlg).findByRole('option', { name: 'WEB' })
  return { dlg, onCerrar }
}

describe('CorregirClienteDialog', () => {
  it('lista solo los cerrados con el mismo cliente guardado y marca el elegido y los del mismo día', async () => {
    const { dlg } = await abrir()
    expect(within(dlg).getAllByRole('checkbox')).toHaveLength(4)
    expect(within(dlg).queryByText('R20260601_1')).not.toBeInTheDocument()
    expect(within(dlg).getByRole('checkbox', { name: /R20261002_1/ })).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: /R20261002_2/ })).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: /A20261001_7/ })).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: /R20260714_5/ })).not.toBeChecked()
  })
  it('"Corregir 3" está deshabilitado sin cliente y con el mismo guardado; con WEB se habilita', async () => {
    const { dlg } = await abrir()
    const boton = within(dlg).getByRole('button', { name: 'Corregir 3' })
    expect(boton).toBeDisabled()
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), 'AMAZON')
    expect(boton).toBeDisabled()
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), 'WEB')
    expect(boton).toBeEnabled()
  })
  it('desmarcar todos deshabilita el botón', async () => {
    const { dlg } = await abrir()
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), 'WEB')
    for (const c of within(dlg).getAllByRole('checkbox')) if ((c as HTMLInputElement).checked) await userEvent.click(c)
    expect(within(dlg).getByRole('button', { name: 'Corregir 0' })).toBeDisabled()
  })
  it('envía los marcados en el orden de la lista y cierra', async () => {
    let cuerpo: unknown
    server.use(http.patch('*/api/reparaciones/cliente', async ({ request }) => { cuerpo = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    const { dlg, onCerrar } = await abrir()
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), 'WEB')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Corregir 3' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(cuerpo).toEqual({ imei: IMEI, idReps: ['R20261002_1', 'R20261002_2', 'A20261001_7'], idCli: 2 })
  })
  it('"— Sin cliente —" envía idCli null', async () => {
    let cuerpo: unknown
    server.use(http.patch('*/api/reparaciones/cliente', async ({ request }) => { cuerpo = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    const { dlg, onCerrar } = await abrir()
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), '— Sin cliente —')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Corregir 3' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(cuerpo).toMatchObject({ idCli: null })
  })
  it('si el servidor responde 409 muestra el mensaje y el modal sigue abierto', async () => {
    server.use(http.patch('*/api/reparaciones/cliente', () => HttpResponse.json({ message: 'Algún trabajo ya no está cerrado o no es de este teléfono' }, { status: 409 })))
    const { dlg, onCerrar } = await abrir()
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), 'WEB')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Corregir 3' }))
    expect(await screen.findByText(/No se pudo corregir: Algún trabajo ya no está cerrado/)).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })
  it('mientras carga la cabecera dice "cargando…" y no hay lista', async () => {
    server.use(http.get(`*/api/reparaciones/imei/${IMEI}/cerrados`, () => new Promise(() => {})))
    renderConProviders(<CorregirClienteDialog rep={rep} onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Corregir cliente' })
    expect(within(dlg).getByText(/guardado ahora: cargando…/)).toBeInTheDocument()
    expect(within(dlg).queryByText(/Trabajos cerrados de este IMEI/)).not.toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Corregir 0' })).toBeDisabled()
  })
  it('si el trabajo elegido no está en la lista avisa en vez de mostrar la lista', async () => {
    server.use(http.get(`*/api/reparaciones/imei/${IMEI}/cerrados`, () => HttpResponse.json(cerrados.slice(1))))
    renderConProviders(<CorregirClienteDialog rep={rep} onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Corregir cliente' })
    expect(await within(dlg).findByText('Este trabajo ya no está cerrado o no es de este teléfono.')).toBeInTheDocument()
    expect(within(dlg).getByText(/guardado ahora: —$/)).toBeInTheDocument()
    expect(within(dlg).queryByText(/Trabajos cerrados de este IMEI/)).not.toBeInTheDocument()
    expect(within(dlg).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(dlg).getByRole('button', { name: 'Corregir 0' })).toBeDisabled()
  })
  it('con el cliente guardado null el rótulo dice "sin cliente" y la cabecera "— Sin cliente —"', async () => {
    const sinCliente = [{ idRep: 'R20261002_1', fechaFin: '2026-10-02T09:30:00', descripcion: 'lcdi16', idCli: null, cliente: null }]
    server.use(http.get(`*/api/reparaciones/imei/${IMEI}/cerrados`, () => HttpResponse.json(sinCliente)))
    const { dlg } = await abrir()
    expect(within(dlg).getByText('Trabajos cerrados de este IMEI sin cliente:')).toBeInTheDocument()
    expect(within(dlg).getByText(/guardado ahora: — Sin cliente —/)).toBeInTheDocument()
  })
  it('con cliente guardado el rótulo dice "con AMAZON"', async () => {
    const { dlg } = await abrir()
    expect(within(dlg).getByText('Trabajos cerrados de este IMEI con AMAZON:')).toBeInTheDocument()
  })
  it('tras corregir con éxito la lista de cerrados se vuelve a pedir', async () => {
    let gets = 0
    server.use(
      http.get(`*/api/reparaciones/imei/${IMEI}/cerrados`, () => { gets++; return HttpResponse.json(cerrados) }),
      http.patch('*/api/reparaciones/cliente', () => new HttpResponse(null, { status: 204 })),
    )
    const { dlg, onCerrar } = await abrir()
    expect(gets).toBe(1)
    await userEvent.selectOptions(within(dlg).getByLabelText('Cliente correcto'), 'WEB')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Corregir 3' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    await waitFor(() => expect(gets).toBe(2))
  })
})
