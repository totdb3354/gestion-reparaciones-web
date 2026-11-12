import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { candidato, estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { maquetarJsdom } from '@/test/layoutJsdom'

const FILAS = [
  fila({ idFila: 1, estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', impresaEn: '2026-11-10T09:15:00', tieneEtiqueta: true, transportista: 'UPSv2', seguimiento: '1Z0000000000000001', imei: '350000000000010', pedido: '402-0000000-0000011' }),
  fila({ idFila: 2, pedido: '402-0000000-0000012', imei: '350000000000001', nivel: 'OK', caja: 'CAJA LISTOS' }),
  fila({ idFila: 3, pedido: '402-0000000-0000013' }),
  fila({ idFila: 4, pedido: '402-0000000-0000014', imei: '350000000000999', nivel: 'MAL', motivo: 'COLOR_O_GRADO', skuMovil: 'i14eSIM128RojoA', caja: 'CAJA LISTOS' }),
  fila({ idFila: 5, pedido: '402-0000000-0000015', imei: '350000000000002', nivel: 'AVISO', motivo: 'MS' }),
  fila({ idFila: 6, estado: 'NO_PENDIENTE', pedido: '402-0000000-0000016', imei: '350000000000003', nivel: 'MAL', motivo: 'EN_OTRA_FILA' }),
  fila({ idFila: 7, estado: 'HISTORICO', editable: false, pedido: '402-0000000-0000017', imei: '350000000000004', envioFecha: '2026-10-01T08:00:00' }),
  fila({ idFila: 8, estado: 'HISTORICO', editable: false, pedido: '402-0000000-0000018' }),
  fila({ idFila: 9, estado: 'ENVIADA', envioFecha: '2026-11-09T11:00:00', tieneEtiqueta: true, pedido: '402-0000000-0000019' }),
]

let puts: { id: string; cuerpo: unknown }[] = []

afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  puts = []
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([
      candidato({ imei: '350000000000101', caja: 'CAJA LISTOS', nivel: 1 }),
      candidato({ imei: '350000000000103', caja: 'Taller', nivel: 3 }),
    ])),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      puts.push({ id: String(params.id), cuerpo: await request.json() })
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const celdaVacia = async () => (await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[0]
// Sin ninguna fila vacía por debajo de la 3 (la 9, enviada, tenía el campo vacío): al guardar no hay a dónde saltar y la celda se cierra.
const sinSalto = () => server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS.map((f) => (f.idFila === 9 ? { ...f, imei: '350000000000009' } : f)), hayMas: false })))
const verRecomendados = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(await screen.findByRole('button', { name: 'Ver recomendados' })) }
const campo = () => screen.queryByRole('textbox', { name: 'IMEI' })

