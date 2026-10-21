import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { fichaMovil, opcionesTaller } from '../test/fabrica'
import { CorregirTallerDialog } from './CorregirTallerDialog'

const A = '351900000000041'
const abrirDialogo = (p: Parameters<typeof fichaMovil>[0] = {}, onCerrar = vi.fn()) =>
  renderConProviders(<CorregirTallerDialog ficha={fichaMovil(p)} abierto onCerrar={onCerrar} />, { sesion: SESION_SUPER })
const dialogo = () => screen.findByRole('dialog', { name: `Corregir ${A}` })
const opcionesDe = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent)

beforeEach(() => {
  server.use(http.get('*/api/stock-telefonos/:imeiSn/colores', () => HttpResponse.json(opcionesTaller())))
})

describe('Corregir color, grado o batería (spec 0.9.21 §2.3)', () => {
  it('empieza con lo que vale: el color primero, el grado y sus casillas', async () => {
    abrirDialogo({ color: 'Rosa', colorNsys: 'Negro', grado: 'MsA-', bateriaNueva: true, gradoNsys: 'B', porPasar: true })
    const d = await dialogo()
    const color = within(d).getByRole('combobox', { name: 'Color' })
    await waitFor(() => expect(color).toBeEnabled())
    expect(opcionesDe(color)).toEqual(['Rosa', 'Negro'])
    expect(color).toHaveValue('Rosa')
    expect(within(d).getByRole('combobox', { name: 'Grado' })).toHaveValue('A-')
    expect(within(d).getByRole('checkbox', { name: 'Batería nueva (100)' })).toBeChecked()
    expect(within(d).getByRole('checkbox', { name: 'Mensaje de pieza (Ms)' })).toBeChecked()
    expect(within(d).getByRole('textbox', { name: 'Motivo' })).toHaveAttribute('placeholder', 'Obligatorio: por qué se corrige')
    expect(within(d).getByRole('region', { name: 'Vista previa' })).toHaveTextContent('Sin cambios todavía.')
    expect(within(d).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('un grado que no es de NSYS empieza vacío y solo cambia si se elige', async () => {
    const user = userEvent.setup()
    abrirDialogo({ grado: 'ID', bateriaNueva: false })
    const d = await dialogo()
    const grado = within(d).getByRole('combobox', { name: 'Grado' })
    expect(grado).toHaveValue('')
    expect(opcionesDe(grado)).toEqual(['—', 'A', 'A-', 'B', 'C'])
    await user.click(within(d).getByRole('checkbox', { name: 'Batería nueva (100)' }))
    expect(within(d).getByRole('region', { name: 'Vista previa' })).toHaveTextContent('Sin cambios todavía.')
  })

  it('cambiar el grado: vista previa con el SKU nuevo y lo que hay que poner en NSYS, y guarda con el motivo', async () => {
    const cuerpos: unknown[] = []
    server.use(http.put('*/api/stock-telefonos/:imeiSn/taller', async ({ request }) => {
      cuerpos.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }))
    const user = userEvent.setup()
    const onCerrar = vi.fn()
    abrirDialogo({ grado: 'B', bateriaNueva: false, sku: 'i16128NegroB' }, onCerrar)
    const d = await dialogo()
    await user.selectOptions(within(d).getByRole('combobox', { name: 'Grado' }), 'A')
    await user.click(within(d).getByRole('checkbox', { name: 'Batería nueva (100)' }))
    const vista = within(d).getByRole('region', { name: 'Vista previa' })
    expect(vista).toHaveTextContent('Grado: B → A100')
    await waitFor(() => expect(vista).toHaveTextContent('SKU: i16128NegroA100'))
    expect(vista).toHaveTextContent('En NSYS habrá que poner: Apple iPhone 16 128GB Black · grado A100')
    expect(within(d).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await user.type(within(d).getByRole('textbox', { name: 'Motivo' }), 'batería nueva')
    await user.click(within(d).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(cuerpos).toEqual([{ color: null, grado: 'A100', motivo: 'batería nueva' }])
  })

  it('un color sin SKU ni móviles en NSYS se guarda igual y lo avisa', async () => {
    server.use(http.get('*/api/stock-telefonos/:imeiSn/colores', () => HttpResponse.json(opcionesTaller({
      colores: [{ color: 'Negro', producto: 'Apple iPhone 16 128GB Black' }, { color: 'Verde', producto: null }],
    }))))
    const user = userEvent.setup()
    abrirDialogo()
    const d = await dialogo()
    const color = within(d).getByRole('combobox', { name: 'Color' })
    await waitFor(() => expect(color).toBeEnabled())
    await user.selectOptions(color, 'Verde')
    const vista = within(d).getByRole('region', { name: 'Vista previa' })
    expect(vista).toHaveTextContent('Color: Negro → Verde')
    expect(vista).toHaveTextContent('SKU: sin SKU en el maestro: se guarda igual')
    expect(vista).toHaveTextContent('En NSYS habrá que poner: (ningún móvil de ese color en NSYS: búscalo a mano) · grado A100')
  })

  it('sin colores en el maestro el color no se puede cambiar, el grado sí', async () => {
    server.use(http.get('*/api/stock-telefonos/:imeiSn/colores', () => HttpResponse.json(opcionesTaller({ colores: [], skus: [] }))))
    abrirDialogo()
    const d = await dialogo()
    const color = within(d).getByRole('combobox', { name: 'Color' })
    await waitFor(() => expect(color).toHaveTextContent('Sin colores en el maestro'))
    expect(color).toBeDisabled()
    expect(within(d).getByRole('combobox', { name: 'Grado' })).toBeEnabled()
  })

  it('elegir lo que dice NSYS avisa de que se quita lo del taller', async () => {
    const user = userEvent.setup()
    abrirDialogo({ color: 'Rosa', colorNsys: 'Negro', porPasar: true })
    const d = await dialogo()
    const color = within(d).getByRole('combobox', { name: 'Color' })
    await waitFor(() => expect(color).toBeEnabled())
    await user.selectOptions(color, 'Negro')
    const vista = within(d).getByRole('region', { name: 'Vista previa' })
    expect(vista).toHaveTextContent('Color: Rosa → Negro')
    expect(vista).toHaveTextContent('Coincide con NSYS: se quita lo del taller.')
  })

  it('«Volver a lo de NSYS» solo con algo del taller, y sin motivo escrito va sin motivo', async () => {
    const cuerpos: unknown[] = []
    server.use(http.delete('*/api/stock-telefonos/:imeiSn/taller', async ({ request }) => {
      cuerpos.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }))
    const user = userEvent.setup()
    const { unmount } = abrirDialogo()
    expect(within(await dialogo()).queryByRole('button', { name: 'Volver a lo de NSYS' })).not.toBeInTheDocument()
    unmount()
    const onCerrar = vi.fn()
    abrirDialogo({ color: 'Rosa', colorNsys: 'Negro', porPasar: true }, onCerrar)
    const volver = within(await dialogo()).getByRole('button', { name: 'Volver a lo de NSYS' })
    expect(volver).toHaveAttribute('title', 'Quita lo del taller y vuelve a lo que dice NSYS')
    await user.click(volver)
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(cuerpos).toEqual([{ motivo: null }])
  })
})

describe('Errores del servidor al guardar o volver (revisión de la Task 7)', () => {
  it('un 400 al guardar enseña el error y el diálogo sigue abierto', async () => {
    server.use(http.put('*/api/stock-telefonos/:imeiSn/taller', () => HttpResponse.json({ message: 'Grado no válido' }, { status: 400 })))
    const user = userEvent.setup()
    const onCerrar = vi.fn()
    abrirDialogo({ grado: 'B', bateriaNueva: false }, onCerrar)
    const d = await dialogo()
    await user.selectOptions(within(d).getByRole('combobox', { name: 'Grado' }), 'A')
    await user.type(within(d).getByRole('textbox', { name: 'Motivo' }), 'x')
    await user.click(within(d).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByText(`Corregir ${A}`)).toBeInTheDocument()
  })

  it('un 404 al volver a lo de NSYS enseña el error y el diálogo sigue abierto', async () => {
    server.use(http.delete('*/api/stock-telefonos/:imeiSn/taller', () => HttpResponse.json({ message: 'No hay nada del taller' }, { status: 404 })))
    const user = userEvent.setup()
    const onCerrar = vi.fn()
    abrirDialogo({ color: 'Rosa', colorNsys: 'Negro', porPasar: true }, onCerrar)
    await user.click(within(await dialogo()).getByRole('button', { name: 'Volver a lo de NSYS' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByText(`Corregir ${A}`)).toBeInTheDocument()
  })
})
