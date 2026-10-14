import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { crearQueryClient } from '@/shared/api/queryClient'
import { avisaAlSalir } from '@/test/avisoAlSalir'
import { renderConRouter, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { CLAVE_PROVEEDORES } from '../../proveedores/api'
import { CLAVE_COMPONENTES_GESTIONADOS } from '../../stock/api'
import { COMPONENTES, PROVEEDORES, preventiva, urgente } from './datosPrueba'
import { NuevoPedidoDialog } from './NuevoPedidoDialog'

/** 0.9.9 (varios proveedores): lcd-x-negro, bat-x y su slave bat-y solo los vende ACME, así que lo precargado va solo a su
 *  recuadro. «Por repartir» tiene sus tests al final. */
const DE_ACME: Componente[] = COMPONENTES.map((c) => (c.idCom === 4 ? c : { ...c, proveedores: [1] }))

let lotes: { cuerpo: unknown; clave: string | null }[]
let respuestaLote: () => Response
let tasasPedidas: string[]

beforeEach(() => {
  lotes = []
  tasasPedidas = []
  respuestaLote = () => HttpResponse.json({ idsCreados: [101] })
  server.use(
    http.get('*/api/componentes/gestionados', () => HttpResponse.json(DE_ACME)),
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
 *  dejarían de verlo. Con un solo recuadro, la etiqueta es única. */
const filaDe = (n: number) => screen.getByLabelText(`Cantidad línea ${n}`).closest('tr') as HTMLElement
const confirmar = () => userEvent.click(screen.getByRole('button', { name: /^Confirmar pedido/ }))
/** Un recuadro del pedido (0.9.9): el de un proveedor o «Por repartir». */
const recuadro = (nombre: string) => screen.getByRole('region', { name: nombre === 'Por repartir' ? nombre : `Pedido a ${nombre}` })

async function elegirComponente(n: number, texto: string, opcion: string, donde?: HTMLElement) {
  await userEvent.type(within(donde ?? document.body).getByRole('combobox', { name: `Componente línea ${n}` }), texto)
  await userEvent.click(await screen.findByRole('option', { name: opcion }))
}

/** ComboNavy: disparador role="combobox" con aria-label; lista role="listbox"; cada opción, un <button> dentro de un
 *  <li role="option">. «Proveedor» (al abrir vacío) y «Otro proveedor» enseñan «{nombre} · {bloque abierto}». */
async function elegirEnCombo(combo: string, opcion: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: combo }))
  await userEvent.click(await within(screen.getByRole('listbox', { name: combo })).findByRole('button', { name: opcion }))
}
const elegirProveedor = (nombre: string) => elegirEnCombo('Proveedor', new RegExp(`^${nombre} · `))
const otroProveedor = (nombre: string) => elegirEnCombo('Otro proveedor', new RegExp(`^${nombre} · `))

async function escribir(etiqueta: string, valor: string, donde?: HTMLElement) {
  const campo = within(donde ?? document.body).getByRole('textbox', { name: etiqueta })
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
    await elegirProveedor('ACME')
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
    await elegirProveedor('ACME')
    expect(avisaAlSalir()).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(avisaAlSalir()).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 1' }))
    expect(avisaAlSalir()).toBe(false)
  })

  it('vacío: título de 24 px y un primer recuadro con el proveedor por elegir; «+ Otro proveedor» en el pie, deshabilitado hasta elegirlo', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Nuevo pedido' }))
    expect(dlg.getByRole('heading', { name: 'Nuevo pedido' })).toHaveClass('text-2xl', 'font-bold', 'text-azul-medio')
    expect(screen.getByRole('dialog')).toHaveClass('w-[880px]', 'bg-fondo-vista', 'p-7')
    const primero = within(dlg.getByRole('region', { name: 'Pedido sin proveedor' }))
    expect(primero.getByText('Elige el proveedor para añadir líneas.')).toBeInTheDocument()
    expect(primero.getByRole('button', { name: 'Añadir previsión' })).toBeDisabled()
    expect(dlg.queryByText(/Luego puedes pedir/)).not.toBeInTheDocument()
    expect(dlg.getByRole('combobox', { name: 'Otro proveedor' })).toBeDisabled()
    // La ✕ de DialogContent ("Close", sr-only) va la última.
    expect(dlg.getAllByRole('button').map((b) => b.textContent)).toEqual(['Añadir previsión', 'Cancelar', 'Confirmar pedido', 'Close'])
    await userEvent.click(primero.getByRole('combobox', { name: 'Proveedor' }))
    const lista = screen.getByRole('listbox', { name: 'Proveedor' })
    await within(lista).findByRole('button', { name: /^ACME/ })
    expect(within(lista).getAllByRole('button').map((b) => b.textContent)).toEqual(['ACME · sin bloque abierto', 'Proveedor B · sin bloque abierto'])
    await userEvent.click(within(lista).getByRole('button', { name: /^ACME/ }))
    const acme = within(recuadro('ACME'))
    expect(acme.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Componente', 'Cant.', 'P.Unit.', 'Urg.', 'Total EUR', ''])
    expect(acme.getByText('Añade líneas o «Añadir previsión».')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pedido sin proveedor' })).not.toBeInTheDocument()
    expect(dlg.getByRole('combobox', { name: 'Otro proveedor' })).toBeEnabled()
  })

  it('sin líneas: "Añade al menos una línea." y no envía nada', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Añade al menos una línea.')
    expect(screen.getByRole('alert')).toHaveClass('text-[11px]', 'text-texto-error')
    expect(lotes).toHaveLength(0)
  })

  it('"Pedir" (un componente): va al recuadro de ACME, el único que la vende, con cantidad 1, precio 0,00 y sin urgente; "+ Añadir línea" añade una vacía en ese recuadro y la selecciona', async () => {
    abrir({ modo: 'componentes', idsCom: [2] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x / bat-y')
    expect(within(recuadro('ACME')).getByRole('combobox', { name: 'Componente línea 1' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Por repartir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Proveedor línea 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 1' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Precio línea 1' })).toHaveValue('0,00')
    expect(screen.getByRole('checkbox', { name: 'Urgente línea 1' })).not.toBeChecked()
    expect(within(filaDe(1)).getByText('0,00 €')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 2' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Precio línea 2' })).toHaveValue('0,00')
    expect(screen.getByRole('checkbox', { name: 'Urgente línea 2' })).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x / bat-y')
    expect(filaDe(2)).toHaveAttribute('data-state', 'selected')
    expect(filaDe(1)).not.toHaveAttribute('data-state')
  })

  it('"Pedir" con un componente precargado: no autoenfoca el campo Componente (C25, se pisaría la precarga al teclear)', async () => {
    // Cachés de componentes y proveedores ya calientes: la línea precargada existe desde el primer render del diálogo, que es
    // cuando Radix decide a qué enfocar al abrirse.
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(CLAVE_COMPONENTES_GESTIONADOS, DE_ACME)
    qc.setQueryData(CLAVE_PROVEEDORES, PROVEEDORES)
    const onCerrar = vi.fn()
    renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={{ modo: 'componentes', idsCom: [2] }} onCerrar={onCerrar} /> }], { sesion: SESION_SUPER, queryClient: qc })
    const campo = await screen.findByRole('combobox', { name: 'Componente línea 1' })
    expect(campo).toHaveValue('bat-x / bat-y')
    expect(document.activeElement).not.toBe(campo)
  })

  it('"Pedir" con la caché de proveedores fría (Stock no la carga): tampoco se enfoca «Cancelar» (C25)', async () => {
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(CLAVE_COMPONENTES_GESTIONADOS, DE_ACME)
    renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={{ modo: 'componentes', idsCom: [2] }} onCerrar={vi.fn()} /> }], { sesion: SESION_SUPER, queryClient: qc })
    const campo = await screen.findByRole('combobox', { name: 'Componente línea 1' })
    expect(document.activeElement).not.toBe(campo)
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Cancelar' }))
  })

  it('componente desactivado o desconocido: la línea va vacía (calco), con su placeholder, a «Por repartir»', async () => {
    abrir({ modo: 'componentes', idsCom: [4, 99] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('')
    const primera = screen.getByRole('combobox', { name: 'Componente línea 1' })
    expect(primera).toHaveValue('')
    expect(primera).toHaveAttribute('placeholder', 'Escribe componente...')
    expect(within(recuadro('Por repartir')).getByRole('combobox', { name: 'Componente línea 1' })).toBe(primera)
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
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
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

  it('con muchas líneas: la caja de los recuadros tiene alto máximo con scroll propio y los botones siguen visibles (C24)', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    const boton = screen.getByRole('button', { name: '+ Añadir línea' })
    for (let i = 0; i < 8; i += 1) await userEvent.click(boton)
    expect(recuadro('ACME').parentElement).toHaveClass('max-h-[520px]', 'overflow-y-auto')
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeInTheDocument()
  })

  it('validación con el proveedor delante, en orden y parando en el primer fallo; marca el recuadro y cambiar una línea lo borra', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('ACME · Línea 1: selecciona un componente.')
    expect(recuadro('ACME')).toHaveAttribute('data-marcado', 'true')
    await elegirComponente(1, 'bat', 'bat-x / bat-y')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(recuadro('ACME')).not.toHaveAttribute('data-marcado')
    await escribir('Cantidad línea 1', '0')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('ACME · Línea 1: la cantidad debe ser mayor que 0.')
    await escribir('Cantidad línea 1', '2')
    await escribir('Precio línea 1', '-1')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('ACME · Línea 1: el precio no puede ser negativo.')
    expect(lotes).toHaveLength(0)
  })

  it('proveedor en USD: símbolo $ y Total EUR = precio / tasa × cantidad; en el recuadro en EUR, € sin pedir tasa', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('Proveedor B')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'bat', 'bat-x / bat-y')
    await escribir('Precio línea 1', '10')
    await escribir('Cantidad línea 1', '2')
    expect(within(filaDe(1)).getByText('$')).toBeInTheDocument()
    expect(await within(filaDe(1)).findByText('17,60 €')).toBeInTheDocument()
    await otroProveedor('ACME')
    const acme = recuadro('ACME')
    await userEvent.click(within(acme).getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'lcd', 'lcd-x-negro', acme)
    await escribir('Precio línea 1', '10', acme)
    await escribir('Cantidad línea 1', '2', acme)
    const filaAcme = within(acme).getByLabelText('Cantidad línea 1').closest('tr') as HTMLElement
    expect(within(filaAcme).getByText('€')).toBeInTheDocument()
    expect(within(filaAcme).getByText('20,00 €')).toBeInTheDocument()
    expect(tasasPedidas).toEqual(['USD'])
  })

  it('mientras llega la tasa el Total EUR es "—" (P7)', async () => {
    server.use(http.get('*/api/tipo-cambio/:divisa', async () => { await delay('infinite'); return HttpResponse.json({ value: 1.1367 }) }))
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('Proveedor B')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'bat', 'bat-x / bat-y')
    expect(within(filaDe(1)).getByText('—')).toBeInTheDocument()
  })

  it('si la tasa falla, el Total EUR se queda en "—" (nunca calcula como si fuera EUR)', async () => {
    let pedidas = 0
    server.use(http.get('*/api/tipo-cambio/:divisa', () => {
      pedidas += 1
      return HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 })
    }))
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('Proveedor B')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'bat', 'bat-x / bat-y')
    await waitFor(() => expect(pedidas).toBe(1))
    expect(within(filaDe(1)).getByText('—')).toBeInTheDocument()
    expect(within(filaDe(1)).queryByText('0,00 €')).not.toBeInTheDocument()
  })

  it('"Pedir piezas" → un lote con clave y el cuerpo exacto (solo las solicitudes que siguen teniendo línea); cierra', async () => {
    const onCerrar = abrir({ modo: 'solicitudes', urgentes: [urgente(10, 2), urgente(11, 1)], preventivas: [preventiva(20, 2)] })
    await screen.findByRole('combobox', { name: 'Componente línea 2' })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 2' }))
    expect(screen.queryByRole('combobox', { name: 'Componente línea 2' })).not.toBeInTheDocument()
    await escribir('Precio línea 1', '12,5')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Urgente línea 1' }))
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(lotes).toHaveLength(1)
    expect(lotes[0].clave).toMatch(/^[0-9a-f-]{36}$/)
    expect(lotes[0].cuerpo).toEqual({
      lineas: [{ idCom: 2, idProv: 1, cantidad: 2, esUrgente: true, precioUnidad: 12.5 }],
      solicitudes: { urgentes: [10], preventivas: [20] },
      destinos: null,
      otros: [],
    })
  })

  it('"Pedir piezas" con solicitudes de un slave (bat-y, id 5): su id viaja en el lote junto a la línea de su master', async () => {
    abrir({ modo: 'solicitudes', urgentes: [urgente(10, 5), urgente(11, 1)], preventivas: [preventiva(20, 5)] })
    await screen.findByRole('combobox', { name: 'Componente línea 2' })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 2' }))
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
    await confirmar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al guardar: No tienes permisos para realizar esta acción.')
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('503 del tipo de cambio al guardar: el mensaje del servidor inline, sin aviso global y con el formulario abierto', async () => {
    respuestaLote = () => HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 })
    const onCerrar = abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
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

describe('pedido automático por proveedor (spec 0.9.6 §4.4 y 2026-10-11 §5.2)', () => {
  // lcd-x-negro (1) marcada, de ACME, pide 16; bat-x (2) marcada, de ACME, sin pedido; flex-x (6) marcada, pide 3 y no
  // está en ninguna lista.
  const CON_PREVISION: Componente[] = [
    ...COMPONENTES.map((c) =>
      c.idCom === 1 ? { ...c, autoPedido: true, pedir60: 16, proveedores: [1] }
        : c.idCom === 2 ? { ...c, autoPedido: true, pedir60: 0, proveedores: [1] } : { ...c, proveedores: [] }),
    { ...COMPONENTES[0], idCom: 6, tipo: 'flex-x', autoPedido: true, pedir60: 3, proveedores: [] },
  ]

  beforeEach(() => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(CON_PREVISION)))
  })

  it('cada recuadro lleva su «Añadir previsión (n)»; sin nada que pedir, deshabilitado', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('Proveedor B')
    expect(await within(recuadro('Proveedor B')).findByRole('button', { name: 'Añadir previsión (0)' })).toBeDisabled()
    await otroProveedor('ACME')
    expect(await within(recuadro('ACME')).findByRole('button', { name: 'Añadir previsión (1)' })).toBeEnabled()
  })

  it('«Añadir previsión (1)» de ACME mete la suya con su cantidad, y avisa de la que no necesita pedido y de la que no tiene lista', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(await within(recuadro('ACME')).findByRole('button', { name: 'Añadir previsión (1)' }))
    expect(within(recuadro('ACME')).getByLabelText('Cantidad línea 1')).toHaveValue('16')
    expect(screen.queryByLabelText('Cantidad línea 2')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 pieza marcada no necesita pedido.')
    expect(screen.getByRole('status')).toHaveTextContent('1 pieza en Auto con algo que pedir no está en la lista de ningún proveedor.')
    await confirmar()
    await waitFor(() => expect(lotes).toHaveLength(1))
  })

  it('con la pieza ya en el pedido sube la cantidad y no la duplica', async () => {
    abrir({ modo: 'componentes', idsCom: [1] })
    // 2026-10-13: «Pedir» ya entra con su «Pedir 60 d»; se baja a mano para ver que la previsión la vuelve a subir.
    await waitFor(() => expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16'))
    await escribir('Cantidad línea 1', '2')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16')
    expect(screen.queryByLabelText('Cantidad línea 2')).not.toBeInTheDocument()
  })

  it('elegir una pieza con previsión en una línea pone su «Pedir 60 d» (2026-10-13)', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'lcd', 'lcd-x-negro')
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16')
  })

  it('una pieza que ya está en el recuadro no se repite: queda seleccionada, y a la vista, la que estaba y sale el aviso', async () => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView')
    onTestFinished(() => desplazar.mockRestore())
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir previsión (1)' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(2, 'lcd', 'lcd-x-negro')
    expect(screen.queryByLabelText('Cantidad línea 2')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16')
    expect(filaDe(1)).toHaveAttribute('data-state', 'selected')
    expect(desplazar.mock.contexts).toContain(filaDe(1))
    expect(screen.getByRole('status')).toHaveTextContent('lcd-x-negro ya está en el pedido a ACME (línea 1).')
  })

  it('el aviso de pieza repetida se borra con «Añadir previsión» y al añadir otro proveedor', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir previsión (1)' }))
    async function repetirLaPieza() {
      await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
      await elegirComponente(2, 'lcd', 'lcd-x-negro')
      expect(screen.getByRole('status')).toHaveTextContent('lcd-x-negro ya está en el pedido a ACME (línea 1).')
    }
    await repetirLaPieza()
    await userEvent.click(screen.getByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.queryByText(/ya está en el pedido/)).not.toBeInTheDocument()
    await repetirLaPieza()
    await otroProveedor('Proveedor B')
    expect(screen.queryByText(/ya está en el pedido/)).not.toBeInTheDocument()
  })

  it('«Añadir previsión…» de un bloque abre con la previsión de su proveedor ya puesta', async () => {
    abrir({ modo: 'bloque', idBloque: 41, idProv: 1, prevision: true })
    await waitFor(() => expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16'))
    expect(screen.getByRole('dialog', { name: 'Añadir líneas · Bloque 41' })).toBeInTheDocument()
  })

  it('si el proveedor del bloque no tiene nada que pedir, no añade líneas y lo dice', async () => {
    abrir({ modo: 'bloque', idBloque: 41, idProv: 2, prevision: true })
    expect(await screen.findByRole('status')).toHaveTextContent('Nada que pedir a Proveedor B según la previsión.')
    expect(screen.queryByLabelText('Cantidad línea 1')).not.toBeInTheDocument()
  })

  it('«Añadir previsión…» de un bloque con la caché de Stock vieja espera a la lista fresca y no aplica números viejos', async () => {
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(CLAVE_COMPONENTES_GESTIONADOS, CON_PREVISION)
    server.use(http.get('*/api/componentes/gestionados', async () => {
      await delay(50)
      return HttpResponse.json(CON_PREVISION.map((c) => (c.idCom === 1 ? { ...c, pedir60: 0 } : c)))
    }))
    renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={{ modo: 'bloque', idBloque: 41, idProv: 1, prevision: true }} onCerrar={vi.fn()} /> }], { sesion: SESION_SUPER, queryClient: qc })
    expect(await screen.findByRole('status')).toHaveTextContent('Nada que pedir a ACME según la previsión.')
    expect(screen.queryByLabelText('Cantidad línea 1')).not.toBeInTheDocument()
  })

  it('«Pedir» con la caché de Stock vieja entra con 1 y pone el «Pedir 60 d» de la lista fresca, nunca el viejo (2026-10-13)', async () => {
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(CLAVE_COMPONENTES_GESTIONADOS, CON_PREVISION.map((c) => (c.idCom === 1 ? { ...c, pedir60: 5 } : c)))
    server.use(http.get('*/api/componentes/gestionados', async () => {
      await delay(50)
      return HttpResponse.json(CON_PREVISION)
    }))
    renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={{ modo: 'componentes', idsCom: [1] }} onCerrar={vi.fn()} /> }], { sesion: SESION_SUPER, queryClient: qc })
    // C25: con la caché caliente la línea sale ya, pero sin la previsión de la caché.
    expect(await screen.findByLabelText('Cantidad línea 1')).not.toHaveValue('5')
    await waitFor(() => expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('16'))
  })

  it('«Añadir previsión…» de un bloque con la lista en 500 no añade líneas ni avisos de previsión', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json({ message: 'boom' }, { status: 500 })))
    abrir({ modo: 'bloque', idBloque: 41, idProv: 1, prevision: true })
    await screen.findByRole('dialog', { name: 'Añadir líneas · Bloque 41' })
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByLabelText('Cantidad línea 1')).not.toBeInTheDocument()
    expect(screen.queryByText(/según la previsión|no necesita pedido|no está en la lista/)).not.toBeInTheDocument()
  })

  it('el aviso de piezas sin pedido se borra al editar las líneas', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir previsión (1)' }))
    expect(screen.getByRole('status')).toHaveTextContent('1 pieza marcada no necesita pedido.')
    await escribir('Cantidad línea 1', '5')
    expect(screen.queryByText('1 pieza marcada no necesita pedido.')).not.toBeInTheDocument()
  })
})

