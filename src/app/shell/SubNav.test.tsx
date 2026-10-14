import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import { server } from '@/test/server'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { AppLayout } from './AppLayout'
import { SubNav } from './SubNav'
import { CLAVE_GRUPOS_PLEGADOS, CLAVE_PLEGADA } from './preferencias'

const columna = () => within(screen.getByRole('navigation', { name: 'Sub-navegación' }))
/** Cabecera de un grupo: su nombre accesible empieza por el título (plegado, le sigue la suma de sus números). */
const cabecera = (titulo: string) => screen.getByRole('button', { name: new RegExp(`^${titulo}`) })
const CABECERAS = /^(Reparaciones|Stock|Estadísticas|Clientes|Gestión)/

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

/** Navegación por grupos (0.9.14, spec «Navegación por grupos»): toda la navegación en la columna. */
describe('columna lateral por grupos', () => {
  it('en cualquier ruta salen todos los grupos del rol, en orden, con sus pestañas', () => {
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/estadisticas' })
    expect(columna().getAllByRole('button', { name: CABECERAS }).map((b) => b.textContent)).toEqual(['Reparaciones', 'Stock', 'Estadísticas', 'Clientes'])
    expect(columna().getAllByRole('link').map((l) => l.textContent)).toEqual(['Pendientes', 'Historial', 'IMEIs', 'Stock actual', 'Pedidos', 'Proveedores', 'Rendimiento', 'Listado'])
    expect(columna().getByRole('link', { name: 'Rendimiento' })).toHaveAttribute('aria-current', 'page')
  })

  it('el admin tiene además Gestión, y en /gestion/logs la columna sigue con Logs marcado', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_ADMIN, ruta: '/gestion/logs' })
    expect(cabecera('Gestión')).toBeInTheDocument()
    expect(columna().getByRole('link', { name: 'Logs' })).toHaveAttribute('aria-current', 'page')
    expect(columna().getByRole('link', { name: 'Técnicos' })).toHaveAttribute('href', '/gestion/tecnicos')
  })

  it('el supertécnico no tiene Gestión', () => {
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/stock' })
    expect(screen.queryAllByRole('button', { name: /^Gestión/ })).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Técnicos' })).not.toBeInTheDocument()
  })

  it('"Stock actual" solo está activo en /stock exacto (NavLink end), no en /stock/pedidos', () => {
    renderConProviders(<SubNav />, { sesion: SESION_ADMIN, ruta: '/stock/pedidos' })
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Stock actual' })).not.toHaveAttribute('aria-current')
  })

  it('cada enlace lleva su icono delante del nombre, decorativo', () => {
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/stock' })
    for (const nombre of ['Stock actual', 'Pedidos', 'Proveedores', 'Rendimiento', 'Listado']) {
      const enlace = columna().getByRole('link', { name: nombre })
      const icono = enlace.querySelector('svg')
      expect(icono).not.toBeNull()
      expect(icono).toHaveAttribute('aria-hidden', 'true')
      expect(enlace.firstElementChild).toBe(icono)
      expect(enlace.textContent).toBe(nombre)
    }
  })

  it('el shell la coloca junto al contenido en todas las vistas, también en Estadísticas', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/estadisticas' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toBeInTheDocument()
  })

  it('usa el blanco de superficie del sistema de tokens', () => {
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toHaveClass('bg-superficie')
  })
})

