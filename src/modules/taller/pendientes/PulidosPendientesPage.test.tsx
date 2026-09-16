import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estaConectado } from '@/shared/api/conexion'
import { server } from '@/test/server'
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
    await waitFor(() => expect(ids).toEqual({ ids: ['AP20260916_2'] }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Completar seleccionados' })).toBeDisabled())
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
