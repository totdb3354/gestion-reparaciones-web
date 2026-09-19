import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { componente, solicitudPreventiva, solicitudUrgente } from '../test/fabrica'
import { CLAVE_NOTIF_COMPONENTES, CLAVE_NOTIF_CONTADOR } from './api'
import { Campana } from './Campana'
import { handlersNotificaciones } from './test/handlers'

const control = vi.hoisted(() => ({ intervalo: null as number | null }))
vi.mock('@/shared/api/refresco', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/api/refresco')>()
  function useIntervaloRefresco(activo = true): number | false {
    const normal = real.useIntervaloRefresco(activo)
    return control.intervalo !== null && activo ? control.intervalo : normal
  }
  return { ...real, useIntervaloRefresco }
})

function espiarGets(): string[] {
  const gets: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') return
    const url = new URL(request.url)
    gets.push(url.pathname + url.search)
  })
  return gets
}
const cuantas = (gets: string[], ruta: string) => gets.filter((g) => g === ruta).length

afterEach(() => {
  control.intervalo = null
  focusManager.setFocused(undefined)
  server.events.removeAllListeners()
})

const SIN_STOCK = componente({ idCom: 102, tipo: 'bati14', stock: 0, stockMinimo: 2 })
const campana = () => screen.getByTestId('campana')
const imagen = () => screen.getByTestId('campana-imagen')
/** Pestaña con la que se ha abierto el panel. */
const pestanaAbierta = () => screen.getByRole('tab', { selected: true }).textContent?.toLowerCase()