describe('grupos plegables', () => {
  it('la cabecera pliega su grupo sin navegar, lo recuerda y lo despliega', async () => {
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/clientes' })
    const stock = cabecera('Stock')
    expect(stock).toHaveAttribute('aria-expanded', 'true')
    expect(stock).toHaveAttribute('aria-controls', 'columna-lateral-stock')
    await user.click(stock)
    expect(stock).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Pedidos' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Listado' })).toHaveAttribute('aria-current', 'page')
    expect(JSON.parse(localStorage.getItem(CLAVE_GRUPOS_PLEGADOS) ?? 'null')).toEqual(['stock'])
    await user.click(stock)
    expect(screen.getByRole('link', { name: 'Pedidos' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CLAVE_GRUPOS_PLEGADOS) ?? 'null')).toEqual([])
  })

  it('arranca con los grupos que el navegador recuerda plegados', () => {
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '["reparaciones"]')
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/stock' })
    expect(cabecera('Reparaciones')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Historial' })).not.toBeInTheDocument()
  })

  it('plegado, el grupo enseña en su cabecera la suma de sus números', async () => {
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '["reparaciones"]')
    asignaciones(2, 1, 1)
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 2, glass: 1, pulidos: 0 })))
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/stock' })
    expect(await within(cabecera('Reparaciones')).findByText('7')).toHaveClass('bg-azul-noche', 'text-superficie')
  })

  it('plegado con la página actual dentro, la cabecera va en navy', () => {
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '["stock","clientes"]')
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/stock/pedidos' })
    expect(cabecera('Stock')).toHaveClass('text-azul-noche')
    expect(cabecera('Clientes')).toHaveClass('text-azul-gris')
  })

  it('los números de Pendientes y Asignaciones se ven estando en Stock', async () => {
    asignaciones(2, 1, 1)
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 5, glass: 0, pulidos: 0 })))
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/stock' })
    expect(await within(screen.getByRole('link', { name: /Asignaciones/ })).findByText('4')).toBeInTheDocument()
    expect(await within(screen.getByRole('link', { name: /Pendientes/ })).findByText('5')).toBeInTheDocument()
  })
})

