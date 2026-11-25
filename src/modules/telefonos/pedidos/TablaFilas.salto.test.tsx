import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { imeiConLuhnMalo, imeiValido } from '../test/imeiValido'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { TablaFilas } from './TablaFilas'
import { congelarHoy } from '../test/hoy'

congelarHoy()

// Al guardar un IMEI tecleado o leído, el foco pasa a la siguiente celda vacía de abajo, sin esperar al servidor.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`
const f = (i: number, extra: Parameters<typeof fila>[0] = {}) => fila({ idFila: i, pedido: pedido(i), ...extra })
const campo = () => screen.queryByRole('textbox', { name: 'IMEI' })
// IMEI sintéticos que pasan la cifra de control.
const A = imeiValido(11)
const B = imeiValido(22)
const C = imeiValido(44)
const pulsar = (id: string, imei: string | null, imeiAnterior = '') => ({ id, imei, imeiAnterior })
let puts: { id: string; imei: string | null; imeiAnterior: string | null | undefined }[] = []
let claves: (string | null)[] = []
let recomendados = 0
/** Lo que dura sin teclear una persona entre una lectura y la siguiente (más que SUSTITUIR_MS). */
const pausa = (ms = 350) => new Promise((r) => setTimeout(r, ms))

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  puts = []
  claves = []
  recomendados = 0
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas/:id/recomendados', () => { recomendados++; return HttpResponse.json([]) }),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { imei: string | null; imeiAnterior?: string | null }
      puts.push({ id: String(params.id), imei: cuerpo.imei, imeiAnterior: cuerpo.imeiAnterior })
      claves.push(request.headers.get('Idempotency-Key'))
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }),
  )
})

