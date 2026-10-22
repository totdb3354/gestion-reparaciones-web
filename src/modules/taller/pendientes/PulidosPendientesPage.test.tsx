import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estaConectado } from '@/shared/api/conexion'
import { server } from '@/test/server'
import { anchosDeColumnas, simularAnchoDeTabla } from '@/test/columnas'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { claveAsignaciones } from '../api'
import { resumen } from '../test/fabrica'
import { PulidosPendientesPage } from './PulidosPendientesPage'

// navigator.clipboard no existe en jsdom por defecto: se define con Object.defineProperty (configurable) para
// poder restaurar el descriptor original después de cada test, en vez de dejar la mutación de Object.assign.
const descriptorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  if (descriptorClipboard) Object.defineProperty(navigator, 'clipboard', descriptorClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

const filas = [
  resumen({ idRep: 'AP20260916_1', imei: '351200000000021', modelo: '13', comentarioAsignacion: 'rayado', nombreTecnicoAsigna: 'Técnico F' }),
  resumen({ idRep: 'AP20260916_2', imei: '358300000000121', modelo: null, cliente: null, nombreTecnicoAsigna: null }),
]

beforeEach(() => {
  server.use(
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json(filas)),
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 2 })),
  )
})
const abrir = (sesion = SESION_TEC) => renderConProviders(<PulidosPendientesPage />, { sesion, ruta: '/reparaciones/pendientes/pulidos' })

