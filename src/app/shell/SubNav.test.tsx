import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { AppLayout } from './AppLayout'
import { SubNav } from './SubNav'

describe('columna lateral de sub-navegación', () => {
  it('en /clientes muestra el enlace "Clientes" marcado como activo', () => {
    renderConProviders(<SubNav />, { ruta: '/clientes' })
    const enlace = screen.getByRole('link', { name: 'Clientes' })
    expect(enlace).toHaveAttribute('href', '/clientes')
    expect(enlace).toHaveAttribute('aria-current', 'page')
  })

  it('en una sección todavía sin enlaces mantiene la columna vacía', () => {
    renderConProviders(<SubNav />, { ruta: '/stock' })
    const columna = screen.getByRole('navigation', { name: 'Sub-navegación' })
    expect(within(columna).queryAllByRole('link')).toHaveLength(0)
  })

  // El mapa de secciones es un objeto plano: leerlo con `SUBNAV[seccion]` devuelve los miembros heredados de
  // Object.prototype, así que una ruta como /constructor daría una función en vez de un array y `.map`
  // reventaría. Es alcanzable: el catch-all `*` del router está dentro de AppLayout, de modo que SubNav se
  // pinta una vez con la ruta original antes de que el <Navigate> redirija.
  it.each(['/constructor', '/__proto__', '/toString'])(
    'una sección que se llama como un miembro heredado de Object (%s) deja la columna vacía sin romper',
    (ruta) => {
      renderConProviders(<SubNav />, { ruta })
      const columna = screen.getByRole('navigation', { name: 'Sub-navegación' })
      expect(within(columna).queryAllByRole('link')).toHaveLength(0)
    },
  )

  it('el shell la coloca junto al contenido en todas las vistas', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/gestion/logs' })
    expect(screen.getByRole('navigation', { name: 'Sub-navegación' })).toBeInTheDocument()
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