const abrirTabla = (filas: ReturnType<typeof f>[]) => renderConProviders(<TablaFilas filas={filas} />, { sesion: SESION_SUPER })
const vacia = async (n = 0) => (await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[n]
const aqui = () => document.querySelector('tr[data-aqui]')

describe('TablaFilas: salto a la siguiente celda vacía', () => {
  it('salta a la siguiente fila editable sin IMEI, saltándose las que ya tienen y las no editables', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2, { imei: '350000000000002' }), f(3, { estado: 'HISTORICO', editable: false }), f(4)])
    await user.click(await vacia())
    await user.keyboard(A)
    // Al llegar a 15 no se guarda en el acto: se espera un momento quieto (120 ms) sin más entrada.
    expect(puts).toEqual([])
    await waitFor(() => expect(puts).toEqual([pulsar('1', A)]))
    await waitFor(() => expect(campo()).toHaveFocus())
    expect(campo()).toHaveValue('')
    expect(aqui()).toHaveTextContent(pedido(4))
    expect(screen.getAllByRole('textbox', { name: 'IMEI' })).toHaveLength(1)
  })

  it('con Enter tras las 15 cifras también salta, y el Enter del lector que llega a la celda nueva no da error', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${A}{Enter}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await pausa(200)
    expect(puts).toEqual([pulsar('1', A)])
  })

  it('no salta a las filas En espera de stock, En revisión ni Cancelado, pero sí a la de Pendiente de color', async () => {
    const user = userEvent.setup()
    abrirTabla([
      f(1), f(2, { marca: 'ESPERA_STOCK' }), f(3, { marca: 'EN_REVISION' }), f(4, { marca: 'CANCELADO' }), f(5, { marca: 'PENDIENTE_COLOR' }), f(6),
    ])
    await user.click(await vacia())
    await user.keyboard(A)
    await waitFor(() => expect(puts).toEqual([pulsar('1', A)]))
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(5)))
    expect(campo()).toHaveFocus()
  })

  it('con solo filas marcadas por debajo, se cierra', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2, { marca: 'ESPERA_STOCK' }), f(3, { marca: 'CANCELADO' })])
    await user.click(await vacia())
    await user.keyboard(A)
    await waitFor(() => expect(puts).toEqual([pulsar('1', A)]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('sin ninguna vacía por debajo, se cierra (aunque haya una vacía por encima)', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia(1))
    await user.keyboard(B)
    await waitFor(() => expect(puts).toEqual([pulsar('2', B)]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('dos lecturas seguidas sin esperar dejan cada IMEI en su fila y un solo guardado por fila', async () => {
    const user = userEvent.setup()
    let liberar = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    server.use(http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { imei: string; imeiAnterior: string }
      puts.push({ id: String(params.id), imei: cuerpo.imei, imeiAnterior: cuerpo.imeiAnterior })
      await espera
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }))
    abrirTabla([f(1), f(2), f(3)])
    await user.click(await vacia())
    await user.keyboard(`${A}{Enter}${B}{Enter}`)
    liberar()
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts).toEqual([pulsar('1', A), pulsar('2', B)])
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(3)))
    expect(campo()).toHaveValue('')
  })

  it('si falla el guardado de la anterior no sale el diálogo: la celda queda en rojo, hay aviso con el pedido y el foco sigue en la siguiente', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/imei', ({ params, request }) => {
      puts.push({ id: String(params.id), imei: null, imeiAnterior: null }); claves.push(request.headers.get('Idempotency-Key'))
      return HttpResponse.json({ message: 'No se pudo' }, { status: 422 })
    }))
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(A)
    await waitFor(() => expect(estadoPedidos.get().avisoImei).toBe(`No se guardó el IMEI del pedido ${pedido(1)}. Vuelve a abrir su celda.`))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText('No se pudo')).not.toBeInTheDocument()
    expect(aqui()).toHaveTextContent(pedido(2))
    expect(campo()).toHaveFocus()
    // La celda de la fila 1, en rojo con las últimas cifras.
    expect(await screen.findByRole('button', { name: `No se guardó …${A.slice(-4)} · pulsa para reintentar` })).toBeInTheDocument()
    expect(puts).toHaveLength(1)
  })

  it('reabrir la celda fallida trae el IMEI y Enter reintenta con la MISMA clave de idempotencia y el mismo imeiAnterior', async () => {
    const user = userEvent.setup()
    let fallar = true
    server.use(http.put('*/api/pedidos/filas/:id/imei', async ({ params, request }) => {
      const cuerpo = (await request.json()) as { imei: string; imeiAnterior: string }
      puts.push({ id: String(params.id), imei: cuerpo.imei, imeiAnterior: cuerpo.imeiAnterior }); claves.push(request.headers.get('Idempotency-Key'))
      return fallar ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(fila({ idFila: Number(params.id), imei: cuerpo.imei }))
    }))
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(A)
    const roja = await screen.findByRole('button', { name: /pulsa para reintentar/ })
    // Un 503 (corte de conexión) tampoco abre el diálogo modal.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // El foco no se mueve solo a la fila que falló.
    expect(aqui()).toHaveTextContent(pedido(2))
    fallar = false
    await user.click(roja)
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'IMEI' })).toHaveLength(1))
    expect(campo()).toHaveValue(A)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts).toEqual([pulsar('1', A), pulsar('1', A)])
    expect(claves[1]).toBe(claves[0])
    expect(claves[0]).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: /pulsa para reintentar/ })).not.toBeInTheDocument())
    expect(estadoPedidos.get().fallosImei).toEqual({})
  })

  it('un fallo (no 409) en una celda sin salto deja la celda en rojo y el aviso, sin diálogo, y se queda abierta para reintentar', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/imei', () => HttpResponse.json({ message: 'No se pudo' }, { status: 422 })))
    abrirTabla([f(1), f(2)])
    await user.click(await vacia(1))
    await user.keyboard(B)
    await waitFor(() => expect(estadoPedidos.get().avisoImei).toBe(`No se guardó el IMEI del pedido ${pedido(2)}. Vuelve a abrir su celda.`))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Sin salto, la celda se queda abierta con lo escrito y el fallo apuntado; cerrada, queda en rojo para reintentar.
    expect(campo()).toHaveValue(B)
    expect(estadoPedidos.get().fallosImei[2]?.imei).toBe(B)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /pulsa para reintentar/ })).toBeInTheDocument()
  })

  it('un 409 (otra persona cambió el IMEI) no deja estado de fallo con reintento: solo el aviso con el mensaje del servidor, y la celda se cierra', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/imei', () => HttpResponse.json({ message: 'Otra persona lo ha cambiado' }, { status: 409 })))
    abrirTabla([f(1), f(2)])
    await user.click(await vacia(1))
    await user.keyboard(B)
    await waitFor(() => expect(estadoPedidos.get().avisoImei).toBe(`Pedido ${pedido(2)}: Otra persona lo ha cambiado`))
    expect(estadoPedidos.get().fallosImei).toEqual({})
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pulsa para reintentar/ })).not.toBeInTheDocument()
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('un 409 de IMEI duplicado («Este IMEI ya está…») deja la celda en rojo con ese mensaje tal cual y sin reintento', async () => {
    const user = userEvent.setup()
    const texto = 'Este IMEI ya está en el pedido 402-0099999-0000001 (fila del 17/11)'
    server.use(http.put('*/api/pedidos/filas/:id/imei', () => HttpResponse.json({ message: texto }, { status: 409 })))
    abrirTabla([f(1), f(2)])
    await user.click(await vacia(0))
    await user.keyboard(B)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pulsa para reintentar/ })).not.toBeInTheDocument()
    expect(document.querySelector('td[data-imei][class*="FDE2E2"]')).not.toBeNull()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(estadoPedidos.get().fallosImei[1]?.mensaje).toBe(texto)
  })

  it('el salto también llega a una fila marcada «falta por enviar» sin IMEI (cuenta como pendiente)', async () => {
    const user = userEvent.setup()
    const marcada = { estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', faltaEnviarEn: '2026-11-10T09:00:00', canal: 'DISTRIBUIDORES' }
    abrirTabla([f(1), f(2, marcada), f(3)])
    await user.click(await vacia())
    await user.keyboard(A)
    await waitFor(() => expect(puts).toEqual([pulsar('1', A)]))
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(campo()).toHaveFocus()
  })

  it('el guardado manda siempre imeiAnterior: el IMEI que tenía la fila al abrir la celda, «» si no tenía', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2, { imei: '350000000000002' })])
    await user.click(await vacia())
    await user.keyboard(`${A}{Enter}`)
    await waitFor(() => expect(puts).toEqual([pulsar('1', A, '')]))
    await user.click(await screen.findByRole('button', { name: /350000000000002/ }))
    await user.keyboard('{Enter}') // campo vacío + Enter quita el IMEI
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1]).toEqual(pulsar('2', null, '350000000000002'))
  })

  it('quitar el IMEI (campo vacío y Enter) no salta: se cierra', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1, { imei: '350000000000001' }), f(2)])
    await user.click(await screen.findByRole('button', { name: /350000000000001/ }))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(puts).toEqual([pulsar('1', null, '350000000000001')]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })
})

