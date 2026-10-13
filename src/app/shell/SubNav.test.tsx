import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import { server } from '@/test/server'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { AppLayout } from './AppLayout'
import { SubNav } from './SubNav'
import { CLAVE_PLEGADA } from './preferencias'

describe('columna lateral de sub-navegación', () => {
  it('en /clientes muestra el enlace "Clientes" marcado como activo', () => {
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    const enlace = screen.getByRole('link', { name: 'Clientes' })
    expect(enlace).toHaveAttribute('href', '/clientes')
    expect(enlace).toHaveAttribute('aria-current', 'page')
  })

  it('en una sección sin enlaces no pinta la columna: el contenido usa todo el ancho (0.9.10)', () => {
    renderConProviders(<SubNav />, { ruta: '/estadisticas' })
    expect(screen.queryByRole('navigation', { name: 'Sub-navegación' })).not.toBeInTheDocument()
  })

  it('en Stock pinta las tres entradas del sidebar del JavaFX, para cualquier rol, con la activa marcada', () => {
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/stock/proveedores' })
    const columna = within(screen.getByRole('navigation', { name: 'Sub-navegación' }))
    expect(columna.getAllByRole('link').map((l) => l.textContent)).toEqual(['Stock actual', 'Pedidos', 'Proveedores'])
    expect(columna.getByRole('link', { name: 'Stock actual' })).toHaveAttribute('href', '/stock')
    expect(columna.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/stock/pedidos')
    expect(columna.getByRole('link', { name: 'Proveedores' })).toHaveAttribute('aria-current', 'page')
    expect(columna.getByRole('link', { name: 'Stock actual' })).not.toHaveAttribute('aria-current')
  })
  it('"Stock actual" solo está activo en /stock exacto (NavLink end), no en /stock/pedidos', () => {
    renderConProviders(<SubNav />, { sesion: SESION_ADMIN, ruta: '/stock/pedidos' })
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Stock actual' })).not.toHaveAttribute('aria-current')
  })

  it.each([
    ['/stock', ['Stock actual', 'Pedidos', 'Proveedores']],
    ['/clientes', ['Clientes']],
  ])('en %s cada enlace lleva su icono delante del nombre, decorativo (0.9.10)', (ruta, nombres) => {
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta })
    const columna = within(screen.getByRole('navigation', { name: 'Sub-navegación' }))
    for (const nombre of nombres) {
      const enlace = columna.getByRole('link', { name: nombre })
      const icono = enlace.querySelector('svg')
      expect(icono).not.toBeNull()
      expect(icono).toHaveAttribute('aria-hidden', 'true')
      expect(enlace.firstElementChild).toBe(icono)
      expect(enlace.textContent).toBe(nombre)
    }
  })

  // El mapa de secciones es un objeto plano: leerlo con `SUBNAV[seccion]` devuelve los miembros heredados de
  // Object.prototype, así que una ruta como /constructor daría una función en vez de un array y `.map`
  // reventaría. Es alcanzable: el catch-all `*` del router está dentro de AppLayout, de modo que SubNav se
  // pinta una vez con la ruta original antes de que el <Navigate> redirija.
  it.each(['/constructor', '/__proto__', '/toString'])(
    'una sección que se llama como un miembro heredado de Object (%s) no pinta la columna y no rompe',
    (ruta) => {
      renderConProviders(<SubNav />, { ruta })
      expect(screen.queryByRole('navigation', { name: 'Sub-navegación' })).not.toBeInTheDocument()
    },
  )

  it('el shell la coloca junto al contenido', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toBeInTheDocument()
  })

  it('en Gestión el shell no pinta la columna (0.9.10)', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_ADMIN, ruta: '/gestion/logs' })
    expect(screen.queryByRole('navigation', { name: 'Sub-navegación' })).not.toBeInTheDocument()
  })

  it('usa el blanco de superficie del sistema de tokens', () => {
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toHaveClass('bg-superficie')
  })

  it('en Reparaciones pinta los enlaces del rol y el badge de Pendientes con tope 99+', async () => {
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 90, glass: 10, pulidos: 5 })))
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass' })
    const pendientes = screen.getByRole('link', { name: /Pendientes/ })
    expect(pendientes).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByText('99+')).toHaveClass('bg-superficie', 'text-azul-noche')
    expect(screen.getByRole('link', { name: 'IMEIs' })).toHaveAttribute('href', '/reparaciones/imeis')
    expect(screen.queryByRole('link', { name: 'Asignaciones' })).not.toBeInTheDocument()
  })
  it('el badge no se pinta a cero', async () => {
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })))
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    expect(screen.getByRole('link', { name: 'Asignaciones' })).toHaveAttribute('href', '/reparaciones/asignaciones')
    await screen.findByRole('link', { name: 'Pendientes' })
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
  it('el badge va navy sobre el enlace inactivo', async () => {
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 5, glass: 2, pulidos: 1 })))
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    const pendientes = await screen.findByRole('link', { name: /Pendientes/ })
    expect(pendientes).not.toHaveAttribute('aria-current', 'page')
    expect(await screen.findByText('8')).toHaveClass('bg-azul-noche', 'text-superficie')
  })
})

/** Filas mínimas para el total: el badge solo cuenta, así que basta con el id. */
const filas = (prefijo: string, n: number) => Array.from({ length: n }, (_, i) => ({ idRep: `${prefijo}20260901_${i + 1}` }))

