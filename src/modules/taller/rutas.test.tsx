import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { renderConProviders, renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { enlacesReparaciones, InicioReparaciones, RequiereSupertecnico, RequiereSupertecnicoOAdmin, RequiereTecnico } from './rutas'

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
    // El badge de Asignaciones es solo del supertécnico: para el ADMIN desaparece (spec 3a §12).
    expect(enlacesReparaciones(SESION_SUPER)[0].badge).toBe('asignaciones')
    expect(enlacesReparaciones(SESION_ADMIN)[0].badge).toBeUndefined()
  })
  it('RequiereSupertecnico: TECNICO y ADMIN por URL reciben el aviso genérico y vuelven a la lista; el supertécnico pasa', async () => {
    const rutas = [
      { path: '/reparaciones/historial', element: <><p>HISTORIAL</p><Outlet /></>, children: [{ element: <RequiereSupertecnico />, children: [{ path: 'editar/:idRep', element: <p>FORMULARIO</p> }] }] },
      { path: '/reparaciones/historial/glass', element: <><p>HISTORIAL GLASS</p><Outlet /></>, children: [{ element: <RequiereSupertecnico />, children: [{ path: 'editar/:idRep', element: <p>FORMULARIO</p> }] }] },
      { path: '/reparaciones/imeis/:imei', element: <><p>DETALLE IMEI</p><Outlet /></>, children: [{ element: <RequiereSupertecnico />, children: [{ path: 'editar/:idRep', element: <p>FORMULARIO</p> }] }] },
    ]
    const tec = renderConRouter(rutas, { sesion: SESION_TEC, ruta: '/reparaciones/historial/editar/R20260916_5' })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    expect(tec.router.state.location.pathname).toBe('/reparaciones/historial')
    expect(screen.queryByText('FORMULARIO')).not.toBeInTheDocument()
    tec.unmount()

    const admin = renderConRouter(rutas, { sesion: SESION_ADMIN, ruta: '/reparaciones/imeis/351900000000041/editar/G20260912_1' })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    expect(admin.router.state.location.pathname).toBe('/reparaciones/imeis/351900000000041')
    admin.unmount()

    const glass = renderConRouter(rutas, { sesion: SESION_TEC, ruta: '/reparaciones/historial/glass/editar/G20260912_1' })
    await screen.findByRole('dialog', { name: 'Error' })
    expect(glass.router.state.location.pathname).toBe('/reparaciones/historial/glass')
    glass.unmount()

    renderConRouter(rutas, { sesion: SESION_SUPER, ruta: '/reparaciones/historial/editar/R20260916_5' })
    expect(await screen.findByText('FORMULARIO')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
  })
  it('RequiereSupertecnicoOAdmin: pasan supertécnico y admin; el TECNICO por URL recibe el aviso y sale a /reparaciones', async () => {
    const rutas = [
      { element: <RequiereSupertecnicoOAdmin />, children: [{ path: '/reparaciones/asignaciones', element: <p>ASIGNACIONES</p> }] },
      { path: '/reparaciones', element: <p>INICIO POR ROL</p> },
    ]
    const tec = renderConRouter(rutas, { sesion: SESION_TEC, ruta: '/reparaciones/asignaciones' })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    expect(tec.router.state.location.pathname).toBe('/reparaciones')
    expect(screen.queryByText('ASIGNACIONES')).not.toBeInTheDocument()
    tec.unmount()

    const superTec = renderConRouter(rutas, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })
    expect(await screen.findByText('ASIGNACIONES')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
    superTec.unmount()

    renderConRouter(rutas, { sesion: SESION_ADMIN, ruta: '/reparaciones/asignaciones' })
    expect(await screen.findByText('ASIGNACIONES')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
  })
})