// Las lecturas del lector de códigos que antes se derramaban a la fila siguiente: ahora nada cae en otra fila.
describe('TablaFilas: lecturas que no deben derramarse', () => {
  it('una cifra suelta y luego dos lecturas: no se guarda nada desplazado; la errónea queda en rojo y la lectura nueva va a la fila siguiente', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2), f(3)])
    await user.click(await vacia())
    await user.keyboard('9')
    // La cifra suelta + la 1.ª lectura entera pasan de 15: no válida, sin guardar; la fila 1 queda en rojo y el campo salta a la 2.
    await user.keyboard(`${A}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.getByRole('button', { name: /IMEI no válido · 16 cifras/ })).toBeInTheDocument()
    await pausa(250)
    expect(puts).toEqual([])
    expect(screen.getAllByRole('textbox', { name: 'IMEI' })).toHaveLength(1)
    expect(campo()).toHaveValue('')
    // Pasa un rato y llega la 2.ª lectura: se guarda en ESTA fila, la 2, y salta a la 3; la 1 sigue en rojo.
    await pausa(350)
    await user.keyboard(`${B}{Enter}`)
    await waitFor(() => expect(puts).toEqual([pulsar('2', B)]))
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(3)))
    expect(campo()).toHaveValue('')
    expect(puts).toHaveLength(1)
    expect(screen.getByRole('button', { name: /IMEI no válido · 16 cifras/ })).toBeInTheDocument()
  })

  it('un código 2D con dos IMEI (A B y Enter) no reparte uno en cada fila: rojo «30 cifras» y nada guardado', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${A} ${B}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.getByRole('button', { name: /IMEI no válido · 30 cifras/ })).toBeInTheDocument()
    await pausa(300)
    expect(puts).toEqual([])
    expect(campo()).toHaveValue('')
  })

  it('con 16 cifras o más (prefijo o cifras de sobra) no se corta ni se guarda: rojo «16 cifras» y salta', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${A}7{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.getByRole('button', { name: /IMEI no válido · 16 cifras/ })).toBeInTheDocument()
    await pausa(300)
    expect(puts).toEqual([])
  })

  it('la ráfaga que llega con pausas cortas (menos de 120 ms) entre cifras no se guarda a medias', async () => {
    const user = userEvent.setup({ delay: 30 })
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(A)
    await waitFor(() => expect(puts).toEqual([pulsar('1', A)]))
  })

  it('con la cifra de control mala no guarda, ni solo ni con Enter: queda en rojo y salta; «Guardar igual» al reabrirla guarda y cierra SIN saltar', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    const malo = imeiConLuhnMalo(11)
    await user.keyboard(`${malo}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await pausa(300)
    expect(puts).toEqual([])
    await user.click(screen.getByRole('button', { name: /IMEI no válido/ }))
    expect(aqui()).toHaveTextContent(pedido(1))
    await user.click(screen.getByRole('button', { name: 'Guardar igual' }))
    await waitFor(() => expect(puts).toEqual([pulsar('1', malo)]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
    // Cerró sin saltar a la fila 2.
    expect(aqui()).toHaveTextContent(pedido(1))
  })

  it('tras una lectura con cifra de control mala, la lectura nueva (tras una pausa) se guarda en la fila siguiente, no en la errónea', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(imeiConLuhnMalo(11))
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await pausa(350)
    await user.keyboard(C)
    await waitFor(() => expect(puts).toEqual([pulsar('2', C)]))
  })

  it('sin error, lo tecleado tras una pausa se añade como siempre', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard('3500')
    await pausa(350)
    await user.keyboard('12')
    expect(campo()).toHaveValue('350012')
  })

  it('dos lecturas buenas seguidas siguen funcionando: cada una en su fila y un PUT por fila', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2), f(3)])
    await user.click(await vacia())
    await user.keyboard(`${A}{Enter}`)
    await pausa(350)
    await user.keyboard(`${B}{Enter}`)
    await waitFor(() => expect(puts).toHaveLength(2))
    await pausa(250)
    expect(puts).toEqual([pulsar('1', A), pulsar('2', B)])
    expect(aqui()).toHaveTextContent(pedido(3))
  })
})

