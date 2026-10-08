import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { crearQueryClient } from '@/shared/api/queryClient'
import { avisaAlSalir } from '@/test/avisoAlSalir'
import { renderConRouter, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { CLAVE_COMPONENTES_GESTIONADOS } from '../../stock/api'
import { COMPONENTES, PROVEEDORES, preventiva, urgente } from './datosPrueba'
import { NuevoPedidoDialog } from './NuevoPedidoDialog'

let lotes: { cuerpo: unknown; clave: string | null }[]
let respuestaLote: () => Response
let tasasPedidas: string[]

beforeEach(() => {
  lotes = []
  tasasPedidas = []
  respuestaLote = () => HttpResponse.json({ idsCreados: [101] })
  server.use(
    http.get('*/api/componentes/gestionados', () => HttpResponse.json(COMPONENTES)),
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', ({ params }) => { tasasPedidas.push(String(params.divisa)); return HttpResponse.json({ value: 1.1367 }) }),
    http.post('*/api/compras/lote', async ({ request }) => {
      lotes.push({ cuerpo: await request.json(), clave: request.headers.get('Idempotency-Key') })
      return respuestaLote()
    }),
  )
})

function abrir(precarga: PrecargaPedido = { modo: 'vacio' }) {
  const onCerrar = vi.fn()
  renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={precarga} onCerrar={onCerrar} /> }], { sesion: SESION_SUPER })
  return onCerrar
}

/** Por etiqueta y no por rol: si un aviso global abre su diálogo encima, el formulario queda aria-hidden y los *ByRole
 *  dejarían de verlo. */
const filaDe = (n: number) => screen.getByLabelText(`Cantidad línea ${n}`).closest('tr') as HTMLElement
const confirmar = () => userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

async function elegirComponente(n: number, texto: string, opcion: string) {
  await userEvent.type(screen.getByRole('combobox', { name: `Componente línea ${n}` }), texto)
  await userEvent.click(await screen.findByRole('option', { name: opcion }))
}

/** ComboNavy: disparador role="combobox" con aria-label; lista role="listbox" con el mismo nombre; cada opción es un
 *  <li role="option"> con un <button> dentro, que es quien recibe el clic (ComboNavy.tsx:79-118). */
async function elegirProveedor(n: number, nombre: string) {
  await userEvent.click(screen.getByRole('combobox', { name: `Proveedor línea ${n}` }))
  await userEvent.click(await within(screen.getByRole('listbox', { name: `Proveedor línea ${n}` })).findByRole('button', { name: nombre }))
}

async function escribir(etiqueta: string, valor: string) {
  const campo = screen.getByRole('textbox', { name: etiqueta })
  await userEvent.clear(campo)
  await userEvent.type(campo, valor)
}

