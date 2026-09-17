import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { enlacesReparaciones, InicioReparaciones, RequiereTecnico } from './rutas'

const destinos = (
  <>
    <Route path="/reparaciones/pendientes" element={<p>PENDIENTES</p>} />
    <Route path="/reparaciones/historial" element={<p>HISTORIAL</p>} />
  </>
)

/** RequiereTecnico es una ruta de layout (envuelve con <Outlet/>, como en router.tsx). renderConProviders
 *  solo añade `rutas` como hermanas de la ruta protegida, nunca como hijas, así que con ese helper el
 *  <Outlet/> nunca tendría nada que renderizar (se probó: da un contenedor vacío). Para comprobar de verdad
 *  que el técnico atraviesa el guard hace falta anidar la ruta protegida como hija suya de verdad. */
function montarRequiereTecnico(sesion: typeof SESION_ADMIN) {
  guardarSesion(sesion)
  const qc = crearQueryClient({ retry: false })
  render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/reparaciones/pendientes']}>
          <Routes>
            <Route element={<RequiereTecnico />}>
              <Route path="/reparaciones/pendientes" element={<p>PROTEGIDO</p>} />
            </Route>
            <Route path="/reparaciones/historial" element={<p>HISTORIAL</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

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
    montarRequiereTecnico(SESION_ADMIN)
    expect(screen.getByText('HISTORIAL')).toBeInTheDocument()
    montarRequiereTecnico(SESION_TEC)
    expect(screen.getByText('PROTEGIDO')).toBeInTheDocument()
  })
  it('enlaces de la columna por rol, en el orden del JavaFX', () => {
    expect(enlacesReparaciones(SESION_TEC).map((e) => e.label)).toEqual(['Pendientes', 'Historial', 'IMEIs'])
    expect(enlacesReparaciones(SESION_SUPER).map((e) => e.label)).toEqual(['Asignaciones', 'Pendientes', 'Historial', 'IMEIs'])
    expect(enlacesReparaciones(SESION_ADMIN).map((e) => e.label)).toEqual(['Asignaciones', 'Historial', 'IMEIs'])
    expect(enlacesReparaciones(SESION_TEC)[0].badge).toBe('pendientes')
  })
})
