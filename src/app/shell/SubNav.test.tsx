import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderConProviders, SESION_TEC } from '@/test/render'
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
    renderConProviders(<SubNav />, { ruta: '/reparaciones' })
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
})