describe('Campana (ficha docs/paridad/notificaciones.md)', () => {
  it('TECNICO y ADMIN no la ven ni ocupa hueco (y no piden nada)', () => {
    const gets = espiarGets()
    for (const sesion of [SESION_TEC, SESION_ADMIN]) {
      const { container, unmount } = renderConProviders(<Campana />, { sesion })
      expect(screen.queryByRole('button', { name: 'Notificaciones' })).not.toBeInTheDocument()
      expect(container.querySelector('button, img')).toBeNull()
      unmount()
      sessionStorage.clear()
    }
    expect(gets).toEqual([])
  })
  it('SUPERTECNICO con 0 pendientes: imagen apagada de 30×30, sin badge; botón transparente con hover', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes-stock/count')).toBe(1))
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBe(campana())
    expect(campana()).toHaveClass('cursor-pointer', 'rounded-lg', 'p-0.5', 'hover:bg-white/8')
    expect(campana()).toHaveAttribute('data-encendida', 'false')
    expect(imagen()).toHaveAttribute('src', '/NotifOFF.png')
    expect(imagen()).toHaveClass('h-[30px]', 'w-[30px]')
    expect(screen.queryByTestId('campana-badge')).not.toBeInTheDocument()
  })
  it('encendida y badge con el número, sin tope (120)', async () => {
    server.use(
      http.get('*/api/solicitudes/count', () => HttpResponse.json({ value: 100 })),
      http.get('*/api/solicitudes-stock/count', () => HttpResponse.json({ value: 20 })),
      ...handlersNotificaciones(),
    )
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    const badge = await screen.findByTestId('campana-badge')
    expect(badge).toHaveTextContent('120')
    expect(badge).toHaveClass('pointer-events-none', 'translate-x-[10px]', '-translate-y-[7px]')
    expect(badge.querySelector('img')).toHaveAttribute('src', '/Badge.png')
    expect(screen.getByText('120')).toHaveClass('text-[10px]', 'font-bold', 'text-amarillo')
    expect(imagen()).toHaveAttribute('src', '/NotfON.png')
    expect(campana()).toHaveAttribute('data-encendida', 'true')
  })
  it('fallo al contar: sin aviso y badge como estaba', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones({ urgPend: [solicitudUrgente({ idRc: 501 })], prevPend: [solicitudPreventiva({ idSol: 701 })] }))
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    expect(await screen.findByTestId('campana-badge')).toHaveTextContent('2')
    server.use(http.get('*/api/solicitudes/count', () => HttpResponse.json({ message: 'no' }, { status: 403 })))
    await act(async () => { await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_CONTADOR }) })
    expect(cuantas(gets, '/api/solicitudes/count')).toBe(2)
    expect(screen.getByTestId('campana-badge')).toHaveTextContent('2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('pulso si hay alertas al cargar; el primer clic lo para, abre en Alertas y no vuelve aunque lleguen alertas', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones({ gestionados: [SIN_STOCK] }))
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(campana()).toHaveAttribute('data-pulso', 'true'))
    expect(campana().querySelector('.campana-pulso')).not.toBeNull()
    // Late con total 0: la imagen encendida se fuerza mientras dura el pulso, sin badge
    expect(imagen()).toHaveAttribute('src', '/NotfON.png')
    expect(screen.queryByTestId('campana-badge')).not.toBeInTheDocument()

    await userEvent.click(campana())
    expect(campana()).toHaveAttribute('data-pulso', 'false')
    expect(campana().querySelector('.campana-pulso')).toBeNull()
    expect(pestanaAbierta()).toBe('alertas')
    // Abrir también recarga las alertas de stock: +1 sobre la carga inicial (carga=1, apertura=2).
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2))

    await userEvent.click(campana())
    expect(screen.queryByTestId('panel-notificaciones')).not.toBeInTheDocument()
    // Cerrar no recarga las alertas: sigue en 2.
    expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2)
    await act(async () => { await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_COMPONENTES }) })
    // Antes de que abrir recargara las alertas, aquí se esperaba 2 (carga inicial + esta invalidación manual); ahora la
    // apertura ya sumó una recarga propia, así que la manual la deja en 3.
    expect(cuantas(gets, '/api/componentes/gestionados')).toBe(3)
    expect(campana()).toHaveAttribute('data-pulso', 'false')
    // La segunda apertura ya no es la del pulso
    await userEvent.click(campana())
    expect(pestanaAbierta()).toBe('solicitudes')
  })
  it('abrir el panel recarga también las alertas de stock, mostrando la lista nueva', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones({ gestionados: [SIN_STOCK] }))
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(1))
    const OTRA = componente({ idCom: 205, tipo: 'lcdi15', stock: 0, stockMinimo: 1 })
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json([OTRA])))

    await userEvent.click(campana())
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2))
    expect(pestanaAbierta()).toBe('alertas')
    expect(await screen.findByTestId('tarjeta-alerta-205')).toBeInTheDocument()
    expect(screen.queryByTestId('tarjeta-alerta-102')).not.toBeInTheDocument()
  })
  it('cerrar el panel no recarga las alertas de stock', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(1))
    await userEvent.click(campana())
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2))
    await userEvent.click(campana())
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2)
  })
  it('abrir el panel con alertas nuevas no arranca el pulso si al cargar no había ninguna', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(1))
    expect(campana()).toHaveAttribute('data-pulso', 'false')
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json([SIN_STOCK])))

    await userEvent.click(campana())
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2))
    expect(pestanaAbierta()).toBe('solicitudes')
    await userEvent.click(screen.getByRole('tab', { name: 'Alertas' }))
    expect(await screen.findByTestId('tarjeta-alerta-102')).toBeInTheDocument()
    expect(campana()).toHaveAttribute('data-pulso', 'false')
    expect(campana().querySelector('.campana-pulso')).toBeNull()
  })
  it('sin alertas al cargar no late nunca, aunque aparezcan después; abre en Solicitudes', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBe(1))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json([SIN_STOCK])))
    await act(async () => { await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_COMPONENTES }) })
    expect(cuantas(gets, '/api/componentes/gestionados')).toBe(2)
    expect(campana()).toHaveAttribute('data-pulso', 'false')
    await userEvent.click(campana())
    expect(pestanaAbierta()).toBe('solicitudes')
  })
  it('un fallo al cargar los componentes muestra el error y no hay pulso', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json({ message: 'no' }, { status: 403 })), ...handlersNotificaciones())
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    expect(campana()).toHaveAttribute('data-pulso', 'false')
  })
  it('conmutador: un clic abre y otro cierra; imagen encendida forzada con el panel abierto aunque el total sea 0', async () => {
    server.use(...handlersNotificaciones())
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    expect(campana()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(campana())
    expect(screen.getByTestId('panel-notificaciones')).toBeInTheDocument()
    expect(campana()).toHaveAttribute('aria-expanded', 'true')
    expect(imagen()).toHaveAttribute('src', '/NotfON.png')
    expect(screen.queryByTestId('campana-badge')).not.toBeInTheDocument()
    await userEvent.click(campana())
    expect(screen.queryByTestId('panel-notificaciones')).not.toBeInTheDocument()
    expect(imagen()).toHaveAttribute('src', '/NotifOFF.png')
  })
  it('recuento al abrir y al cerrar el panel', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBe(1))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    await userEvent.click(campana())
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBe(2))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    await userEvent.click(campana())
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBe(3))
    expect(cuantas(gets, '/api/solicitudes-stock/count')).toBe(3)
  })
  it('recuento al volver el foco a la ventana', async () => {
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBe(1))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBe(2))
  })
  it('recuento por intervalo con el panel cerrado; los componentes no se sondean con el panel cerrado', async () => {
    control.intervalo = 40
    const gets = espiarGets()
    server.use(...handlersNotificaciones())
    renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBeGreaterThanOrEqual(3))
    expect(cuantas(gets, '/api/componentes/gestionados')).toBe(1)
  })
})
