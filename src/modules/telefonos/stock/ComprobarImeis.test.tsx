import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { movilComprobado, noEncontrado } from '../test/fabrica'
import { ComprobarImeis } from './ComprobarImeis'

const abrirDialogo = (textoInicial = '', onAbrirImei = vi.fn()) =>
  renderConProviders(<ComprobarImeis abierto textoInicial={textoInicial} onCerrar={() => {}} onAbrirImei={onAbrirImei} />, { sesion: SESION_SUPER })
const dialogo = () => screen.findByRole('dialog', { name: 'Comprobar una lista de IMEIs' })
const responder = () => server.use(http.post('*/api/stock-telefonos/comprobar', async ({ request }) => {
  const { imeis } = (await request.json()) as { imeis: string[] }
  return HttpResponse.json(imeis.map((i) => (i === '350000000000099' ? noEncontrado(i) : movilComprobado({ imei: i }))))
}))

describe('Comprobar una lista de IMEIs (spec 0.9.18 §4.9)', () => {
  it('con lo pegado comprueba al abrirse, marca cada línea y resume', async () => {
    responder()
    abrirDialogo('350000000000001\n350000000000099\npendiente\n350000000000001')
    const tabla = await within(await dialogo()).findByRole('table', { name: 'Resultado' })
    const estados = within(tabla).getAllByRole('row').slice(1).map((f) => within(f).getAllByRole('cell').at(-1)?.textContent)
    expect(estados).toEqual(['Libre', 'No está en NSYS', 'No es un IMEI', 'Repetido (línea 1)'])
    const d = await dialogo()
    expect(within(d).getByText('4 líneas')).toBeInTheDocument()
    for (const cifra of ['1 en stock', '1 no está en NSYS', '1 repetido', '1 no es un IMEI']) expect(within(d).getByText(cifra)).toBeInTheDocument()
  })

  it('con una sola línea, «1 línea» en singular', async () => {
    responder()
    abrirDialogo('350000000000001')
    const d = await dialogo()
    await within(d).findByRole('table', { name: 'Resultado' })
    expect(within(d).getByText('1 línea')).toBeInTheDocument()
  })

  it('sin nada pegado espera a «Comprobar»; con más de 500 avisa y no pregunta', async () => {
    let pedidas = 0
    server.use(http.post('*/api/stock-telefonos/comprobar', () => {
      pedidas++
      return HttpResponse.json([])
    }))
    const user = userEvent.setup()
    abrirDialogo()
    const d = await dialogo()
    expect(within(d).queryByRole('table', { name: 'Resultado' })).not.toBeInTheDocument()
    await user.click(within(d).getByRole('textbox', { name: 'IMEIs' }))
    await user.paste(Array.from({ length: 501 }, (_, i) => String(350000000000000 + i)).join('\n'))
    await user.click(within(d).getByRole('button', { name: 'Comprobar' }))
    expect(within(d).getByText('Como mucho 500 IMEIs por vez: hay 501.')).toBeInTheDocument()
    expect(pedidas).toBe(0)
  })

  it('copia el resultado para Excel y un IMEI encontrado abre su página', async () => {
    responder()
    const user = userEvent.setup()
    const onAbrirImei = vi.fn()
    abrirDialogo('350000000000001', onAbrirImei)
    const d = await dialogo()
    await within(d).findByRole('table', { name: 'Resultado' })
    await user.click(within(d).getByRole('button', { name: 'Copiar el resultado (para Excel)' }))
    await waitFor(async () => expect(await navigator.clipboard.readText()).toMatch(/^#\tIMEI\tModelo/))
    await user.click(within(d).getByRole('button', { name: 'Abrir 350000000000001' }))
    expect(onAbrirImei).toHaveBeenCalledWith('350000000000001')
  })

  it('si la comprobación falla lo dice, y «Comprobar» vuelve a preguntar', async () => {
    let pedidas = 0
    server.use(http.post('*/api/stock-telefonos/comprobar', () => {
      pedidas++
      return pedidas === 1 ? HttpResponse.json({ message: 'Fallo de prueba' }, { status: 400 }) : HttpResponse.json([movilComprobado({ imei: '350000000000001' })])
    }))
    const user = userEvent.setup()
    abrirDialogo('350000000000001')
    await user.click(within(await screen.findByRole('dialog', { name: 'Error' })).getByRole('button', { name: 'Aceptar' }))
    const d = await dialogo()
    expect(await within(d).findByText('No se pudo comprobar la lista. Pulsa «Comprobar» para intentarlo otra vez.')).toBeInTheDocument()
    await user.click(within(d).getByRole('button', { name: 'Comprobar' }))
    expect(await within(d).findByRole('table', { name: 'Resultado' })).toBeInTheDocument()
    expect(pedidas).toBe(2)
    expect(within(d).queryByText(/No se pudo comprobar/)).not.toBeInTheDocument()
  })
})