describe('varios proveedores en un mismo pedido (0.9.9, spec 2026-10-13)', () => {
  it('un recuadro por proveedor, en el orden en que se añaden: «Confirmar pedido (2 bloques)» manda las líneas de los dos', async () => {
    const onCerrar = abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('Proveedor B')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'bat', 'bat-x / bat-y')
    await otroProveedor('ACME')
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Pedido a Proveedor B', 'Pedido a ACME'])
    const acme = recuadro('ACME')
    await userEvent.click(within(acme).getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'lcd', 'lcd-x-negro', acme)
    expect(screen.getByRole('button', { name: 'Confirmar pedido (2 bloques)' })).toBeInTheDocument()
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(lotes[0].cuerpo).toEqual({
      lineas: [
        { idCom: 2, idProv: 2, cantidad: 1, esUrgente: false, precioUnidad: 0 },
        { idCom: 1, idProv: 1, cantidad: 1, esUrgente: false, precioUnidad: 0 },
      ],
      solicitudes: { urgentes: [], preventivas: [] },
      destinos: null,
      otros: [],
    })
  })

  it('lo que falta: con 3 en ACME, en Proveedor B la misma pieza sale con 7 − 3 = 4, y cada recuadro avisa del otro', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(DE_ACME.map((c) => (c.idCom === 1 ? { ...c, pedir60: 7, proveedores: [1, 2] } : c)))))
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'lcd', 'lcd-x-negro')
    expect(screen.getByLabelText('Cantidad línea 1')).toHaveValue('7')
    await escribir('Cantidad línea 1', '3')
    await otroProveedor('Proveedor B')
    const b = recuadro('Proveedor B')
    await userEvent.click(within(b).getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'lcd', 'lcd-x-negro', b)
    expect(within(b).getByLabelText('Cantidad línea 1')).toHaveValue('4')
    expect(recuadro('ACME')).toHaveTextContent('lcd-x-negro también va a Proveedor B (4).')
    expect(b).toHaveTextContent('lcd-x-negro también va a ACME (3).')
  })

  it('«Por repartir»: lo precargado que venden varios (o ninguno) espera ahí; «Pasar a…» con «Lo vende» primero', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(DE_ACME.map((c) => (c.idCom === 1 ? { ...c, proveedores: [1, 2] } : c.idCom === 2 || c.idCom === 5 ? { ...c, proveedores: [] } : c)))))
    abrir({ modo: 'componentes', idsCom: [1, 2] })
    const repartir = await screen.findByRole('region', { name: 'Por repartir' })
    expect(repartir).toHaveTextContent('⚠ Por repartir')
    expect(repartir).toHaveTextContent('2 líneas')
    await userEvent.click(within(repartir).getByRole('combobox', { name: 'Pasar a línea 1' }))
    const lista = screen.getByRole('listbox', { name: 'Pasar a línea 1' })
    expect(lista).toHaveTextContent(/Lo vende.*ACME.*Proveedor B/)
    expect(within(lista).queryByText('Otros proveedores')).not.toBeInTheDocument()
    await userEvent.click(within(lista).getByRole('button', { name: 'Proveedor B' }))
    expect(within(recuadro('Proveedor B')).getByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('lcd-x-negro')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Queda 1 línea por repartir: elige a quién se la pides.')
    expect(recuadro('Por repartir')).toHaveAttribute('data-marcado', 'true')
    await userEvent.click(within(recuadro('Por repartir')).getByRole('combobox', { name: 'Pasar a línea 1' }))
    const otra = screen.getByRole('listbox', { name: 'Pasar a línea 1' })
    expect(within(otra).getByText('Otros proveedores')).toBeInTheDocument()
    expect(within(otra).queryByText('Lo vende')).not.toBeInTheDocument()
    await userEvent.click(within(otra).getByRole('button', { name: 'ACME' }))
    expect(screen.queryByRole('region', { name: 'Por repartir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido (2 bloques)' })).toBeInTheDocument()
  })

  it('la × quita el recuadro: sin líneas, sin preguntar; con líneas, pregunta antes', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ACME' }))
    expect(screen.queryByRole('region', { name: 'Pedido a ACME' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pedido sin proveedor' })).toBeInTheDocument()
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ACME' }))
    const pregunta = await screen.findByRole('dialog', { name: 'Quitar proveedor' })
    expect(pregunta).toHaveTextContent('¿Quitar ACME y su línea?')
    await userEvent.click(within(pregunta).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pedido a ACME' })).not.toBeInTheDocument())
  })

  it('plegar esconde las líneas; el error de «Confirmar» despliega el recuadro, lo marca y lo trae a la vista', async () => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView')
    onTestFinished(() => desplazar.mockRestore())
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await userEvent.click(screen.getByRole('button', { name: 'Plegar ACME' }))
    expect(screen.queryByLabelText('Cantidad línea 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desplegar ACME' })).toHaveAttribute('aria-expanded', 'false')
    desplazar.mockClear()
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('ACME · Línea 1: selecciona un componente.')
    expect(screen.getByLabelText('Cantidad línea 1')).toBeInTheDocument()
    expect(recuadro('ACME')).toHaveAttribute('data-marcado', 'true')
    expect(desplazar.mock.contexts).toContain(recuadro('ACME'))
  })

  it('«+ Otro proveedor» del pie: el recuadro nuevo sale al final y se trae a la vista', async () => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView')
    onTestFinished(() => desplazar.mockRestore())
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('Proveedor B')
    await otroProveedor('ACME')
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Pedido a Proveedor B', 'Pedido a ACME'])
    expect(desplazar.mock.contexts).toContain(recuadro('ACME'))
  })

  it('«+ Otro proveedor» se deshabilita cuando todos los proveedores activos tienen su recuadro', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await otroProveedor('Proveedor B')
    expect(screen.getByRole('combobox', { name: 'Otro proveedor' })).toBeDisabled()
  })

  it('«+ Otro proveedor» va en el pie, en la fila de «Cancelar», y no dentro de ningún recuadro', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    const combo = screen.getByRole('combobox', { name: 'Otro proveedor' })
    for (const r of screen.getAllByRole('region')) expect(r).not.toContainElement(combo)
    // Pie de DialogoPedidoBase: fila > [combo, div ml-auto > [Cancelar, Confirmar]].
    expect(screen.getByRole('button', { name: 'Cancelar' }).parentElement?.parentElement).toContainElement(combo)
  })

  it('el recuadro añadido se trae a la vista una sola vez: pinchar en otra fila no lo vuelve a traer', async () => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView')
    onTestFinished(() => desplazar.mockRestore())
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await elegirProveedor('ACME')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    await otroProveedor('Proveedor B')
    expect(desplazar.mock.contexts).toContain(recuadro('Proveedor B'))
    desplazar.mockClear()
    await userEvent.click(within(recuadro('ACME')).getByRole('textbox', { name: 'Cantidad línea 1' }))
    expect(desplazar.mock.contexts).not.toContain(recuadro('Proveedor B'))
  })

  it('un recuadro de la precarga se queda aunque se quite su última línea; solo la × lo quita', async () => {
    abrir({ modo: 'componentes', idsCom: [2] })
    await screen.findByRole('combobox', { name: 'Componente línea 1' })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar línea 1' }))
    expect(recuadro('ACME')).toBeInTheDocument()
    expect(within(recuadro('ACME')).getByText('Añade líneas o «Añadir previsión».')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ACME' }))
    expect(screen.getByRole('region', { name: 'Pedido sin proveedor' })).toBeInTheDocument()
  })

  it('«Pasar a…» a un proveedor que ya tenía la pieza: se queda la línea que había y lo dice', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(DE_ACME.map((c) => (c.idCom === 1 ? { ...c, proveedores: [1, 2] } : c)))))
    abrir({ modo: 'componentes', idsCom: [1] })
    await screen.findByRole('region', { name: 'Por repartir' })
    await userEvent.click(screen.getByRole('combobox', { name: 'Otro proveedor' }))
    await userEvent.click(await within(screen.getByRole('listbox', { name: 'Otro proveedor' })).findByRole('button', { name: /^ACME · / }))
    const acme = recuadro('ACME')
    await userEvent.click(within(acme).getByRole('button', { name: '+ Añadir línea' }))
    await elegirComponente(1, 'lcd', 'lcd-x-negro', acme)
    await userEvent.click(within(recuadro('Por repartir')).getByRole('combobox', { name: 'Pasar a línea 1' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Pasar a línea 1' })).getByRole('button', { name: 'ACME' }))
    expect(screen.queryByRole('region', { name: 'Por repartir' })).not.toBeInTheDocument()
    expect(within(recuadro('ACME')).queryByLabelText('Cantidad línea 2')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('lcd-x-negro ya estaba en ACME: se queda la línea que había.')
  })
})