/** Las tres listas de asignaciones (sin ?tecnico=) con n filas cada una; cuenta las cargas por la de reparaciones. */
function asignaciones(rep: number, glass: number, pul: number) {
  const cargas = { n: 0 }
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => {
      cargas.n += 1
      return HttpResponse.json(filas('A', rep))
    }),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json(filas('AG', glass))),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json(filas('AP', pul))),
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })),
  )
  return cargas
}

const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

/** Calco de ReparacionControllerSuperTecnico.actualizarBadges: lblBadgeAsignaciones = getTotalItems() de la tabla
 *  unificada (rep + glass + pulido, sin filtros), con el setBadge de siempre (oculto a cero, tope 99+). */
describe('badge de Asignaciones en el lateral del supertécnico', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pinta el total de las tres categorías, navy sobre el enlace inactivo', async () => {
    asignaciones(2, 1, 1)
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    const enlace = screen.getByRole('link', { name: /Asignaciones/ })
    expect(await within(enlace).findByText('4')).toHaveClass('bg-azul-noche', 'text-superficie')
  })

  it('con tope 99+', async () => {
    asignaciones(60, 30, 15)
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    expect(await within(screen.getByRole('link', { name: /Asignaciones/ })).findByText('99+')).toBeInTheDocument()
  })

  it('a cero no se pinta', async () => {
    const cargas = asignaciones(0, 0, 0)
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    await waitFor(() => expect(cargas.n).toBe(1))
    expect(screen.getByRole('link', { name: 'Asignaciones' }).textContent).toBe('Asignaciones')
  })

  it('el ADMIN no lo ve ni pide las listas (spec §12)', async () => {
    const cargas = asignaciones(2, 1, 1)
    renderConProviders(<SubNav />, { sesion: SESION_ADMIN, ruta: '/reparaciones/historial' })
    expect(screen.getByRole('link', { name: 'Asignaciones' }).textContent).toBe('Asignaciones')
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(cargas.n).toBe(0)
  })

  it('fuera de Asignaciones se mantiene fresco con el sondeo general (60 s)', async () => {
    const cargas = asignaciones(2, 1, 1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    await waitFor(() => expect(cargas.n).toBe(1))
    await avanzar(INTERVALO_CONECTADO_MS)
    await waitFor(() => expect(cargas.n).toBe(2))
  })

  it('en Asignaciones va invertido y no sondea por su cuenta: el ritmo (y el congelado D4) lo lleva la vista', async () => {
    const cargas = asignaciones(2, 1, 1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })
    const enlace = screen.getByRole('link', { name: /Asignaciones/ })
    expect(await within(enlace).findByText('4')).toHaveClass('bg-superficie', 'text-azul-noche')
    expect(cargas.n).toBe(1)
    await avanzar(INTERVALO_CONECTADO_MS * 2)
    expect(cargas.n).toBe(1)
  })
})

/** Columna plegable (0.9.10, spec «Columna lateral plegable» §2): el botón redondo del borde la pliega a una franja de
 *  iconos de 56 px y la despliega; el navegador recuerda cómo se dejó. */
describe('plegar la columna lateral', () => {
  it('abierta: 200 px, con los nombres y el botón «Ocultar menú lateral»', () => {
    renderConProviders(<SubNav />, { ruta: '/stock' })
    const columna = screen.getByRole('navigation', { name: 'Sub-navegación' })
    expect(columna).toHaveClass('w-[200px]')
    const boton = screen.getByRole('button', { name: 'Ocultar menú lateral' })
    expect(boton).toHaveAttribute('title', 'Ocultar menú lateral')
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(boton).toHaveAttribute('aria-controls', columna.id)
    expect(within(columna).getByRole('link', { name: 'Pedidos' }).textContent).toBe('Pedidos')
  })

  it('el botón la pliega a la franja de iconos, lo guarda y la vuelve a desplegar', async () => {
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { ruta: '/stock/pedidos' })
    const columna = screen.getByRole('navigation', { name: 'Sub-navegación' })

    await user.click(screen.getByRole('button', { name: 'Ocultar menú lateral' }))
    expect(columna).toHaveClass('w-14')
    const pedidos = within(columna).getByRole('link', { name: 'Pedidos' })
    expect(pedidos.textContent).toBe('')
    expect(pedidos.querySelector('svg')).not.toBeNull()
    expect(pedidos).toHaveAttribute('aria-current', 'page')
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('si')
    const boton = screen.getByRole('button', { name: 'Mostrar menú lateral' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')

    await user.click(boton)
    expect(columna).toHaveClass('w-[200px]')
    expect(within(columna).getByRole('link', { name: 'Pedidos' }).textContent).toBe('Pedidos')
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('no')
  })

  it('arranca plegada si el navegador lo recuerda', () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toHaveClass('w-14')
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Mostrar menú lateral' })).toBeInTheDocument()
  })

  it('anima el ancho, salvo si el sistema pide reducir movimiento', () => {
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toHaveClass('transition-[width]', 'motion-reduce:transition-none')
  })

  it('en una sección sin enlaces tampoco hay botón', () => {
    renderConProviders(<SubNav />, { ruta: '/estadisticas' })
    expect(screen.queryByRole('button', { name: /menú lateral/ })).not.toBeInTheDocument()
  })
})