describe('Pedidos como la hoja: la tabla', () => {
  it('cabecera con el recuento y la tabla con sus siete columnas, sin letras ni número de fila', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '9 filas' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Enviado', 'Fecha compra'])
    expect(screen.getAllByRole('row')).toHaveLength(10)
    expect(screen.getAllByText('09/11/2026').length).toBeGreaterThan(0)
  })

  it('la celda mal lleva su motivo; la que cuadra, su caja; la vacía invita a poner el IMEI', async () => {
    abrir()
    const mal = await screen.findByRole('button', { name: /350000000000999/ })
    expect(mal).toHaveTextContent('otro color o grado: es i14eSIM128RojoA')
    expect(screen.getByRole('button', { name: /350000000000001/ })).toHaveTextContent('CAJA LISTOS')
    expect(screen.getByRole('button', { name: /350000000000002/ })).toHaveTextContent('es un Ms')
    expect(await celdaVacia()).toBeInTheDocument()
  })

  it('«Enviado» es una etiqueta con texto: Pendiente, Etiqueta generada dd/mm, Enviado dd/mm (fecha de la impresión) con transportista y seguimiento, Ya no está pendiente, De la hoja', async () => {
    abrir()
    await screen.findByRole('button', { name: '9 filas' })
    const celda = (pedido: string) => screen.getByText(pedido).closest('tr')!.querySelectorAll('td')[5]
    // Visible sin ratón: etiqueta con el día y el mes, y tras ella transportista y seguimiento; además, el título.
    // «Enviado» lleva la fecha de la impresión (10/11), no la del envío (09/11).
    expect(celda('402-0000000-0000011')).toHaveTextContent('Enviado 10/11 UPS 1Z0000000000000001')
    expect(celda('402-0000000-0000011')).toHaveAttribute('title', 'UPS · 1Z0000000000000001')
    expect(celda('402-0000000-0000019').textContent).toBe('Etiqueta generada 09/11')
    expect(celda('402-0000000-0000019')).not.toHaveAttribute('title')
    expect(celda('402-0000000-0000016').textContent).toBe('Ya no está pendiente')
    expect(celda('402-0000000-0000013').textContent).toBe('Pendiente')
    // El histórico, aunque tenga fecha de envío, no la enseña.
    expect(celda('402-0000000-0000017').textContent).toBe('De la hoja')
  })

  it('cada fila lleva su estado en `data-estado`', async () => {
    abrir()
    await screen.findByRole('button', { name: '9 filas' })
    const estado = (pedido: string) => screen.getByText(pedido).closest('tr')!.getAttribute('data-estado')
    expect(['11', '13', '16', '17'].map((n) => estado(`402-0000000-00000${n}`))).toEqual(['ENVIADA', 'PENDIENTE', 'NO_PENDIENTE', 'HISTORICO'])
  })

  it('una etiqueta generada sin fecha dice «Etiqueta generada», y la «Enviado» lleva `data-impresa`', async () => {
    server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: [fila({ idFila: 1, estado: 'ENVIADA', pedido: '402-0000000-0000031' })], hayMas: false })))
    abrir()
    expect((await screen.findByText('402-0000000-0000031')).closest('tr')!.querySelectorAll('td')[5]).toHaveTextContent(/^Etiqueta generada$/)
  })

  it('`data-impresa` solo en las filas con la etiqueta impresa; `data-estado` sigue siendo el del servidor', async () => {
    abrir()
    await screen.findByRole('button', { name: '9 filas' })
    const tr = (n: string) => screen.getByText(`402-0000000-00000${n}`).closest('tr')!
    expect(tr('11')).toHaveAttribute('data-impresa', 'true')
    expect(tr('11')).toHaveAttribute('data-estado', 'ENVIADA')
    expect(tr('19')).not.toHaveAttribute('data-impresa')
    expect(tr('19')).toHaveAttribute('data-estado', 'ENVIADA')
    expect(tr('13')).not.toHaveAttribute('data-impresa')
  })

  it('la fila va en gris solo si es del histórico: enviada, pendiente y no pendiente, en texto normal', async () => {
    abrir()
    await screen.findByRole('button', { name: '9 filas' })
    const td = (pedido: string) => screen.getByText(pedido).closest('td')!
    expect(td('402-0000000-0000017')).toHaveClass('bg-[#fafbfc]')
    for (const n of ['11', '13', '16']) expect(td(`402-0000000-00000${n}`).className).not.toMatch(/bg-|text-\[#8b93a1\]/)
  })


  it('una fila enviada se edita: abre el desplegable con «Quitar el IMEI» y hace PUT', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /350000000000010/ }))
    expect(campo()).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Quitar el IMEI' }))
    await waitFor(() => expect(puts).toEqual([{ id: '1', cuerpo: { imei: null } }]))
  })

  it('una enviada sin IMEI invita a ponerlo; una no pendiente con aviso lo enseña', async () => {
    abrir()
    const vacias = await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ })
    expect(vacias).toHaveLength(2)
    expect(screen.getByRole('button', { name: /350000000000003/ })).toHaveTextContent('ya está en otro pedido')
  })

  it('una fila del histórico es texto: sin botón, y sin invitación si no tiene IMEI', async () => {
    const user = userEvent.setup()
    abrir()
    const conImei = await screen.findByText('350000000000004')
    expect(conImei.closest('button')).toBeNull()
    await user.click(conImei)
    expect(campo()).not.toBeInTheDocument()
    const sinImei = screen.getByText('402-0000000-0000018').closest('tr')!.querySelectorAll('td')[3]
    expect(sinImei).toBeEmptyDOMElement()
    expect(screen.queryAllByText(/pulsa para poner el IMEI/)).toHaveLength(2)
  })

  it('sin filas, lo dice', async () => {
    server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: [], hayMas: false })))
    abrir()
    expect(await screen.findByText('No hay pedidos en este periodo.')).toBeInTheDocument()
  })
})

