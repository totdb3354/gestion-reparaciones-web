import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { CABECERAS_CSV_PROVEEDORES, filaCsvProveedor } from './columnas'
import { ultimaRutaStock } from '../estado'
import { ProveedoresPage } from './ProveedoresPage'

const proveedores = [
  { idProv: 1, nombre: 'ACME', activo: true, divisa: 'EUR', comentario: 'principal', tipo: 'COMPONENTES' },
  { idProv: 2, nombre: 'Proveedor B', activo: true, divisa: 'USD', comentario: '', tipo: 'COMPONENTES' },
  { idProv: 3, nombre: 'Antiguo', activo: false, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' },
]
let tipoPedido: string | null = null
const cargas = { n: 0 }

beforeEach(() => {
  tipoPedido = null
  cargas.n = 0
  server.use(
    http.get('*/api/proveedores', ({ request }) => { cargas.n += 1; tipoPedido = new URL(request.url).searchParams.get('tipo'); return HttpResponse.json(proveedores) }),
    http.get('*/api/proveedores/:id/tiene-pedidos', ({ params }) => HttpResponse.json({ value: params.id === '1' })),
  )
})
const montar = (sesion = SESION_SUPER) => renderConProviders(<ProveedoresPage />, { sesion, ruta: '/stock/proveedores' })

describe('ProveedoresPage', () => {
  it('pide los de COMPONENTES y pinta Nombre, Divisa, Estado y Comentario; el inactivo sin barra verde', async () => {
    montar()
    expect(await screen.findByRole('heading', { name: 'Proveedores' })).toBeInTheDocument()
    expect(tipoPedido).toBe('COMPONENTES')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nombre', 'Divisa', 'Estado', 'Comentario'])
    expect(await screen.findAllByText('Activo')).toHaveLength(2)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByText('principal')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /^ACME/ })).toHaveClass('border-l-fila-reparado-brd')
    expect(screen.getByRole('row', { name: /^Antiguo/ })).not.toHaveClass('opacity-45')
    expect(screen.getByText(/^Actualizado \d\d:\d\d$/)).toBeInTheDocument()
  })
  it('el comentario respeta los saltos de línea (whitespace-pre-line), como el JavaFX, que hace crecer la fila', async () => {
    server.use(http.get('*/api/proveedores', () => HttpResponse.json([{ ...proveedores[0], comentario: 'linea uno\nlinea dos' }])))
    montar()
    const comentario = await screen.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'linea uno\nlinea dos')
    expect(comentario).toHaveClass('whitespace-pre-line')
  })
  it('al entrar guarda "/stock/proveedores" como última pestaña de Stock (S2: la barra superior vuelve a ella)', async () => {
    montar()
    await screen.findByText('ACME')
    expect(ultimaRutaStock.get()).toBe('/stock/proveedores')
  })
  it('el filtro solo ofrece activos, dice "N proveedores" con varios y filtra por nombre; vacío pinta "Sin proveedores"', async () => {
    montar()
    await screen.findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Proveedor' }))
    expect(screen.queryByRole('checkbox', { name: 'Antiguo' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'ACME' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Proveedor B' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '2 proveedores' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('Antiguo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })
  it('TECNICO y ADMIN: sin "Nuevo proveedor" ni menú', async () => {
    for (const sesion of [SESION_TEC, SESION_ADMIN]) {
      const { unmount } = montar(sesion)
      await screen.findByText('ACME')
      expect(screen.queryByRole('button', { name: 'Nuevo proveedor' })).not.toBeInTheDocument()
      await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ACME') })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      unmount()
    }
  })
  it('menú del supertécnico: Desactivar/Editar y "Borrar" solo sin pedidos; "Activar" en el inactivo', async () => {
    montar()
    await screen.findByText('ACME')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ACME') })
    await waitFor(() => expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Desactivar', 'Editar']))
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Proveedor B') })
    await waitFor(() => expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Desactivar', 'Editar', 'Borrar']))
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Antiguo') })
    expect(await screen.findByRole('menuitem', { name: 'Activar' })).toBeInTheDocument()
  })
  it('"Nuevo proveedor": nombre en blanco avisa (S5); con nombre hace el POST con tipo COMPONENTES y recarga', async () => {
    let cuerpo: unknown = null
    server.use(http.post('*/api/proveedores', async ({ request }) => { cuerpo = await request.json(); return new HttpResponse(null, { status: 201 }) }))
    montar()
    await screen.findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    const dlg = within(screen.getByRole('dialog', { name: 'Nuevo proveedor' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar' }))
    expect(dlg.getByRole('alert')).toHaveTextContent('El nombre no puede estar vacío.')
    await userEvent.type(dlg.getByLabelText('Nombre del proveedor:'), '  Nuevo  {Enter}')
    await waitFor(() => expect(cuerpo).toEqual({ nombre: 'Nuevo', divisa: 'EUR', tipo: 'COMPONENTES' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('"Nuevo proveedor": un 422 del servidor se muestra inline y el diálogo sigue abierto, sin aviso global', async () => {
    server.use(http.post('*/api/proveedores', () => HttpResponse.json({ message: 'El nombre no puede estar vacío.' }, { status: 422 })))
    montar()
    await screen.findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    const dlg = within(screen.getByRole('dialog', { name: 'Nuevo proveedor' }))
    await userEvent.type(dlg.getByLabelText('Nombre del proveedor:'), 'Nuevo{Enter}')
    expect(await dlg.findByRole('alert')).toHaveTextContent('El nombre no puede estar vacío.')
    expect(screen.getByRole('dialog', { name: 'Nuevo proveedor' })).toBeInTheDocument()
    expect(screen.getAllByText('El nombre no puede estar vacío.')).toHaveLength(1)
  })
  it('"Editar": precarga nombre, divisa y comentario; manda el PUT; nombre vacío avisa', async () => {
    let cuerpo: unknown = null
    server.use(http.put('*/api/proveedores/1', async ({ request }) => { cuerpo = await request.json(); return new HttpResponse(null, { status: 200 }) }))
    montar()
    await screen.findByText('ACME')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ACME') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const dlg = within(screen.getByRole('dialog', { name: 'Editar proveedor' }))
    expect(dlg.getByLabelText('Nombre')).toHaveValue('ACME')
    // ComboNavy: el disparador es role="combobox" con aria-label; cada opción es un <li role="option"> con un <button>
    // dentro, que es quien recibe el clic (patrón de ComboNavy.test.tsx).
    expect(dlg.getByRole('combobox', { name: 'Divisa' })).toHaveTextContent('EUR')
    expect(dlg.getByLabelText('Comentario')).toHaveValue('principal')
    await userEvent.clear(dlg.getByLabelText('Nombre'))
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar' }))
    expect(dlg.getByRole('alert')).toHaveTextContent('El nombre no puede estar vacío.')
    await userEvent.type(dlg.getByLabelText('Nombre'), 'ACME 2')
    await userEvent.click(dlg.getByRole('combobox', { name: 'Divisa' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Divisa' })).getByRole('button', { name: 'USD' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(cuerpo).toEqual({ nombre: 'ACME 2', divisa: 'USD', comentario: 'principal' }))
  })
  it('"Editar": un 422 del servidor se muestra inline y el diálogo sigue abierto, sin aviso global', async () => {
    server.use(http.put('*/api/proveedores/1', () => HttpResponse.json({ message: 'Divisa no válida (EUR o USD).' }, { status: 422 })))
    montar()
    await screen.findByText('ACME')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ACME') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const dlg = within(screen.getByRole('dialog', { name: 'Editar proveedor' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar' }))
    expect(await dlg.findByRole('alert')).toHaveTextContent('Divisa no válida (EUR o USD).')
    expect(screen.getByRole('dialog', { name: 'Editar proveedor' })).toBeInTheDocument()
    expect(screen.getAllByText('Divisa no válida (EUR o USD).')).toHaveLength(1)
  })
  it('"Borrar" pide confirmación con el texto del JavaFX y hace el DELETE; un 409 del servidor se muestra como aviso', async () => {
    let borrado = false
    server.use(http.delete('*/api/proveedores/2', () => { borrado = true; return new HttpResponse(null, { status: 204 }) }))
    montar()
    await screen.findByText('ACME')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Proveedor B') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    const dlg = within(screen.getByRole('dialog', { name: 'Borrar proveedor' }))
    expect(dlg.getByText('¿Eliminar el proveedor "Proveedor B"?')).toBeInTheDocument()
    await userEvent.click(dlg.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrado).toBe(true))
    server.use(http.delete('*/api/proveedores/2', () => HttpResponse.json({ message: 'El proveedor tiene pedidos y no se puede borrar.' }, { status: 409 })))
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Proveedor B') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Borrar proveedor' })).getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByText('El proveedor tiene pedidos y no se puede borrar.')).toBeInTheDocument()
  })
  it('"Desactivar" hace el PATCH sin confirmación', async () => {
    let cuerpo: unknown = null
    server.use(http.patch('*/api/proveedores/1/activo', async ({ request }) => { cuerpo = await request.json(); return new HttpResponse(null, { status: 200 }) }))
    montar()
    await screen.findByText('ACME')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ACME') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))
    await waitFor(() => expect(cuerpo).toEqual({ activo: false }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('CSV: ID, Nombre, Activo con Sí/No', () => {
    expect(CABECERAS_CSV_PROVEEDORES).toEqual(['ID', 'Nombre', 'Activo'])
    expect(filaCsvProveedor(proveedores[0])).toEqual(['1', 'ACME', 'Sí'])
    expect(filaCsvProveedor(proveedores[2])).toEqual(['3', 'Antiguo', 'No'])
  })
  it('badge "Activo" verde e "Inactivo" gris; la fila activa con borde verde y la inactiva sin opacidad', async () => {
    montar()
    await screen.findByText('ACME')
    const activo = within(screen.getByRole('row', { name: /^ACME/ })).getByText('Activo')
    expect(activo).toHaveClass('bg-fila-reparado-bg', 'text-fila-reparado-ico')
    const inactivo = within(screen.getByRole('row', { name: /^Antiguo/ })).getByText('Inactivo')
    expect(inactivo).toHaveClass('bg-fila-cancelado-bg', 'text-fila-cancelado-text')
    expect(inactivo).not.toHaveClass('bg-fila-reparado-bg')
    expect(screen.getByRole('row', { name: /^ACME/ })).toHaveClass('border-l-fila-reparado-brd')
    expect(screen.getByRole('row', { name: /^Antiguo/ })).not.toHaveClass('opacity-45')
  })
  it('tabla vacía por el filtro: el proveedor filtrado deja de venir tras recargar y se pinta "Sin proveedores"', async () => {
    montar()
    await screen.findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Proveedor' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'ACME' }))
    await userEvent.keyboard('{Escape}')
    expect(within(screen.getByRole('table')).getByText('ACME')).toBeInTheDocument()
    server.use(http.get('*/api/proveedores', () => { cargas.n += 1; return HttpResponse.json(proveedores.filter((p) => p.nombre !== 'ACME')) }))
    const antes = cargas.n
    await userEvent.click(screen.getByRole('button', { name: /^Actualizado \d\d:\d\d$/ }))
    await waitFor(() => expect(cargas.n).toBeGreaterThan(antes))
    expect(await screen.findByText('Sin proveedores')).toBeInTheDocument()
  })
  it('"Desactivar"/"Activar": tras el PATCH recarga la lista', async () => {
    let patch = false
    server.use(http.patch('*/api/proveedores/3/activo', () => { patch = true; return new HttpResponse(null, { status: 200 }) }))
    montar()
    await screen.findByText('ACME')
    const antes = cargas.n
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Antiguo') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Activar' }))
    await waitFor(() => expect(patch).toBe(true))
    await waitFor(() => expect(cargas.n).toBeGreaterThan(antes))
  })
  it('"Nuevo proveedor": tras el POST cierra el diálogo y recarga', async () => {
    let post = false
    server.use(http.post('*/api/proveedores', () => { post = true; return new HttpResponse(null, { status: 201 }) }))
    montar()
    await screen.findByText('ACME')
    const antes = cargas.n
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    await userEvent.type(within(screen.getByRole('dialog', { name: 'Nuevo proveedor' })).getByLabelText('Nombre del proveedor:'), 'Nuevo{Enter}')
    await waitFor(() => expect(post).toBe(true))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(cargas.n).toBeGreaterThan(antes))
  })
  it('"Editar": tras el PUT cierra el diálogo y recarga', async () => {
    let put = false
    server.use(http.put('*/api/proveedores/1', () => { put = true; return new HttpResponse(null, { status: 200 }) }))
    montar()
    await screen.findByText('ACME')
    const antes = cargas.n
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ACME') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Editar proveedor' })).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(put).toBe(true))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(cargas.n).toBeGreaterThan(antes))
  })
  it('"Borrar": tras el DELETE recarga la lista', async () => {
    let borrado = false
    server.use(http.delete('*/api/proveedores/2', () => { borrado = true; return new HttpResponse(null, { status: 204 }) }))
    montar()
    await screen.findByText('ACME')
    const antes = cargas.n
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Proveedor B') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Borrar proveedor' })).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrado).toBe(true))
    await waitFor(() => expect(cargas.n).toBeGreaterThan(antes))
  })
})
