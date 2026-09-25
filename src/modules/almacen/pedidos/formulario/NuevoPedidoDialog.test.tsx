import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
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
  renderConProviders(<NuevoPedidoDialog precarga={precarga} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
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
  it('vacío: título de 24 px, siete columnas, placeholder y los tres botones', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Nuevo pedido' }))
    expect(dlg.getByRole('heading', { name: 'Nuevo pedido' })).toHaveClass('text-2xl', 'font-bold', 'text-azul-medio')
    expect(screen.getByRole('dialog')).toHaveClass('w-[700px]', 'bg-fondo-vista', 'p-7')
    expect(dlg.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Componente', 'Proveedor', 'Cant.', 'P.Unit.', 'Urg.', 'Total EUR', ''])
    expect(dlg.getByText('Añade al menos una línea')).toBeInTheDocument()
    // La ✕ de DialogContent ("Close", sr-only) va la última.
    expect(dlg.getAllByRole('button').map((b) => b.textContent)).toEqual(['+ Añadir línea', 'Cancelar', 'Confirmar pedido', 'Close'])
  })

  it('sin líneas: "Añade al menos una línea." y no envía nada', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Añade al menos una línea.')
    expect(screen.getByRole('alert')).toHaveClass('text-[11px]', 'text-texto-error')
    expect(lotes).toHaveLength(0)
  })

  it('"Pedir" (un componente): una línea con él, cantidad 1, precio 0,00, sin proveedor ni urgente; "+ Añadir línea" lo repite y selecciona la nueva', async () => {
    abrir({ modo: 'componentes', idsCom: [2] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x')
    expect(screen.getByRole('combobox', { name: 'Proveedor línea 1' }).textContent).toBe('')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 1' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Precio línea 1' })).toHaveValue('0,00')
    expect(screen.getByRole('checkbox', { name: 'Urgente línea 1' })).not.toBeChecked()
    expect(within(filaDe(1)).getByText('0,00 €')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('bat-x')
    expect(filaDe(2)).toHaveAttribute('data-state', 'selected')
    expect(filaDe(1)).not.toHaveAttribute('data-state')
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
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('bat-x')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 2' })).toHaveValue('1')
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(screen.getByRole('combobox', { name: 'Componente línea 3' })).toHaveValue('')
  })

  it('"Pedir piezas": agrupa por componente con urgentes primero, cantidad = nº de solicitudes, y avisa de las omitidas', async () => {
    abrir({ modo: 'solicitudes', urgentes: [urgente(10, 2), urgente(11, 4), urgente(12, 1)], preventivas: [preventiva(20, 2), preventiva(21, 4)] })
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 1' })).toHaveValue('2')
    expect(screen.getByRole('combobox', { name: 'Componente línea 2' })).toHaveValue('lcd-x-negro')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 2' })).toHaveValue('1')
    expect(screen.queryByRole('combobox', { name: 'Componente línea 3' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('2 solicitud(es) de componentes desactivados no se han añadido y siguen pendientes.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('autocompletar: solo activos (con los slaves de SKU compartido), filtro "contiene" y Enter elige el primero', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    const campo = screen.getByRole('combobox', { name: 'Componente línea 1' })
    await userEvent.type(campo, 'x')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['lcd-x-negro', 'bat-x']))
    await userEvent.clear(campo)
    await userEvent.type(campo, 'bat')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['bat-x', 'bat-y'])
    await userEvent.type(campo, '{Enter}')
    expect(campo).toHaveValue('bat-x')
  })

  it('validación en la línea de error, en orden y parando en el primer fallo; cambiar una línea la borra', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: selecciona un componente.')
    await elegirComponente(1, 'bat', 'bat-x')
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
    expect(await within(filaDe(1)).findByText('17,59 €')).toBeInTheDocument()
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
    expect(screen.getByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x')
    expect(screen.queryByRole('combobox', { name: 'Componente línea 2' })).not.toBeInTheDocument()
  })
})
