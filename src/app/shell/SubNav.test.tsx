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
    const columna = screen.getByRole('complementary')
    expect(within(columna).queryAllByRole('link')).toHaveLength(0)
  })

  it('el shell la coloca junto al contenido en todas las vistas', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/gestion/logs' })
    expect(screen.getByRole('complementary')).toBeInTheDocument()
  })
})
