import { screen } from '@testing-library/react'
import { Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { enlacesReparaciones, InicioReparaciones, RequiereTecnico } from './rutas'

const destinos = (
  <>
    <Route path="/reparaciones/pendientes" element={<p>PENDIENTES</p>} />
    <Route path="/reparaciones/historial" element={<p>HISTORIAL</p>} />
  </>
)

describe('rutas del taller', () => {
  it('/reparaciones entra en Pendientes para el técnico y en Historial para supertécnico y admin', () => {
    renderConProviders(<InicioReparaciones />, { sesion: SESION_TEC, ruta: '/reparaciones', rutas: destinos })
    expect(screen.getByText('PENDIENTES')).toBeInTheDocument()
    renderConProviders(<InicioReparaciones />, { sesion: SESION_SUPER, ruta: '/reparaciones', rutas: destinos })
    expect(screen.getByText('HISTORIAL')).toBeInTheDocument()
    renderConProviders(<InicioReparaciones />, { sesion: SESION_ADMIN, ruta: '/reparaciones', rutas: destinos })
    expect(screen.getAllByText('HISTORIAL')).toHaveLength(2)
  })
  it('RequiereTecnico deja pasar a quien tiene técnico y manda al admin a Historial', () => {
    renderConProviders(<RequiereTecnico />, {
      sesion: SESION_ADMIN,
      ruta: '/reparaciones/pendientes',
      rutas: <><Route path="/reparaciones/pendientes" element={<p>PROTEGIDO</p>} /><Route path="/reparaciones/historial" element={<p>HISTORIAL</p>} /></>,
    })
    expect(screen.getByText('HISTORIAL')).toBeInTheDocument()
  })
  it('enlaces de la columna por rol, en el orden del JavaFX', () => {
    expect(enlacesReparaciones(SESION_TEC).map((e) => e.label)).toEqual(['Pendientes', 'Historial', 'IMEIs'])
    expect(enlacesReparaciones(SESION_SUPER).map((e) => e.label)).toEqual(['Asignaciones', 'Pendientes', 'Historial', 'IMEIs'])
    expect(enlacesReparaciones(SESION_ADMIN).map((e) => e.label)).toEqual(['Asignaciones', 'Historial', 'IMEIs'])
    expect(enlacesReparaciones(SESION_TEC)[0].badge).toBe('pendientes')
  })
})