describe('PulidosPendientesPage (ficha docs/paridad/pendientes.md, pestaña Pulidos)', () => {
  it('título, columnas y "—" sin asignador', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Mis pulidos pendientes' })).toBeInTheDocument()
    // findByText en vez de getByText: el título es estático y aparece en el primer render (síncrono), antes de
    // que resuelva el GET mockeado del que depende el contador (mismo caso que PendientesPage.test.tsx).
    expect(await screen.findByText('2 pendientes')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['', 'Id Asignación', 'IMEI', 'Modelo', 'Fecha asignación', 'Comentario', 'Cliente', 'Asignado por'])
    expect(within(screen.getByRole('row', { name: /AP20260916_2/ })).getByText('—')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled()
  })
  it('seleccionar todo, completar en lote y limpiar la selección', async () => {
    let ids: unknown = null
    server.use(http.post('*/api/pulidos/asignaciones/completar-lote', async ({ request }) => { ids = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    expect(screen.getAllByRole('checkbox').every((c) => c.getAttribute('aria-checked') === 'true')).toBe(true)
    const completar = screen.getByRole('button', { name: 'Completar seleccionados' })
    expect(completar).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    expect(completar).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_2' }))
    await userEvent.click(completar)
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Completar 1 pulido' })).getByRole('button', { name: 'Completar 1 pulido' }))
    await waitFor(() => expect(ids).toEqual({ ids: ['AP20260916_2'] }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled())
  })
  it('antes de completar pide confirmación con cuántos y cuáles; Cancelar no completa y conserva la selección', async () => {
    let peticiones = 0
    server.use(http.post('*/api/pulidos/asignaciones/completar-lote', () => { peticiones++; return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar seleccionados' }))
    const dlg = screen.getByRole('dialog', { name: 'Completar 2 pulidos' })
    // Una línea por IMEI, con el modelo si lo tiene.
    expect(dlg).toHaveTextContent('Has seleccionado 2 pulidos:')
    expect(within(dlg).getByText(/Has seleccionado/).textContent).toBe('Has seleccionado 2 pulidos:\n351200000000021 · iPhone 13\n358300000000121')
    // El foco va a Cancelar (ConfirmDialog): un Enter despistado no completa.
    expect(within(dlg).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(peticiones).toBe(0)
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'true'])
  })
  it('con más de cinco, la confirmación lista los cinco primeros y cuántos más', async () => {
    const muchas = Array.from({ length: 7 }, (_, i) => resumen({ idRep: `AP20260916_${i + 1}`, imei: `35120000000010${i}`, modelo: null }))
    server.use(http.get('*/api/pulidos/asignaciones', () => HttpResponse.json(muchas)))
    abrir()
    await screen.findByText('AP20260916_7')
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar seleccionados' }))
    const dlg = screen.getByRole('dialog', { name: 'Completar 7 pulidos' })
    expect(within(dlg).getByText(/Has seleccionado/).textContent).toBe(
      'Has seleccionado 7 pulidos:\n351200000000100\n351200000000101\n351200000000102\n351200000000103\n351200000000104\n… y 2 más')
  })
  it('con el filtro por IMEI, «Seleccionar todo» marca solo los que se ven y se completa solo ese (incidencia del taller)', async () => {
    let ids: unknown = null
    server.use(http.post('*/api/pulidos/asignaciones/completar-lote', async ({ request }) => { ids = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.type(screen.getByPlaceholderText('Filtrar por IMEI'), '351200000000021')
    expect(screen.queryByText('AP20260916_2')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar seleccionados' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Completar 1 pulido' })).getByRole('button', { name: 'Completar 1 pulido' }))
    await waitFor(() => expect(ids).toEqual({ ids: ['AP20260916_1'] }))
    // Al quitar el filtro, el otro sigue sin marcar.
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_2' })).toHaveAttribute('aria-checked', 'false')
  })
  it('una recarga con la confirmación abierta vacía la selección, pero se completa lo que se estaba confirmando', async () => {
    let ids: unknown = null
    server.use(http.post('*/api/pulidos/asignaciones/completar-lote', async ({ request }) => { ids = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    const { queryClient } = abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar seleccionados' }))
    await queryClient.invalidateQueries({ queryKey: claveAsignaciones('PULIDO') })
    // hidden: con el diálogo abierto, Radix oculta el resto de la página a la accesibilidad.
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1', hidden: true })).toHaveAttribute('aria-checked', 'false'))
    const dlg = screen.getByRole('dialog', { name: 'Completar 1 pulido' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Completar 1 pulido' }))
    await waitFor(() => expect(ids).toEqual({ ids: ['AP20260916_1'] }))
  })
  it('una casilla marcada que el filtro oculta no se completa ni se cuenta', async () => {
    let ids: unknown = null
    server.use(http.post('*/api/pulidos/asignaciones/completar-lote', async ({ request }) => { ids = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_2' }))
    await userEvent.type(screen.getByPlaceholderText('Filtrar por IMEI'), '351200000000021')
    // Lo único marcado está oculto: no hay nada que completar.
    expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar seleccionados' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Completar 1 pulido' })).getByRole('button', { name: 'Completar 1 pulido' }))
    await waitFor(() => expect(ids).toEqual({ ids: ['AP20260916_1'] }))
  })
  it('si "Completar seleccionados" falla, muestra el mensaje y conserva la selección sin recargar (el JavaFX solo la vacía tras guardar)', async () => {
    let peticiones = 0
    let lecturas = 0
    let soltar!: () => void
    const responde = new Promise<void>((resolver) => { soltar = resolver })
    server.use(
      http.get('*/api/pulidos/asignaciones', () => { lecturas++; return HttpResponse.json(filas) }),
      http.post('*/api/pulidos/asignaciones/completar-lote', async () => {
        peticiones++
        await responde
        return HttpResponse.json({ message: 'Solo puedes completar tus propias asignaciones' }, { status: 422 })
      }),
    )
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    const completar = screen.getByRole('button', { name: 'Completar seleccionados' })
    await userEvent.click(completar)
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Completar 2 pulidos' })).getByRole('button', { name: 'Completar 2 pulidos' }))
    // Mientras se guarda no se puede volver a pulsar (en el JavaFX la llamada bloquea la ventana).
    expect(completar).toBeDisabled()
    await userEvent.click(completar)
    const lecturasAntes = lecturas
    soltar()
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('Solo puedes completar tus propias asignaciones')
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'true'])
    expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeEnabled()
    expect(peticiones).toBe(1)
    expect(lecturas).toBe(lecturasAntes)
  })
  it('recargar sin completar (Actualizado) también vacía la selección', async () => {
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1' }))
    expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: /^Actualizado/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled())
    expect(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1' })).toHaveAttribute('aria-checked', 'false')
  })
  it('un sondeo que falla también vacía la selección (cargar() la vacía antes de pedir la lista)', async () => {
    const { queryClient } = abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'true'])
    let fallos = 0
    server.use(http.get('*/api/pulidos/asignaciones', () => { fallos++; return HttpResponse.text('boom', { status: 503 }) }))
    // Recarga de fondo, como la del intervalo: con datos en pantalla solo se enciende el banner (sin diálogo).
    void queryClient.invalidateQueries({ queryKey: claveAsignaciones('PULIDO') })
    await waitFor(() => expect(estaConectado()).toBe(false))
    expect(fallos).toBe(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled())
    // Las filas siguen (el fallo conserva los datos), ya desmarcadas.
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'false'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('"Actualizado" que falla por conexión muestra el diálogo y también vacía la selección', async () => {
    abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1' }))
    expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeEnabled()
    server.use(http.get('*/api/pulidos/asignaciones', () => HttpResponse.text('boom', { status: 503 })))
    await userEvent.click(screen.getByRole('button', { name: /^Actualizado/ }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('Sin conexión con el servidor: HTTP 503')
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Seleccionar AP20260916_1' })).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled()
  })
  it('la papelera del supertécnico borra la asignación de pulido con su texto', async () => {
    let borrado = false
    server.use(http.delete('*/api/pulidos/asignaciones/AP20260916_1', () => { borrado = true; return new HttpResponse(null, { status: 204 }) }))
    abrir(SESION_SUPER)
    await screen.findByText('AP20260916_1')
    await userEvent.click(screen.getAllByRole('button', { name: 'Borrar asignación' })[0])
    const dlg = screen.getByRole('dialog', { name: 'Borrar asignación AP20260916_1' })
    expect(within(dlg).getByText('El pulido dejará de estar asignado y desaparecerá de tus pendientes.')).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Borrar asignación' }))
    await waitFor(() => expect(borrado).toBe(true))
  })
  it('menú solo con Copiar celda; placeholder vacío', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    const { unmount } = abrir()
    await screen.findByText('AP20260916_1')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('AP20260916_1') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
    // 'id' es uno de los casos que textoCelda delega en textoCeldaPendiente (ver textoCelda.ts): comprueba que la
    // delegación sigue copiando el valor real de la celda, no solo que el ítem de menú exista.
    await userEvent.click(screen.getByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).toHaveBeenCalledWith('AP20260916_1')
    unmount()
    server.use(http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])))
    renderConProviders(<PulidosPendientesPage />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/pulidos' })
    expect(await screen.findByText('No tienes pulidos pendientes')).toBeInTheDocument()
  })
})

describe('PulidosPendientesPage: tabla fluida (adaptación a web)', () => {
  it('sin columna de relleno; la casilla, Id, IMEI, Fecha y la papelera fijas, y las de texto se reparten el sobrante', async () => {
    // 1460 px: 440 para las fijas y 1020 para Modelo, Comentario, Cliente y Asignado por, el doble de sus mínimos (510)
    simularAnchoDeTabla(1460)
    const { container } = abrir(SESION_SUPER)
    await screen.findByText('AP20260916_1')
    expect(container.querySelector('[data-relleno]')).toBeNull()
    expect(anchosDeColumnas(container)).toEqual([40, 90, 130, 240, 130, 320, 220, 240, 50])
  })
})

describe('PulidosPendientesPage: Modelo con la descripción completa (0.9.21)', () => {
  it('en la columna y en la confirmación «IMEI · modelo»', async () => {
    server.use(http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([{ ...filas[0], capacidad: '128GB', color: 'Azul' }, filas[1]])))
    abrir()
    expect(await screen.findByText('iPhone 13 128GB Azul')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar seleccionados' }))
    const dlg = screen.getByRole('dialog', { name: 'Completar 2 pulidos' })
    expect(within(dlg).getByText(/Has seleccionado/).textContent)
      .toBe('Has seleccionado 2 pulidos:\n351200000000021 · iPhone 13 128GB Azul\n358300000000121')
  })
})