describe('TablaFilas: recomendados plegados', () => {
  it('se abre plegado y sin pedir nada; «Ver recomendados» los despliega y los pide; cada celda empieza plegada', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await waitFor(() => expect(campo()).toHaveFocus())
    const ver = screen.getByRole('button', { name: 'Ver recomendados' })
    expect(ver).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/dónde buscarlo/)).not.toBeInTheDocument()
    expect(recomendados).toBe(0)
    await user.click(ver)
    expect(screen.getByRole('button', { name: 'Ver recomendados' })).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('dialog', { name: 'Recomendados' })).toBeInTheDocument()
    expect(await screen.findByText(/No hay ningún móvil de ese modelo/)).toBeInTheDocument()
    expect(recomendados).toBe(1)
    await user.keyboard('{Escape}') // cierra solo la lista
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Recomendados' })).not.toBeInTheDocument())
    expect(campo()).toBeInTheDocument()
    // Con la fila 1 abierta solo la 2 tiene botón: al pulsarla se cierra la 1 y la 2 empieza plegada.
    await user.click((await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[0])
    expect(await screen.findByRole('button', { name: 'Ver recomendados' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Pedidos: sin la etiqueta «a la vista» y salto en la tabla grande', () => {
  const FILAS = Array.from({ length: 300 }, (_, i) => f(i + 1, { imei: i === 0 || i === 289 ? null : '350000000000001' }))
  it('filtrar no añade «N a la vista» y, en modo ventana, el salto lleva a una fila que no estaba pintada', async () => {
    server.use(
      http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
      http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
      http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    )
    const user = userEvent.setup()
    renderConProviders(<PedidosPage umbralVentana={20} />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
    await screen.findByRole('button', { name: '300 filas' })
    await user.click(screen.getByRole('button', { name: '2 sin IMEI' }))
    expect(screen.queryByText(/a la vista/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '300 filas' }))
    // Se sube al principio: la fila 1 es la primera vacía y la 290, la siguiente, queda muy lejos de lo pintado.
    const region = screen.getByRole('region', { name: 'Tabla de pedidos' })
    region.scrollTop = 0
    fireEvent.scroll(region)
    await user.click(await screen.findByRole('button', { name: /pulsa para poner el IMEI/ }))
    expect(screen.queryByText(pedido(290))).not.toBeInTheDocument()
    await user.keyboard(A)
    await waitFor(() => expect(screen.getByText(pedido(290))).toBeInTheDocument())
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(290)))
    await waitFor(() => expect(campo()).toHaveFocus())
  })
})