describe('NuevoPedidoDialog', () => {
  it('Atrás con líneas pide "Descartar": Cancelar se queda con las líneas intactas y Descartar cierra y sale', async () => {
    const onCerrar = vi.fn()
    const { router } = renderConRouter(
      [{ path: '/lista', element: <p>lista</p> }, { path: '/pedido', element: <NuevoPedidoDialog precarga={{ modo: 'vacio' }} onCerrar={onCerrar} /> }],
      { sesion: SESION_SUPER, ruta: '/lista' },
    )
    await act(async () => { await router.navigate('/pedido') })
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await act(async () => { await router.navigate(-1) })
    const confirmacion = await screen.findByRole('dialog', { name: 'Descartar' })
    expect(confirmacion).toHaveTextContent('Se descartará la línea del pedido.')
    // Mismo orden y aspecto que "Descartar" de "Asignar trabajos" (ConfirmDialog): la acción encima de "Cancelar".
    expect(within(confirmacion).getAllByRole('button').map((b) => b.textContent)).toEqual(['Descartar', 'Cancelar', 'Close'])
    expect(router.state.location.pathname).toBe('/pedido')
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Descartar' })).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/pedido')
    expect(screen.getByLabelText('Cantidad línea 1')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await act(async () => { await router.navigate(-1) })
    const otra = await screen.findByRole('dialog', { name: 'Descartar' })
    expect(otra).toHaveTextContent('Se descartarán las 2 líneas del pedido.')
    await userEvent.click(within(otra).getByRole('button', { name: 'Descartar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/lista'))
  })
  it('Atrás sin líneas sale sin preguntar', async () => {
    const { router } = renderConRouter(
      [{ path: '/lista', element: <p>lista</p> }, { path: '/pedido', element: <NuevoPedidoDialog precarga={{ modo: 'vacio' }} onCerrar={vi.fn()} /> }],
      { sesion: SESION_SUPER, ruta: '/lista' },
    )
    await act(async () => { await router.navigate('/pedido') })
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await act(async () => { await router.navigate(-1) })
    expect(router.state.location.pathname).toBe('/lista')
    expect(screen.queryByRole('dialog', { name: 'Descartar' })).not.toBeInTheDocument()
  })

  it('aviso al salir (F5, cerrar la pestaña): sin líneas no pregunta; con una línea, sí; al quitarla, ya no', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    expect(avisaAlSalir()).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(avisaAlSalir()).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 1' }))
    expect(avisaAlSalir()).toBe(false)
  })

  it('vacío: título de 24 px, siete columnas, placeholder y los tres botones', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Nuevo pedido' }))
    expect(dlg.getByRole('heading', { name: 'Nuevo pedido' })).toHaveClass('text-2xl', 'font-bold', 'text-azul-medio')
    expect(screen.getByRole('dialog')).toHaveClass('w-[700px]', 'bg-fondo-vista', 'p-7')
    expect(dlg.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Componente', 'Proveedor', 'Cant.', 'P.Unit.', 'Urg.', 'Total EUR', ''])
    expect(dlg.getByText('Añade al menos una línea')).toBeInTheDocument()
    // Barra del proveedor general primero; la ✕ de DialogContent ("Close", sr-only) va la última.
    expect(dlg.getAllByRole('button').map((b) => b.textContent)).toEqual(['Aplicar a todas', 'Añadir previsión (0)', '+ Añadir línea', 'Cancelar', 'Confirmar pedido', 'Close'])
  })

  it('sin líneas: "Añade al menos una línea." y no envía nada', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Añade al menos una línea.')
    expect(screen.getByRole('alert')).toHaveClass('text-[11px]', 'text-texto-error')
    expect(lotes).toHaveLength(0)
  })

  it('"Pedir" (un componente): una línea con él, cantidad 1, precio 0,00, sin proveedor ni urgente; "+ Añadir línea" añade una vacía (calco: añadirFila(null)) y la selecciona', async () => {
    abrir({ modo: 'componentes', idsCom: [2] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x / bat-y')
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' }).textContent).toBe('')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 1' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Precio línea 1' })).toHaveValue('0,00')
    expect(screen.getByRole('checkbox', { name: 'Urgente línea 1' })).not.toBeChecked()
    expect(within(filaDe(1)).getByText('0,00 €')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 2' }).textContent).toBe('')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 2' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Precio línea 2' })).toHaveValue('0,00')
    expect(screen.getByRole('checkbox', { name: 'Urgente línea 2' })).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x / bat-y')
    expect(filaDe(2)).toHaveAttribute('data-state', 'selected')
    expect(filaDe(1)).not.toHaveAttribute('data-state')
  })

  it('"Pedir" con un componente precargado: no autoenfoca el campo Componente (C25, se pisaría la precarga al teclear)', async () => {
    // Caché ya caliente (como al venir de Stock, que ya pidió `useComponentesStock`): la línea precargada existe
    // desde el primer render del diálogo, que es cuando Radix decide a qué enfocar al abrirse.
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(CLAVE_COMPONENTES_GESTIONADOS, COMPONENTES)
    const onCerrar = vi.fn()
    renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={{ modo: 'componentes', idsCom: [2] }} onCerrar={onCerrar} /> }], { sesion: SESION_SUPER, queryClient: qc })
    const campo = await screen.findByRole('combobox', { name: 'Componente línea 1' })
    expect(campo).toHaveValue('bat-x / bat-y')
    expect(document.activeElement).not.toBe(campo)
  })

  it('componente desactivado o desconocido: la línea va vacía (calco), con su placeholder', async () => {
    abrir({ modo: 'componentes', idsCom: [4, 99] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('')
    const primera = screen.getByRole('combobox', { name: 'Componente línea 1' })
    expect(primera).toHaveValue('')
    expect(primera).toHaveAttribute('placeholder', 'Escribe componente...')
  })

  it('"Pedir todas las piezas" (N componentes): una línea por componente en orden; "+ Añadir línea" añade una vacía', async () => {
    abrir({ modo: 'componentes', idsCom: [1, 2] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('lcd-x-negro')
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('bat-x / bat-y')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 2' })).toHaveValue('1')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(screen.getByRole('combobox', { name: 'Componente línea 3' })).toHaveValue('')
  })

  it('"Pedir piezas": agrupa por componente con urgentes primero, cantidad = nº de solicitudes, y avisa de las omitidas', async () => {
    abrir({ modo: 'solicitudes', urgentes: [urgente(10, 2), urgente(11, 4), urgente(12, 1)], preventivas: [preventiva(20, 2), preventiva(21, 4)] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x / bat-y')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 1' })).toHaveValue('2')
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('lcd-x-negro')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 2' })).toHaveValue('1')
    expect(screen.queryByRole('combobox', { name: 'Componente línea 3' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('2 solicitud(es) de componentes desactivados no se han añadido y siguen pendientes.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si falla la carga de componentes (500), no hay aviso de omitidas y "Cancelar" cierra el diálogo', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => new HttpResponse(null, { status: 500 })))
    const onCerrar = abrir({ modo: 'solicitudes', urgentes: [urgente(10, 2), urgente(11, 4)], preventivas: [] })
    // El error de la consulta abre el diálogo global (queryClient.test.tsx): se cierra antes de seguir con el formulario.
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar' }))
    expect(screen.queryByText(/solicitud\(es\) de componentes desactivados/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('autocompletar: solo activos (una opción por grupo de stock compartido), filtro "contiene" y Enter elige el primero', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    const campo = screen.getByRole('combobox', { name: 'Componente línea 1' })
    await userEvent.type(campo, 'x')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['lcd-x-negro', 'bat-x / bat-y']))
    await userEvent.clear(campo)
    await userEvent.type(campo, 'bat')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['bat-x / bat-y'])
    expect(screen.queryByRole('option', { name: 'bat-y' })).not.toBeInTheDocument()
    await userEvent.type(campo, '{Enter}')
    expect(campo).toHaveValue('bat-x / bat-y')
  })

  it('con muchas líneas: la tabla de líneas tiene alto máximo con scroll propio y los botones siguen visibles (C24)', async () => {
    abrir()
    const boton = await screen.findByRole('button', { name: '+ Añadir línea' })
    for (let i = 0; i < 8; i += 1) await userEvent.click(boton)
    const tabla = screen.getByRole('table').parentElement as HTMLElement
    expect(tabla).toHaveClass('max-h-[260px]', 'overflow-y-auto')
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeInTheDocument()
  })

  it('validación en la línea de error, en orden y parando en el primer fallo; cambiar una línea la borra', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: selecciona un componente.')
    await elegirComponente(1, 'bat', 'bat-x / bat-y')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: selecciona un proveedor.')
    await elegirProveedor(1, 'ACME')
    await escribir('Cantidad línea 1', '0')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: la cantidad debe ser mayor que 0.')
    await escribir('Cantidad línea 1', '2')
    await escribir('Precio línea 1', '-1')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: el precio no puede ser negativo.')
    expect(lotes).toHaveLength(0)
  })

  it('proveedor en USD: solo activos en el combo, símbolo $ y Total EUR = precio / tasa × cantidad; en EUR, € sin pedir tasa', async () => {
    abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor línea 1' }))
    const lista = screen.getByRole('listbox', { name: 'Proveedor línea 1' })
    await within(lista).findByRole('button', { name: 'ACME' })
    expect(within(lista).getAllByRole('button').map((b) => b.textContent)).toEqual(['ACME', 'Proveedor B'])
    await userEvent.click(within(lista).getByRole('button', { name: 'Proveedor B' }))
    await escribir('Precio línea 1', '10')
    await escribir('Cantidad línea 1', '2')
    expect(within(filaDe(1)).getByText('$')).toBeInTheDocument()
    expect(await within(filaDe(1)).findByText('17,60 €')).toBeInTheDocument()
    await elegirProveedor(1, 'ACME')
    expect(within(filaDe(1)).getByText('€')).toBeInTheDocument()
    expect(within(filaDe(1)).getByText('20,00 €')).toBeInTheDocument()
    expect(tasasPedidas).toEqual(['USD'])
  })

  it('mientras llega la tasa el Total EUR es "—" (P7)', async () => {
    server.use(http.get('*/api/tipo-cambio/:divisa', async () => { await delay('infinite'); return HttpResponse.json({ value: 1.1367 }) }))
    abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await elegirProveedor(1, 'Proveedor B')
    expect(within(filaDe(1)).getByText('—')).toBeInTheDocument()
  })

  it('si la tasa falla, el Total EUR se queda en "—" (nunca calcula como si fuera EUR)', async () => {
    let pedidas = 0
    server.use(http.get('*/api/tipo-cambio/:divisa', () => {
      pedidas += 1
      return HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 })
    }))
    abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await elegirProveedor(1, 'Proveedor B')
    await waitFor(() => expect(pedidas).toBe(1))
    expect(within(filaDe(1)).getByText('—')).toBeInTheDocument()
    expect(within(filaDe(1)).queryByText('0,00 €')).not.toBeInTheDocument()
  })

  it('"Pedir piezas" → un lote con clave y el cuerpo exacto (solo las solicitudes que siguen teniendo línea); cierra', async () => {
    const onCerrar = abrir({ modo: 'solicitudes', urgentes: [urgente(10, 2), urgente(11, 1)], preventivas: [preventiva(20, 2)] })
    await screen.findByRole('combobox', { name: 'Componente línea 2' })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 2' }))
    expect(screen.queryByRole('combobox', { name: 'Componente línea 2' })).not.toBeInTheDocument()
    await elegirProveedor(1, 'ACME')
    await escribir('Precio línea 1', '12,5')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Urgente línea 1' }))
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(lotes).toHaveLength(1)
    expect(lotes[0].clave).toMatch(/^[0-9a-f-]{36}$/)
    expect(lotes[0].cuerpo).toEqual({
      lineas: [{ idCom: 2, idProv: 1, cantidad: 2, esUrgente: true, precioUnidad: 12.5 }],
      solicitudes: { urgentes: [10], preventivas: [20] },
    })
  })

  it('"Pedir piezas" con solicitudes de un slave (bat-y, id 5): su id viaja en el lote junto a la línea de su master', async () => {
    abrir({ modo: 'solicitudes', urgentes: [urgente(10, 5), urgente(11, 1)], preventivas: [preventiva(20, 5)] })
    await screen.findByRole('combobox', { name: 'Componente línea 2' })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 2' }))
    await elegirProveedor(1, 'ACME')
    await confirmar()
    await waitFor(() => expect(lotes).toHaveLength(1))
    expect(lotes[0].cuerpo).toMatchObject({
      lineas: [{ idCom: 2, cantidad: 2 }],
      solicitudes: { urgentes: [10], preventivas: [20] },
    })
  })

  it('422: su mensaje en la línea de error con el formulario abierto; el reintento usa la MISMA clave', async () => {
    respuestaLote = () => HttpResponse.json({ message: 'Línea 1: el proveedor está desactivado.' }, { status: 422 })
    const onCerrar = abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await elegirProveedor(1, 'ACME')
    await confirmar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Línea 1: el proveedor está desactivado.')
    expect(screen.getByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
    respuestaLote = () => HttpResponse.json({ idsCreados: [101] })
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(lotes).toHaveLength(2)
    expect(lotes[1].clave).toBeTruthy()
    expect(lotes[1].clave).toBe(lotes[0].clave)
  })

  it('otro error (403): "Error al guardar: …" en la línea de error, formulario abierto', async () => {
    respuestaLote = () => new HttpResponse(null, { status: 403 })
    const onCerrar = abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await elegirProveedor(1, 'ACME')
    await confirmar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al guardar: No tienes permisos para realizar esta acción.')
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('503 del tipo de cambio al guardar: el mensaje del servidor inline, sin aviso global y con el formulario abierto', async () => {
    respuestaLote = () => HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 })
    const onCerrar = abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await elegirProveedor(1, 'ACME')
    await confirmar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.')
    expect(screen.queryByText('Sin conexión con el servidor: HTTP 503')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad línea 1')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('500 sin mensaje al guardar: aviso global de conexión, sin línea de error y con el formulario abierto', async () => {
    respuestaLote = () => new HttpResponse(null, { status: 500 })
    const onCerrar = abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await elegirProveedor(1, 'ACME')
    await confirmar()
    expect(await screen.findByText('Sin conexión con el servidor: HTTP 500')).toBeInTheDocument()
    expect(screen.queryByText(/^Error al guardar/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad línea 1')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('"Cancelar" cierra sin preguntar aunque haya líneas (calco) y no envía nada', async () => {
    const onCerrar = abrir({ modo: 'componentes', idsCom: [1, 2] })
    await screen.findByRole('combobox', { name: 'Componente línea 2' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(lotes).toHaveLength(0)
  })

  it('enfocar cualquier campo selecciona su fila (navy); la papelera quita la línea sin confirmar', async () => {
    abrir({ modo: 'componentes', idsCom: [1, 2] })
    await screen.findByRole('combobox', { name: 'Componente línea 2' })
    await userEvent.click(screen.getByRole('textbox', { name: 'Cantidad línea 2' }))
    expect(filaDe(2)).toHaveAttribute('data-state', 'selected')
    expect(filaDe(2)).toHaveClass('data-[state=selected]:bg-azul-medio', 'data-[state=selected]:text-crema')
    expect(filaDe(1)).not.toHaveAttribute('data-state')
    await userEvent.click(screen.getByRole('combobox', { name: 'Componente línea 1' }))
    expect(filaDe(1)).toHaveAttribute('data-state', 'selected')
    const papelera = screen.getByRole('button', { name: 'Quitar línea 1' })
    expect(papelera.querySelector('img')).toHaveAttribute('src', '/borrar.png')
    await userEvent.click(papelera)
    expect(screen.getByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x / bat-y')
    expect(screen.queryByRole('combobox', { name: 'Componente línea 2' })).not.toBeInTheDocument()
  })
})

describe('pedido automático (spec 0.9.6 §4.4)', () => {
  // lcd-x-negro (1) marcada y pide 16; bat-x (2) marcada sin pedido; el resto sin marcar.
  const CON_PREVISION: Componente[] = COMPONENTES.map((c) =>
    c.idCom === 1 ? { ...c, autoPedido: true, pedir60: 16 } : c.idCom === 2 ? { ...c, autoPedido: true, pedir60: 0 } : c)

  beforeEach(() => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(CON_PREVISION)))
  })

  async function elegirProveedorGeneral(nombre: string) {
    await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor general' }))
    await userEvent.click(await within(screen.getByRole('listbox', { name: 'Proveedor general' })).findByRole('button', { name: nombre }))
  }

  it('sin proveedor general «Añadir previsión» funciona y deja las líneas sin proveedor; «Aplicar a todas» espera al proveedor', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16')
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' })).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Aplicar a todas' })).toBeDisabled()
    await elegirProveedorGeneral('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar a todas' }))
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' })).toHaveTextContent('ACME')
  })

  it('«Añadir previsión» mete la marcada con su cantidad y el proveedor general, avisa de la que no necesita pedido y se confirma', async () => {
    abrir()
    await screen.findByRole('button', { name: 'Añadir previsión (1)' })
    await elegirProveedorGeneral('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16')
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' })).toHaveTextContent('ACME')
    expect(screen.getByRole('status')).toHaveTextContent('1 pieza marcada no necesita pedido.')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.queryByLabelText('Cantidad línea 2')).not.toBeInTheDocument()
    await confirmar()
    await waitFor(() => expect(lotes).toHaveLength(1))
  })

  it('con la pieza ya en el pedido sube la cantidad y no la duplica', async () => {
    abrir({ modo: 'componentes', idsCom: [1] })
    await waitFor(() => expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('1'))
    await elegirProveedorGeneral('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16')
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' })).toHaveTextContent('ACME')
    expect(screen.queryByLabelText('Cantidad línea 2')).not.toBeInTheDocument()
  })

  it('«Aplicar a todas» cambia también el proveedor que ya tenía una línea', async () => {
    abrir({ modo: 'componentes', idsCom: [1] })
    await waitFor(() => expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('1'))
    await elegirProveedor(1, 'Proveedor B')
    await elegirProveedorGeneral('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar a todas' }))
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' })).toHaveTextContent('ACME')
  })

  it('el aviso de piezas sin pedido se borra al editar las líneas', async () => {
    abrir()
    await screen.findByRole('button', { name: 'Añadir previsión (1)' })
    await elegirProveedorGeneral('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.getByRole('status')).toHaveTextContent('1 pieza marcada no necesita pedido.')
    await escribir('Cantidad línea 1', '5')
    expect(screen.queryByText('1 pieza marcada no necesita pedido.')).not.toBeInTheDocument()
  })
})