describe('número de Pendientes en la columna', () => {
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

/** Columna plegable (0.9.10): el botón redondo del borde la pliega a 56 px y la despliega; el navegador lo recuerda. */
describe('plegar la columna lateral', () => {
  it('abierta: 200 px, con los nombres y el botón «Ocultar menú lateral»', () => {
    renderConProviders(<SubNav />, { ruta: '/stock' })
    const nav = screen.getByRole('navigation', { name: 'Sub-navegación' })
    expect(nav).toHaveClass('w-[200px]')
    const boton = screen.getByRole('button', { name: 'Ocultar menú lateral' })
    expect(boton).toHaveAttribute('title', 'Ocultar menú lateral')
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(boton).toHaveAttribute('aria-controls', nav.id)
    expect(within(nav).getByRole('link', { name: 'Pedidos' }).textContent).toBe('Pedidos')
  })

  it('el botón la pliega a la franja de iconos, lo guarda y la vuelve a desplegar', async () => {
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { ruta: '/stock/pedidos' })
    const nav = screen.getByRole('navigation', { name: 'Sub-navegación' })

    await user.click(screen.getByRole('button', { name: 'Ocultar menú lateral' }))
    expect(nav).toHaveClass('w-14')
    const pedidos = within(nav).getByRole('link', { name: 'Stock · Pedidos' })
    expect(pedidos.textContent).toBe('')
    expect(pedidos.querySelector('svg')).not.toBeNull()
    expect(pedidos).toHaveAttribute('aria-current', 'page')
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('si')
    const boton = screen.getByRole('button', { name: 'Mostrar menú lateral' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')

    await user.click(boton)
    expect(nav).toHaveClass('w-[200px]')
    expect(within(nav).getByRole('link', { name: 'Pedidos' }).textContent).toBe('Pedidos')
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('no')
  })

  it('plegada: sin cabeceras, todos los iconos (también los de grupos plegados) y una línea entre grupos', () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    localStorage.setItem(CLAVE_GRUPOS_PLEGADOS, '["stock"]')
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    const nav = screen.getByRole('navigation', { name: 'Sub-navegación' })
    expect(within(nav).queryAllByRole('button', { name: CABECERAS })).toHaveLength(0)
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual([
      'Reparaciones · Historial',
      'Reparaciones · IMEIs',
      'Stock · Stock actual',
      'Stock · Pedidos',
      'Stock · Proveedores',
      'Estadísticas · Rendimiento',
      'Clientes · Listado',
    ])
    expect(nav.querySelectorAll('div[aria-hidden="true"].h-px')).toHaveLength(3)
  })

  it('arranca plegada si el navegador lo recuerda', () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toHaveClass('w-14')
    expect(screen.getByRole('link', { name: 'Clientes · Listado' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Mostrar menú lateral' })).toBeInTheDocument()
  })

  it('anima el ancho, salvo si el sistema pide reducir movimiento', () => {
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toHaveClass('transition-[width]', 'motion-reduce:transition-none')
  })

  it('plegar y desplegar no remonta los enlaces', async () => {
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { ruta: '/stock' })
    const antes = screen.getByRole('link', { name: 'Pedidos' })
    await user.click(screen.getByRole('button', { name: 'Ocultar menú lateral' }))
    expect(screen.getByRole('link', { name: 'Stock · Pedidos' })).toBe(antes)
    await user.click(screen.getByRole('button', { name: 'Mostrar menú lateral' }))
    expect(screen.getByRole('link', { name: 'Pedidos' })).toBe(antes)
  })

  it('plegar no vuelve a pedir los números', async () => {
    const user = userEvent.setup()
    const cargas = asignaciones(2, 1, 1)
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    await waitFor(() => expect(cargas.n).toBe(1))
    await user.click(screen.getByRole('button', { name: 'Ocultar menú lateral' }))
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(cargas.n).toBe(1)
  })
})

/** Plegada: los números siguen cada uno en su icono, compactos, y el nombre «Grupo · Pestaña» sale al pasar el ratón o al
 *  llegar con el teclado. */
describe('columna lateral plegada: números y nombre de cada icono', () => {
  it('los números de Asignaciones y Pendientes siguen, compactos en la esquina del icono y con sus colores', async () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    asignaciones(2, 1, 1)
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 90, glass: 10, pulidos: 5 })))
    renderConProviders(<SubNav />, { sesion: SESION_SUPER, ruta: '/reparaciones/pendientes' })
    const asig = screen.getByRole('link', { name: 'Reparaciones · Asignaciones' })
    expect(await within(asig).findByText('4')).toHaveClass('absolute', 'bg-azul-noche', 'text-superficie')
    const pend = screen.getByRole('link', { name: 'Reparaciones · Pendientes' })
    expect(await within(pend).findByText('99+')).toHaveClass('absolute', 'bg-superficie', 'text-azul-noche')
  })

  it('abierta, el número sigue detrás del nombre, como antes', async () => {
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 1, glass: 1, pulidos: 1 })))
    renderConProviders(<SubNav />, { sesion: SESION_TEC, ruta: '/reparaciones/historial' })
    const numero = await within(screen.getByRole('link', { name: /Pendientes/ })).findByText('3')
    expect(numero).toHaveClass('ml-2')
    expect(numero).not.toHaveClass('absolute')
  })

  it('al pasar el ratón por un icono sale «Grupo · Pestaña»', async () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { ruta: '/stock' })
    await user.hover(screen.getByRole('link', { name: 'Stock · Proveedores' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Stock · Proveedores')
  })

  it('también al llegar con el teclado', async () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    renderConProviders(<SubNav />, { ruta: '/stock' })
    act(() => screen.getByRole('link', { name: 'Stock · Pedidos' }).focus())
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Stock · Pedidos')
  })

  it('al quitar el ratón del icono el nombre se va (no tapa el botón de la columna)', async () => {
    localStorage.setItem(CLAVE_PLEGADA, 'si')
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { ruta: '/stock' })
    const enlace = screen.getByRole('link', { name: 'Stock · Proveedores' })
    await user.hover(enlace)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Stock · Proveedores')
    await user.unhover(enlace)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })

  it('abierta no hay tooltip: el nombre ya se ve', async () => {
    const user = userEvent.setup()
    renderConProviders(<SubNav />, { ruta: '/stock' })
    await user.hover(screen.getByRole('link', { name: 'Proveedores' }))
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
