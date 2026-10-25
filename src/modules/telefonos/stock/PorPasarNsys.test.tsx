import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TarjetasPorPasar } from '@/shared/api/client'
import { AvisoBreveHost } from '@/shared/ui/AvisoBreve'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { filaAlta, filaColor, filaGrado, filaRevisar, tarjetas } from '../test/fabrica'
import { PorPasarNsys } from './PorPasarNsys'

const HECHO = { hechoPor: 'Supertécnico 1', hechoEn: '2026-10-25T12:31:00', hechoVolvio: null }

function pintar(t: TarjetasPorPasar = tarjetas(), onAbrirImei = vi.fn()) {
  renderConProviders(<><PorPasarNsys tarjetas={t} cargando={false} error={false} onAbrirImei={onAbrirImei} /><AvisoBreveHost /></>,
    { sesion: SESION_SUPER })
  return onAbrirImei
}
const cabeceras = (tabla: HTMLElement) => within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
const filas = (tabla: HTMLElement) => within(tabla).getAllByRole('row').slice(1)

describe('«Por pasar a NSYS» con cuatro tarjetas (spec 0.9.22 §3)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('cada tarjeta dice cuántos hay y cuántos hechos; sin pendientes, su botón no se puede pulsar', () => {
    pintar(tarjetas({ color: [filaColor(), filaColor({ imeiSn: '350000000000012', ...HECHO })], revisar: [filaRevisar()] }))
    const color = screen.getByRole('article', { name: 'Cambio de color' })
    expect(color).toHaveTextContent('2 móviles · 1 hecho')
    expect(color).toHaveTextContent('Cambia el producto: en NSYS, bórralo y súbelo otra vez con la plantilla')
    expect(within(color).getByRole('button', { name: '⬇ Descargar plantilla (1)' })).toBeEnabled()
    const grado = screen.getByRole('article', { name: 'Cambio de grado' })
    expect(grado).toHaveTextContent('0 móviles')
    const copiar = within(grado).getByRole('button', { name: 'Copiar lista' })
    expect(copiar).toBeDisabled()
    expect(copiar).toHaveAttribute('title', 'No hay móviles que corregir')
    expect(within(screen.getByRole('article', { name: 'No está en NSYS' })).getByRole('button', { name: '⬇ Descargar plantilla' })).toBeDisabled()
    expect(screen.getByRole('article', { name: 'Revisar a mano' })).toHaveTextContent('1 móvil')
    expect(screen.getByRole('button', { name: 'Cambio de color' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Color destaca lo que cambia, dice si también está en Grado y lo que no va en la plantilla', () => {
    pintar(tarjetas({ color: [
      filaColor({ tambienGrado: true }),
      filaColor({ imeiSn: '350000000000012', ponerProducto: null, colorA: 'Verde' }),
      filaColor({ imeiSn: '350000000000013', ponerProducto: 'Apple iPhone 13 128GB Pink', colorA: 'Pink', compruebalo: true }),
    ] }))
    const tabla = screen.getByRole('table', { name: 'Cambio de color' })
    expect(cabeceras(tabla)).toEqual(['IMEI', 'Modelo', 'Color', 'En NSYS hoy', 'Poner en NSYS', 'Por qué', 'Desde', '✓ Marcar todo (3)'])
    const [uno, dos, tres] = filas(tabla)
    expect(uno).toHaveTextContent('iPhone 13 128GB')
    expect(uno).toHaveTextContent('Blue → (PRODUCT)RED')
    expect(uno).toHaveTextContent('también en «Cambio de grado» (después)')
    expect(uno).toHaveTextContent('Apple iPhone 13 128GB (PRODUCT)RED')
    expect(uno).toHaveTextContent('grado B (el de NSYS hoy)')
    expect(uno).toHaveTextContent('Color: reparación R20261024_12 · Técnico 2 · chasis chai13red nuevo')
    expect(uno).toHaveTextContent('24/10/2026 10:12')
    expect(dos).toHaveTextContent('(ningún móvil de ese color en NSYS: búscalo a mano)')
    expect(dos).toHaveTextContent('no va en la plantilla')
    expect(tres).toHaveTextContent('compruébalo: NSYS nunca ha escrito ese color')
    expect(screen.getByText('1 sin producto en NSYS: no van en la plantilla')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Cambio de color' })).getByRole('button', { name: '⬇ Descargar plantilla (2)' }))
      .toBeInTheDocument()
  })

  it('«Hecho» marca, la marcada sale con la hora y «deshacer», y «Marcar todo» lleva lo pendiente', async () => {
    const user = userEvent.setup()
    const pedidos: unknown[] = []
    server.use(
      http.put('*/api/stock-telefonos/por-pasar/hecho', async ({ request }) => {
        pedidos.push(['PUT', await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('*/api/stock-telefonos/por-pasar/hecho', async ({ request }) => {
        pedidos.push(['DELETE', await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
    )
    pintar(tarjetas({ color: [filaColor(), filaColor({ imeiSn: '350000000000012', ...HECHO }), filaColor({ imeiSn: '350000000000013' })] }))
    expect(screen.getByText('✓ Hecho 12:31')).toHaveAttribute('title', 'Marcado por Supertécnico 1 a las 12:31')
    await user.click(screen.getByRole('button', { name: 'Hecho 350000000000011' }))
    await waitFor(() => expect(pedidos).toHaveLength(1))
    const deshacer = screen.getByRole('button', { name: 'Deshacer Hecho de 350000000000012' })
    await waitFor(() => expect(deshacer).toBeEnabled())
    await user.click(deshacer)
    await waitFor(() => expect(pedidos).toHaveLength(2))
    const todo = screen.getByRole('button', { name: '✓ Marcar todo (2)' })
    await waitFor(() => expect(todo).toBeEnabled())
    await user.click(todo)
    await waitFor(() => expect(pedidos).toEqual([
      ['PUT', { tarjeta: 'COLOR', imeis: ['350000000000011'] }],
      ['DELETE', { tarjeta: 'COLOR', imeiSn: '350000000000012' }],
      ['PUT', { tarjeta: 'COLOR', imeis: ['350000000000011', '350000000000013'] }],
    ]))
  })

  it('una marca que volvió deja la fila pendiente con el aviso', async () => {
    const user = userEvent.setup()
    pintar(tarjetas({ grado: [filaGrado({ ...HECHO, hechoVolvio: '2026-10-25T13:01:00' })] }))
    await user.click(screen.getByRole('button', { name: 'Cambio de grado' }))
    expect(screen.getByText('Marcado «Hecho» a las 12:31, pero NSYS sigue igual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hecho 350000000000022' })).toBeEnabled()
    expect(screen.getByRole('article', { name: 'Cambio de grado' })).toHaveTextContent('1 móvil')
    expect(screen.getByRole('article', { name: 'Cambio de grado' })).not.toHaveTextContent('hecho')
  })

  it('Grado: lo destacado, «primero su cambio de color» y «Copiar lista» con lo pendiente', async () => {
    const user = userEvent.setup()
    pintar(tarjetas({ grado: [filaGrado({ conColor: true }), filaGrado({ imeiSn: '350000000000033', ...HECHO })] }))
    await user.click(screen.getByRole('button', { name: 'Cambio de grado' }))
    const tabla = screen.getByRole('table', { name: 'Cambio de grado' })
    expect(cabeceras(tabla)).toEqual(['IMEI', 'Modelo', 'Grado', 'Producto en NSYS hoy', 'Por qué', 'Desde', '✓ Marcar todo (1)'])
    expect(filas(tabla)[0]).toHaveTextContent('A → A100')
    expect(filas(tabla)[0]).toHaveTextContent('primero su cambio de color')
    expect(screen.getByText(/en NSYS se cambian uno a uno/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copiar lista (1)' }))
    await waitFor(async () => expect(await navigator.clipboard.readText())
      .toBe('IMEI\tProducto\tGrado en NSYS\tPoner grado\n350000000000022\tApple iPhone 14 eSIM 256GB Midnight\tA\tA100'))
    expect(await screen.findByTestId('aviso-breve'))
      .toHaveTextContent('Copiado: 1 móvil con su grado nuevo. Cuando los cambies en NSYS, márcalos «Hecho»')
  })

  it('«Descargar plantilla» guarda el Excel del servidor y dice cuántos móviles lleva', async () => {
    const user = userEvent.setup()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    server.use(http.get('*/api/stock-telefonos/por-pasar/plantilla-color', () => new HttpResponse(new Blob(['PK']), {
      headers: { 'Content-Disposition': 'attachment; filename="NSYS_color_2026-10-25.xlsx"', 'X-Filas': '1' },
    })))
    pintar(tarjetas({ color: [filaColor(), filaColor({ imeiSn: '350000000000012', ponerProducto: null })] }))
    await user.click(screen.getByRole('button', { name: '⬇ Descargar plantilla (1)' }))
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent(
      'Descargado «NSYS_color_2026-10-25.xlsx» · 1 móvil (los marcados «Hecho» no van). 1 sin producto en NSYS no va: búscalo a mano')
    expect((clic.mock.instances[0] as HTMLAnchorElement).download).toBe('NSYS_color_2026-10-25.xlsx')
  })

  it('No está en NSYS: modelo del taller, último trabajo, técnico, cliente, trabajos y desde', async () => {
    const user = userEvent.setup()
    pintar(tarjetas({ altas: [filaAlta(), filaAlta({ imeiSn: '350000000000099', modelo: '13pro', ultimoTrabajo: 'AP20260918_12', categoria: 'PULIDO', abierto: true, cliente: null, trabajos: 1 })] }))
    await user.click(screen.getByRole('button', { name: 'No está en NSYS' }))
    const tabla = screen.getByRole('table', { name: 'No está en NSYS' })
    expect(cabeceras(tabla)).toEqual(['IMEI', 'Modelo', 'Último trabajo', 'Técnico', 'Cliente', 'Trabajos', 'Desde', '✓ Marcar todo (2)'])
    const [uno, dos] = filas(tabla)
    expect(uno).toHaveTextContent('iPhone 14el del taller')
    expect(uno).toHaveTextContent('R20261006_57 · Reparación')
    expect(uno).toHaveTextContent('AMAZON')
    expect(uno).toHaveTextContent('06/10/2026')
    expect(dos).toHaveTextContent('iPhone 13 Pro')
    expect(dos).toHaveTextContent('AP20260918_12 · Pulido · asignado')
  })

  it('Revisar a mano: qué pasa, qué hacer, «✓ Revisado» y «Corregir…» abre el móvil', async () => {
    const user = userEvent.setup()
    const revisados: string[] = []
    server.use(http.post('*/api/stock-telefonos/por-pasar/avisos/:idAviso/revisado', ({ params }) => {
      revisados.push(String(params.idAviso))
      return new HttpResponse(null, { status: 204 })
    }))
    const abrir = pintar(tarjetas({ revisar: [filaRevisar(), filaRevisar({ idAviso: 2, imeiSn: '350000000000103', tipo: 'SIN_DESHACER', causa: 'BORRADA', idRep: 'R20261023_40', usuario: 'Supertécnico 1' })] }))
    await user.click(screen.getByRole('button', { name: 'Revisar a mano' }))
    const tabla = screen.getByRole('table', { name: 'Revisar a mano' })
    expect(cabeceras(tabla)).toEqual(['IMEI', 'Modelo', 'Qué pasa', 'Qué hacer', 'Reparación', ''])
    const [uno, dos] = filas(tabla)
    expect(uno).toHaveTextContent('Color sin deducir')
    expect(uno).toHaveTextContent('el color del chasis chai14yellowesim no se puede deducir')
    expect(uno).toHaveTextContent('Mira de qué color quedó y corrígelo en su ficha')
    expect(uno).toHaveTextContent('R20261022_2Técnico 3 · 22/10/2026 11:14')
    expect(dos).toHaveTextContent('No se pudo deshacer')
    expect(dos).toHaveTextContent('Se borró la reparación R20261023_40 que cambió el color')
    await user.click(within(uno).getByRole('button', { name: 'Revisado R20261022_2 de 350000000000101' }))
    await waitFor(() => expect(revisados).toEqual(['1']))
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent('Revisado: sale de la lista (queda en el rastro)')
    await user.click(within(dos).getByRole('button', { name: 'Corregir 350000000000103' }))
    expect(abrir).toHaveBeenCalledWith('350000000000103')
  })

  it('sin nada lo dice en cada lista, y si no carga lo dice', async () => {
    const user = userEvent.setup()
    pintar()
    expect(screen.getByText('Ningún cambio de color pendiente.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No está en NSYS' }))
    expect(screen.getByText('Todos los móviles del taller están en NSYS.')).toBeInTheDocument()
  })
})
