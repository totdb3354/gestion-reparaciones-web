import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usuario } from '@/shared/api/client'
import { crearQueryClient } from '@/shared/api/queryClient'
import { ExportableProvider, useExportable } from '@/shared/ui/exportable'
import { renderConProviders, renderConRouter, SESION_ADMIN, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { TecnicosPage } from './TecnicosPage'

const usuarios: Usuario[] = [
  { idUsu: 11, nombreUsuario: 'usuario-a', rol: 'TECNICO', idTec: 21, nombreTecnico: 'tecnico-a', activo: true },
  { idUsu: 12, nombreUsuario: 'usuario-b', rol: 'SUPERTECNICO', idTec: 22, nombreTecnico: 'tecnico-b', activo: false },
]
const cargas = { n: 0 }

// navigator.clipboard no existe en jsdom por defecto: mismo patrón que MenuCopiarCelda.test.tsx (Object.defineProperty
// configurable, restaurado tras cada test a partir del descriptor original).
const descriptorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  if (descriptorClipboard) Object.defineProperty(navigator, 'clipboard', descriptorClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

beforeEach(() => {
  cargas.n = 0
  server.use(http.get('*/api/usuarios/tecnicos', () => { cargas.n += 1; return HttpResponse.json(usuarios) }))
})

const montar = (opciones: { queryClient?: ReturnType<typeof crearQueryClient> } = {}) =>
  renderConProviders(<TecnicosPage />, { sesion: SESION_ADMIN, ruta: '/gestion/tecnicos', ...opciones })
const fila = (nombre: string) => screen.getByRole('row', { name: new RegExp(`^${nombre}`) })
const linea = () => screen.getByRole('alert')
const botonRegistrar = () => screen.getByRole('button', { name: 'Registrar técnico' })

async function rellenar({ tecnico = '', usuario = '' }) {
  if (tecnico) await userEvent.type(screen.getByLabelText('Nombre del técnico'), tecnico)
  if (usuario) await userEvent.type(screen.getByLabelText('Nombre de usuario'), usuario)
}

/** Sonda del menú de usuario: "Descargar CSV" se habilita solo si la vista registra un exportable. */
function SondaCsv() {
  return <p>{useExportable() === null ? 'SIN CSV' : 'CON CSV'}</p>
}

/** Calco de RegisterView.fxml y RegisterController (hotfix/0.16.3) como página del shell (spec 6, §6.1). */
describe('TecnicosPage', () => {
  it('cabecera con logo, dos campos con sus etiquetas y placeholders, fila de acción, tabla y "Cerrar"', async () => {
    const { container } = montar()
    expect(screen.getByRole('heading', { name: 'Gestión de usuarios' })).toHaveClass('text-[18px]', 'font-bold', 'text-azul-medio')
    expect(screen.getByText('Registra o elimina accesos al sistema')).toHaveClass('text-[12px]', 'text-azul-gris')
    expect(container.querySelector('img[src="/logo_inicio_sesion.png"]')).toHaveClass('h-[46px]', 'w-[46px]')
    const campos = [
      ['Nombre del técnico', 'Nombre visible en reparaciones', 'text'],
      ['Nombre de usuario', 'Credencial de login', 'text'],
    ] as const
    for (const [etiqueta, placeholder, tipo] of campos) {
      const campo = screen.getByLabelText(etiqueta)
      expect(campo).toHaveAttribute('placeholder', placeholder)
      expect(campo).toHaveAttribute('type', tipo)
      expect(campo).toHaveValue('')
    }
    expect(screen.getByText('Nombre del técnico')).toHaveClass('text-[11px]', 'font-bold', 'text-azul-gris')
    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull()
    expect(screen.queryByPlaceholderText('Repite la contraseña')).toBeNull()
    const combo = screen.getByRole('combobox', { name: 'Rol' })
    expect(combo).toHaveTextContent(/^TECNICO$/)
    expect(combo).toHaveStyle({ width: '130px' })
    await userEvent.click(combo)
    expect(within(screen.getByRole('listbox', { name: 'Rol' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['TECNICO', 'SUPERTECNICO'])
    await userEvent.keyboard('{Escape}')
    expect(botonRegistrar()).toBeEnabled()
    expect(linea()).toBeEmptyDOMElement()
    expect(screen.getByRole('heading', { name: 'Técnicos registrados' })).toHaveClass('text-[13px]', 'font-bold')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveClass('text-[12px]', 'text-azul-gris')
    expect(container.firstChild).toHaveClass('bg-fondo-gestion')
    expect(await screen.findByText('tecnico-a')).toBeInTheDocument()
  })
  it('la tabla ocupa el ancho y la columna de acciones absorbe el sobrante (CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN)', async () => {
    const { container } = montar()
    await screen.findByText('tecnico-a')
    const tabla = container.querySelector('table')!
    expect(tabla).toHaveClass('w-full')
    const cols = container.querySelectorAll('col')
    expect(cols[0]).toHaveStyle({ width: '160px' })
    expect(cols[4].style.width).toBe('')
  })
  it('pinta la lista del servidor en su orden, sin ordenación por cabecera', async () => {
    const { container } = montar()
    await screen.findByText('tecnico-a')
    expect(Array.from(container.querySelectorAll('[data-columna="tecnico"]')).map((c) => c.textContent)).toEqual(['tecnico-a', 'tecnico-b'])
    expect(Array.from(container.querySelectorAll('[data-columna="rol"]')).map((c) => c.textContent)).toEqual(['TECNICO', 'SUPERTECNICO'])
    expect(screen.getByRole('columnheader', { name: 'Técnico' })).not.toHaveAttribute('aria-sort')
    expect(within(screen.getByRole('columnheader', { name: 'Técnico' })).queryByRole('button')).not.toBeInTheDocument()
    expect(cargas.n).toBe(1)
  })
  it('no registra exportable: "Descargar CSV" queda deshabilitado en esta ruta (calco)', async () => {
    renderConProviders(
      <ExportableProvider>
        <TecnicosPage />
        <SondaCsv />
      </ExportableProvider>,
      { sesion: SESION_ADMIN, ruta: '/gestion/tecnicos' },
    )
    await screen.findByText('tecnico-a')
    expect(screen.getByText('SIN CSV')).toBeInTheDocument()
  })
  it('duplicados en vivo (sin mayúsculas y con trim) bajo cada campo y "Registrar técnico" deshabilitado; "admin" pasa', async () => {
    montar()
    await screen.findByText('tecnico-a')
    const tecnico = screen.getByLabelText('Nombre del técnico')
    const usuario = screen.getByLabelText('Nombre de usuario')
    await userEvent.type(tecnico, ' TECNICO-A ')
    expect(screen.getByText('Ya existe un técnico con ese nombre.')).toHaveClass('text-[10px]', 'text-texto-error')
    expect(botonRegistrar()).toBeDisabled()
    await userEvent.type(usuario, 'Usuario-B')
    expect(screen.getByText('Ese nombre de usuario ya existe.')).toBeInTheDocument()
    await userEvent.clear(tecnico)
    expect(screen.queryByText('Ya existe un técnico con ese nombre.')).not.toBeInTheDocument()
    expect(botonRegistrar()).toBeDisabled()
    await userEvent.clear(usuario)
    expect(botonRegistrar()).toBeEnabled()
    await userEvent.type(usuario, 'admin')
    expect(screen.queryByText('Ese nombre de usuario ya existe.')).not.toBeInTheDocument()
    expect(botonRegistrar()).toBeEnabled()
    // Los avisos en vivo no van a la línea inline.
    expect(linea()).toBeEmptyDOMElement()
  })
  it('valida los nombres sin llamar al servidor, y Enter no registra', async () => {
    let posts = 0
    server.use(http.post('*/api/usuarios/tecnicos', () => { posts += 1; return HttpResponse.json({ value: 'Temporal23' }, { status: 201 }) }))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'x{enter}')
    expect(linea()).toBeEmptyDOMElement()
    await userEvent.click(botonRegistrar())
    expect(linea()).toHaveTextContent('Todos los campos son obligatorios.')
    expect(linea()).toHaveClass('text-[11px]', 'text-texto-error')
    expect(posts).toBe(0)
  })
  it('alta: POST con nombres recortados y el rol del combo; vacía el formulario, combo a TECNICO y recarga, sin mensaje de éxito', async () => {
    let cuerpo: unknown = null
    server.use(http.post('*/api/usuarios/tecnicos', async ({ request }) => { cuerpo = await request.json(); return HttpResponse.json({ value: 'Temporal23' }, { status: 201 }) }))
    montar()
    await screen.findByText('tecnico-a')
    await rellenar({ tecnico: '  tecnico-c ', usuario: ' usuario-c ' })
    await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Rol' })).getByRole('button', { name: 'SUPERTECNICO' }))
    await userEvent.click(botonRegistrar())
    await waitFor(() => expect(cargas.n).toBe(2))
    expect(cuerpo).toEqual({ nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-c', rol: 'SUPERTECNICO' })
    for (const etiqueta of ['Nombre del técnico', 'Nombre de usuario']) {
      await waitFor(() => expect(screen.getByLabelText(etiqueta)).toHaveValue(''))
    }
    // Sin mensaje de éxito: lo único que se abre es la ventana de la contraseña temporal.
    expect(await screen.findByRole('dialog', { name: 'Contraseña temporal' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('combobox', { name: 'Rol' })).toHaveTextContent(/^TECNICO$/)
    expect(linea()).toBeEmptyDOMElement()
  })
  it('el formulario ya no tiene campos de contraseña', async () => {
    montar()
    await screen.findByText('tecnico-a')
    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull()
    expect(screen.queryByPlaceholderText('Repite la contraseña')).toBeNull()
  })
  it('tras el alta enseña la temporal una sola vez, con el texto de entrega', async () => {
    server.use(http.post('*/api/usuarios/tecnicos', () => HttpResponse.json({ value: 'Temporal23' }, { status: 201 })))
    montar()
    await screen.findByText('tecnico-a')
    await rellenar({ tecnico: 'Nuevo Técnico', usuario: 'usuario-n' })
    await userEvent.click(botonRegistrar())
    const dlg = await screen.findByRole('dialog', { name: 'Contraseña temporal' })
    expect(within(dlg).getByLabelText('Contraseña temporal')).toHaveValue('Temporal23')
    expect(dlg).toHaveTextContent('Entrégasela a "Nuevo Técnico" en persona')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Contraseña temporal' })).toBeNull()
    expect(screen.queryByDisplayValue('Temporal23')).toBeNull()
  })
  it('tras una validación fallida "Registrar técnico" sigue respondiendo', async () => {
    let altas = 0
    server.use(http.post('*/api/usuarios/tecnicos', () => { altas += 1; return HttpResponse.json({ value: 'Temporal23' }, { status: 201 }) }))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(botonRegistrar())
    expect(linea()).not.toBeEmptyDOMElement()
    await rellenar({ tecnico: 'tecnico-c', usuario: 'usuario-c' })
    await userEvent.click(botonRegistrar())
    await waitFor(() => expect(altas).toBe(1))
  })
  it.each([
    [409, () => HttpResponse.json({ message: 'Ese nombre de usuario ya existe.' }, { status: 409 }), 'Ese nombre de usuario ya existe.'],
    [422, () => HttpResponse.json({ message: 'El nombre de usuario no puede superar 50 caracteres.' }, { status: 422 }), 'El nombre de usuario no puede superar 50 caracteres.'],
    [400, () => new HttpResponse('Rol no permitido: ADMIN', { status: 400 }), 'Error al registrar. Inténtalo de nuevo.'],
  ])('alta con %s: la línea inline enseña el texto que toca y el formulario conserva lo escrito', async (_codigo, respuesta, texto) => {
    server.use(http.post('*/api/usuarios/tecnicos', respuesta))
    montar()
    await screen.findByText('tecnico-a')
    await rellenar({ tecnico: 'tecnico-c', usuario: 'usuario-c' })
    await userEvent.click(botonRegistrar())
    expect(await screen.findByText(texto)).toBe(linea())
    expect(screen.getByLabelText('Nombre del técnico')).toHaveValue('tecnico-c')
    expect(cargas.n).toBe(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('alta con Idempotency-Key: el reintento del mismo formulario repite la clave; cambiar un campo o un alta correcta la cambian', async () => {
    const envios: { tecnico: string; clave: string | null }[] = []
    server.use(http.post('*/api/usuarios/tecnicos', async ({ request }) => {
      const { nombreTecnico } = (await request.json()) as { nombreTecnico: string }
      envios.push({ tecnico: nombreTecnico, clave: request.headers.get('Idempotency-Key') })
      return envios.length < 3 ? HttpResponse.json({ message: 'Ese nombre de usuario ya existe.' }, { status: 409 }) : HttpResponse.json({ value: 'Temporal23' }, { status: 201 })
    }))
    montar()
    await screen.findByText('tecnico-a')
    const registrarY = async (n: number) => {
      await userEvent.click(botonRegistrar())
      await waitFor(() => expect(envios).toHaveLength(n))
      if (n < 3) await screen.findByText('Ese nombre de usuario ya existe.')
    }
    await rellenar({ tecnico: 'tecnico-c', usuario: 'usuario-c' })
    await registrarY(1)
    await registrarY(2)
    await rellenar({ tecnico: 'x' })
    await registrarY(3)
    await userEvent.keyboard('{Escape}') // cierra la ventana de la temporal
    await waitFor(() => expect(screen.getByLabelText('Nombre del técnico')).toHaveValue(''))
    await rellenar({ tecnico: 'tecnico-cx', usuario: 'usuario-c' })
    await registrarY(4)
    expect(envios.map((e) => e.tecnico)).toEqual(['tecnico-c', 'tecnico-c', 'tecnico-cx', 'tecnico-cx'])
    const [a, b, c, d] = envios.map((e) => e.clave)
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(b).toBe(a)
    expect(c).not.toBe(a)
    expect(d).not.toBe(c)
  })
  it('candado sin confirmación: desactiva al activo, activa al inactivo y recarga tras cada uno', async () => {
    const rutas: string[] = []
    server.use(http.patch('*/api/usuarios/tecnicos/:idTec/:accion', ({ request }) => { rutas.push(new URL(request.url).pathname); return new HttpResponse(null, { status: 204 }) }))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Desactivar acceso' }))
    await waitFor(() => expect(cargas.n).toBe(2))
    await userEvent.click(within(fila('tecnico-b')).getByRole('button', { name: 'Activar acceso' }))
    await waitFor(() => expect(cargas.n).toBe(3))
    expect(rutas).toEqual(['/api/usuarios/tecnicos/21/desactivar', '/api/usuarios/tecnicos/22/activar'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(linea()).toBeEmptyDOMElement()
  })
  it.each([
    [404, () => HttpResponse.json({ message: 'Técnico no encontrado.' }, { status: 404 }), 'Técnico no encontrado.'],
    [400, () => new HttpResponse('boom', { status: 400 }), 'Error al cambiar el estado del técnico.'],
  ])('candado con %s: texto inline y sin recarga', async (_codigo, respuesta, texto) => {
    server.use(http.patch('*/api/usuarios/tecnicos/:idTec/:accion', respuesta))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Desactivar acceso' }))
    expect(await screen.findByText(texto)).toBe(linea())
    expect(cargas.n).toBe(1)
  })
  it('papelera de un técnico con reparaciones: aviso "No se puede eliminar" con sus tres líneas y no borra', async () => {
    let borrados = 0
    server.use(
      http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', () => HttpResponse.json({ value: true })),
      http.delete('*/api/usuarios/tecnicos/:idTec', () => { borrados += 1; return new HttpResponse(null, { status: 204 }) }),
    )
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Eliminar' }))
    const aviso = await screen.findByRole('dialog', { name: 'No se puede eliminar' })
    expect(aviso).toHaveTextContent('"tecnico-a" tiene reparaciones asociadas. No es posible eliminarlo para conservar el historial. Puedes desactivarlo para bloquear su acceso.')
    await userEvent.click(within(aviso).getByRole('button', { name: 'Aceptar' }))
    expect(borrados).toBe(0)
    expect(cargas.n).toBe(1)
  })
  it('papelera sin reparaciones: confirmación "Eliminar técnico" → DELETE con idUsu → recarga', async () => {
    const borrados: string[] = []
    server.use(
      http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', () => HttpResponse.json({ value: false })),
      http.delete('*/api/usuarios/tecnicos/:idTec', ({ request }) => { const u = new URL(request.url); borrados.push(u.pathname + u.search); return new HttpResponse(null, { status: 204 }) }),
    )
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Eliminar' }))
    const confirmacion = await screen.findByRole('dialog', { name: 'Eliminar técnico' })
    expect(confirmacion).toHaveTextContent('¿Eliminar a "tecnico-a" definitivamente? Se borrarán sus credenciales de acceso y su registro de técnico.')
    expect(within(confirmacion).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(cargas.n).toBe(2))
    expect(borrados).toEqual(['/api/usuarios/tecnicos/21?idUsu=11'])
    expect(screen.queryByRole('dialog', { name: 'Eliminar técnico' })).not.toBeInTheDocument()
  })
  it('"Cancelar" en la confirmación no borra', async () => {
    let borrados = 0
    server.use(
      http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', () => HttpResponse.json({ value: false })),
      http.delete('*/api/usuarios/tecnicos/:idTec', () => { borrados += 1; return new HttpResponse(null, { status: 204 }) }),
    )
    montar()
    await screen.findByText('tecnico-b')
    await userEvent.click(within(fila('tecnico-b')).getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Eliminar técnico' })).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Eliminar técnico' })).not.toBeInTheDocument())
    expect(borrados).toBe(0)
    expect(cargas.n).toBe(1)
  })
  it.each([
    [409, () => HttpResponse.json({ message: '"tecnico-a" tiene reparaciones asociadas.' }, { status: 409 }), '"tecnico-a" tiene reparaciones asociadas.'],
    [404, () => HttpResponse.json({ message: 'Técnico no encontrado.' }, { status: 404 }), 'Técnico no encontrado.'],
    [400, () => new HttpResponse('boom', { status: 400 }), 'Error al eliminar el técnico.'],
  ])('DELETE con %s (p. ej. la carrera entre la comprobación y el borrado): texto inline y sin recarga', async (_codigo, respuesta, texto) => {
    server.use(
      http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', () => HttpResponse.json({ value: false })),
      http.delete('*/api/usuarios/tecnicos/:idTec', respuesta),
    )
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Eliminar técnico' })).getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(texto)).toBe(linea())
    expect(cargas.n).toBe(1)
  })
  it.each([
    [404, () => HttpResponse.json({ message: 'Técnico no encontrado.' }, { status: 404 }), 'Técnico no encontrado.'],
    [400, () => new HttpResponse('boom', { status: 400 }), 'Error al comprobar las reparaciones del técnico.'],
  ])('fallo de la comprobación con %s: texto inline, sin aviso ni confirmación', async (_codigo, respuesta, texto) => {
    server.use(http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', respuesta))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(texto)).toBe(linea())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('la línea inline se vacía al empezar cualquier acción (G9)', async () => {
    server.use(
      http.patch('*/api/usuarios/tecnicos/:idTec/:accion', () => new HttpResponse('boom', { status: 400 })),
      // La comprobación no responde: se ve que la línea ya se ha vaciado antes de saber el resultado.
      http.get('*/api/usuarios/tecnicos/:idTec/tiene-reparaciones', async () => { await delay('infinite'); return HttpResponse.json({ value: false }) }),
    )
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Desactivar acceso' }))
    expect(await screen.findByText('Error al cambiar el estado del técnico.')).toBe(linea())
    await userEvent.click(within(fila('tecnico-b')).getByRole('button', { name: 'Eliminar' }))
    expect(linea()).toBeEmptyDOMElement()
    await userEvent.click(botonRegistrar())
    expect(linea()).toHaveTextContent('Todos los campos son obligatorios.')
  })
  it('error de carga: "Error al cargar los usuarios." en la línea, tabla vacía con su placeholder y sin diálogo', async () => {
    server.use(http.get('*/api/usuarios/tecnicos', () => new HttpResponse('boom', { status: 500 })))
    montar()
    expect(await screen.findByText('Error al cargar los usuarios.')).toBe(linea())
    expect(screen.getByText('Tabla sin contenido')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('una escritura con éxito marca como caducados los técnicos del resto de la web', async () => {
    server.use(http.patch('*/api/usuarios/tecnicos/:idTec/:accion', () => new HttpResponse(null, { status: 204 })))
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(['tecnicos'], [])
    qc.setQueryData(['tecnicos', 'activos'], [])
    qc.setQueryData(['clientes'], [])
    montar({ queryClient: qc })
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Desactivar acceso' }))
    await waitFor(() => expect(qc.getQueryState(['tecnicos'])?.isInvalidated).toBe(true))
    expect(qc.getQueryState(['tecnicos', 'activos'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['clientes'])?.isInvalidated).toBe(false)
  })
  it('"Cerrar" vuelve a la ruta de volverA sin preguntar aunque haya texto', async () => {
    const { router } = renderConRouter(
      [
        { path: '/gestion/tecnicos', element: <TecnicosPage /> },
        { path: '/stock/pedidos', element: <p>PEDIDOS</p> },
        { path: '/reparaciones', element: <p>REPARACIONES</p> },
      ],
      { sesion: SESION_ADMIN, ruta: '/reparaciones' },
    )
    await act(() => router.navigate('/gestion/tecnicos', { state: { volverA: '/stock/pedidos' } }))
    await screen.findByText('tecnico-a')
    await userEvent.type(screen.getByLabelText('Nombre del técnico'), 'tecnico-c')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('PEDIDOS')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/stock/pedidos')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('"Restablecer contraseña": confirma, POST con el idUsu de la fila y enseña la contraseña una sola vez', async () => {
    const pedidas: string[] = []
    server.use(http.post('*/api/usuarios/:idUsu/password-temporal', ({ request }) => {
      pedidas.push(new URL(request.url).pathname)
      return HttpResponse.json({ value: 'Tmp-7k2Qw9' })
    }))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Restablecer contraseña' }))
    const confirmacion = await screen.findByRole('dialog', { name: 'Restablecer contraseña' })
    expect(confirmacion).toHaveTextContent('¿Entregar una contraseña temporal a "tecnico-a"? Su contraseña actual dejará de servir y tendrá que poner una propia al entrar.')
    expect(pedidas).toEqual([])
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Restablecer' }))
    const entrega = await screen.findByRole('dialog', { name: 'Contraseña temporal' })
    expect(pedidas).toEqual(['/api/usuarios/11/password-temporal'])
    expect(within(entrega).getByLabelText('Contraseña temporal')).toHaveValue('Tmp-7k2Qw9')
    expect(entrega).toHaveTextContent('Solo se muestra ahora: al cerrar esta ventana no se vuelve a ver.')
    expect(entrega).toHaveTextContent('Al entrar con ella tendrá que cambiarla por una propia.')
    // Copiar deja la contraseña en el portapapeles y el diálogo abierto, para poder comprobarla.
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    await userEvent.click(within(entrega).getByRole('button', { name: 'Copiar' }))
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('Tmp-7k2Qw9'))
    // Al cerrar no queda en ninguna parte: ni en pantalla, ni en el almacenamiento, ni en la caché de consultas.
    await userEvent.click(within(entrega).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body.textContent).not.toContain('Tmp-7k2Qw9')
    expect(JSON.stringify(localStorage)).not.toContain('Tmp-7k2Qw9')
    expect(cargas.n).toBe(1)
  })
  it('"Cancelar" en la confirmación no entrega ninguna contraseña', async () => {
    let pedidas = 0
    server.use(http.post('*/api/usuarios/:idUsu/password-temporal', () => { pedidas += 1; return HttpResponse.json({ value: 'Tmp-7k2Qw9' }) }))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Restablecer contraseña' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Restablecer contraseña' })).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(pedidas).toBe(0)
  })
  it.each([
    [404, () => HttpResponse.json({ message: 'Usuario no encontrado.' }, { status: 404 }), 'Técnico no encontrado.'],
    [400, () => new HttpResponse('boom', { status: 400 }), 'Error al restablecer la contraseña del técnico.'],
  ])('restablecer con %s: texto inline y ninguna contraseña en pantalla', async (_codigo, respuesta, texto) => {
    server.use(http.post('*/api/usuarios/:idUsu/password-temporal', respuesta))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Restablecer contraseña' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Restablecer contraseña' })).getByRole('button', { name: 'Restablecer' }))
    expect(await screen.findByText(texto)).toBe(linea())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('una respuesta sin contraseña se trata como un fallo, no como una entrega vacía', async () => {
    server.use(http.post('*/api/usuarios/:idUsu/password-temporal', () => HttpResponse.json({ value: null })))
    montar()
    await screen.findByText('tecnico-a')
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Restablecer contraseña' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Restablecer contraseña' })).getByRole('button', { name: 'Restablecer' }))
    expect(await screen.findByText('Error al restablecer la contraseña del técnico.')).toBe(linea())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('quien no es administrador no ve la acción de restablecer', async () => {
    renderConProviders(<TecnicosPage />, { sesion: SESION_SUPER, ruta: '/gestion/tecnicos' })
    await screen.findByText('tecnico-a')
    expect(screen.queryByRole('button', { name: 'Restablecer contraseña' })).not.toBeInTheDocument()
  })
  it('"Cerrar" sin volverA (URL tecleada) va a /reparaciones', async () => {
    const { router } = renderConRouter(
      [
        { path: '/gestion/tecnicos', element: <TecnicosPage /> },
        { path: '/reparaciones', element: <p>REPARACIONES</p> },
      ],
      { sesion: SESION_ADMIN, ruta: '/gestion/tecnicos' },
    )
    await screen.findByText('tecnico-a')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('REPARACIONES')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reparaciones')
  })
})