describe('Pedidos como la hoja: la celda del IMEI', () => {
  it('abre el desplegable con los recomendados, su caja y su nivel', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    expect(campo()).toBeInTheDocument()
    await waitFor(() => expect(campo()).toHaveFocus())
    expect(screen.queryByRole('button', { name: /350000000000101/ })).not.toBeInTheDocument()
    await verRecomendados(user)
    const c = await screen.findByRole('button', { name: /350000000000101/ })
    expect(c).toHaveTextContent('CAJA LISTOS')
    expect(c).toHaveTextContent('igual que el pedido')
    expect(screen.getByRole('button', { name: /350000000000103/ })).toHaveTextContent('hay que transformarlo')
    expect(screen.queryByRole('button', { name: 'Quitar el IMEI' })).not.toBeInTheDocument()
    // El SKU del título sale tal cual (sin pasarlo a mayúsculas).
    const sku = screen.getByText('i13128AzulA', { selector: 'span.normal-case' })
    expect(sku.parentElement).toHaveTextContent('Recomendados para i13128AzulA')
  })

  it('elegir un candidato hace PUT con ese IMEI y cierra', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await verRecomendados(user)
    await user.click(await screen.findByRole('button', { name: /350000000000101/ }))
    await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000101' } }]))
    // Elegir un recomendado con el ratón no salta a la siguiente fila vacía (la 9): se cierra.
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('escribir 15 cifras y Enter guarda', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '350000000000555{Enter}')
    await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000555' } }]))
  })

  it('escribir 14 cifras no llama y enseña el mensaje bajo el campo', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '35000000000055{Enter}')
    expect(screen.getByText('Un IMEI son 15 cifras')).toBeInTheDocument()
    expect(puts).toEqual([])
  })

  it('«Quitar el IMEI» manda null', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /350000000000999/ }))
    await user.click(screen.getByRole('button', { name: 'Quitar el IMEI' }))
    await waitFor(() => expect(puts).toEqual([{ id: '4', cuerpo: { imei: null } }]))
  })

  it('Escape, «Cerrar» y el clic fuera cierran; solo hay uno abierto', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.keyboard('{Escape}')
    expect(campo()).not.toBeInTheDocument()
    expect(await celdaVacia()).toHaveFocus()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(campo()).not.toBeInTheDocument()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('heading', { name: 'Pedidos' }))
    expect(campo()).not.toBeInTheDocument()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('button', { name: /350000000000001/ }))
    expect(screen.getAllByRole('textbox', { name: 'IMEI' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /350000000000001/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('si el PUT falla, el desplegable sigue abierto con lo escrito', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/imei', () => { puts.push({ id: 'x', cuerpo: null }); return HttpResponse.json({ message: 'No se pudo' }, { status: 422 }) }))
    sinSalto()
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '350000000000555')
    await waitFor(() => expect(puts).toHaveLength(1))
    // El desplegable también es role=dialog: el de error se distingue por su texto.
    expect(await screen.findByText('No se pudo')).toBeInTheDocument()
    // El diálogo de error (modal) deja el resto fuera del árbol de accesibilidad: se busca con `hidden`.
    const abierto = screen.getByRole('textbox', { name: 'IMEI', hidden: true })
    expect(abierto).toHaveValue('350000000000555')
  })

  it('un segundo Enter con el PUT pendiente no manda otra petición', async () => {
    const user = userEvent.setup()
    let liberar = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    server.use(http.put('*/api/pedidos/filas/:id/imei', async ({ params }) => {
      puts.push({ id: String(params.id), cuerpo: null })
      await espera
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }))
    sinSalto()
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '350000000000555{Enter}{Enter}')
    // Los dos Enter ya se han tecleado (user.type espera): el segundo no pudo mandar otra petición mientras la primera seguía pendiente.
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(campo()).toHaveAttribute('readonly')
    liberar()
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
    expect(puts).toHaveLength(1)
  })

  describe('el campo del IMEI con lector de códigos', () => {
    it('solo admite cifras, también al pegar, con el contador n/15 y el texto de ayuda', async () => {
      const user = userEvent.setup()
      abrir()
      await user.click(await celdaVacia())
      const c = campo() as HTMLElement
      expect(c).toHaveAttribute('placeholder', 'Lee o escribe el IMEI (15 cifras)')
      expect(c).toHaveAttribute('inputmode', 'numeric')
      expect(c).toHaveAttribute('autocomplete', 'off')
      expect(screen.getByText('0/15')).toHaveAttribute('aria-hidden', 'true')
      await user.type(c, '35a0-b 0')
      expect(c).toHaveValue('3500')
      expect(screen.getByText('4/15')).toBeInTheDocument()
      await user.paste(' 0x00\n000 ')
      expect(c).toHaveValue('3500000000')
      expect(puts).toEqual([])
    })

    it('al llegar a 15 cifras guarda solo, una vez, y cierra sin pulsar Enter', async () => {
      const user = userEvent.setup()
      sinSalto()
      abrir()
      await user.click(await celdaVacia())
      await user.type(campo() as HTMLElement, '350000000000055')
      await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000055' } }]))
      await waitFor(() => expect(campo()).not.toBeInTheDocument())
      expect(puts).toHaveLength(1)
    })

    it('pegar el IMEI entero con espacios y salto de línea (lo que manda un lector) lo guarda', async () => {
      const user = userEvent.setup()
      abrir()
      await user.click(await celdaVacia())
      await (campo() as HTMLElement).focus()
      await user.paste('350 000 000 000 055\n')
      await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000055' } }]))
    })

    it('cifras de más se descartan: nunca pasa de 15', async () => {
      const user = userEvent.setup()
      abrir()
      await user.click(await celdaVacia())
      await user.paste('3500000000000559999')
      await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000055' } }]))
    })

    it('el Enter que manda el lector tras las 15 cifras no da error ni guarda por segunda vez mientras el guardado sigue pendiente', async () => {
      const user = userEvent.setup()
      let liberar = () => {}
      const espera = new Promise<void>((r) => { liberar = r })
      server.use(http.put('*/api/pedidos/filas/:id/imei', async ({ params }) => {
        puts.push({ id: String(params.id), cuerpo: null })
        await espera
        return HttpResponse.json(fila({ idFila: Number(params.id) }))
      }))
      sinSalto()
      abrir()
      await user.click(await celdaVacia())
      const c = campo() as HTMLElement
      await user.type(c, '350000000000055{Enter}{Enter}')
      await user.keyboard('7')
      await waitFor(() => expect(puts).toHaveLength(1))
      expect(c).toHaveValue('350000000000055')
      expect(screen.queryByText('Un IMEI son 15 cifras')).not.toBeInTheDocument()
      liberar()
      await waitFor(() => expect(campo()).not.toBeInTheDocument())
      expect(puts).toHaveLength(1)
    })

    it('Enter con menos de 15 cifras da el error y no guarda', async () => {
      const user = userEvent.setup()
      abrir()
      await user.click(await celdaVacia())
      await user.type(campo() as HTMLElement, '3500{Enter}')
      expect(screen.getByRole('alert')).toHaveTextContent('Un IMEI son 15 cifras')
      expect(puts).toEqual([])
      await user.type(campo() as HTMLElement, '0')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('si el guardado falla se queda abierto con las 15 cifras, no se repite solo y Enter reintenta', async () => {
      const user = userEvent.setup()
      let fallar = true
      server.use(http.put('*/api/pedidos/filas/:id/imei', ({ params }) => {
        puts.push({ id: String(params.id), cuerpo: null })
        return fallar ? HttpResponse.json({ message: 'No se pudo' }, { status: 422 }) : HttpResponse.json(fila({ idFila: Number(params.id) }))
      }))
      sinSalto()
      abrir()
      await user.click(await celdaVacia())
      await user.type(campo() as HTMLElement, '350000000000055')
      expect(await screen.findByText('No se pudo')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Aceptar' }))
      await waitFor(() => expect(screen.queryByText('No se pudo')).not.toBeInTheDocument())
      const c = screen.getByRole('textbox', { name: 'IMEI' })
      expect(c).toHaveValue('350000000000055')
      expect(c).not.toHaveAttribute('readonly')
      expect(puts).toHaveLength(1)
      fallar = false
      await user.type(c, '{Enter}')
      await waitFor(() => expect(puts).toHaveLength(2))
      await waitFor(() => expect(campo()).not.toBeInTheDocument())
    })
  })

  it('mientras llegan los recomendados dice «Cargando…»; sin ninguno, que no hay', async () => {
    const user = userEvent.setup()
    let liberar = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    server.use(http.get('*/api/pedidos/filas/:id/recomendados', async () => { await espera; return HttpResponse.json([]) }))
    abrir()
    await user.click(await celdaVacia())
    await verRecomendados(user)
    expect(await screen.findByText('Cargando…')).toBeInTheDocument()
    liberar()
    expect(await screen.findByText(/No hay ningún móvil de ese modelo/)).toBeInTheDocument()
  })

  it('un sondeo con filas nuevas deja abierto el desplegable con lo escrito', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '3500000')
    server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS.map((f) => ({ ...f, plataforma: 'Plataforma Z' })), hayMas: false })))
    await queryClient.invalidateQueries()
    await waitFor(() => expect(screen.getAllByText('Plataforma Z').length).toBe(9))
    expect(campo()).toHaveValue('3500000')
  })
})
