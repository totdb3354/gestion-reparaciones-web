import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { leerSesion } from '@/shared/session/storage'
import { onSesionExpirada } from '@/shared/session/expiracion'
import { useSession } from '@/shared/session/SessionProvider'
import { LoginPage } from './LoginPage'

/** Expone en cada render el `sesion` actual del contexto, para comprobar que el estado de React (no solo
 *  el storage) queda a null tras un login fallido con una sesión previa. */
function ProbeSesion({ exponer }: { exponer: (sesion: ReturnType<typeof useSession>['sesion']) => void }) {
  exponer(useSession().sesion)
  return null
}

const respuestaLogin = { idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super' }

function montar() {
  return renderConProviders(<LoginPage />, { ruta: '/login', rutas: <Route path="/" element={<p>INICIO</p>} /> })
}

describe('LoginPage', () => {
  it('calca la pantalla: título, subtítulo, campos y botón', () => {
    montar()
    expect(screen.getByText('FSGR')).toBeInTheDocument()
    expect(screen.getByText('Gestión de Stock y')).toBeInTheDocument()
    expect(screen.getByText('Reparaciones')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Usuario')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument()
  })
  it('con campos vacíos no llama a la API y avisa', async () => {
    let llamadas = 0
    server.use(http.post('*/api/auth/login', () => { llamadas++; return HttpResponse.json(respuestaLogin) }))
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(llamadas).toBe(0)
    expect(screen.getByText('Introduce usuario y contraseña.')).toBeInTheDocument()
  })
  it('login correcto guarda la sesión y navega a /', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(respuestaLogin)))
    montar()
    await userEvent.type(screen.getByPlaceholderText('Usuario'), 'tecnico_f')
    await userEvent.type(screen.getByPlaceholderText('Contraseña'), 'secreta{enter}')
    await waitFor(() => expect(screen.getByText('INICIO')).toBeInTheDocument())
    expect(leerSesion()?.token).toBe('jwt-super')
  })
  it('401 muestra "Usuario o contraseña incorrectos." y no guarda sesión', async () => {
    server.use(http.post('*/api/auth/login', () => new HttpResponse(null, { status: 401 })))
    montar()
    await userEvent.type(screen.getByPlaceholderText('Usuario'), 'tecnico_f')
    await userEvent.type(screen.getByPlaceholderText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument()
    expect(leerSesion()).toBeNull()
  })
  it('con una sesión vieja guardada, un 401 del login no dispara la expiración de sesión y limpia el estado', async () => {
    const expirada = vi.fn()
    onSesionExpirada(expirada)
    server.use(http.post('*/api/auth/login', () => new HttpResponse(null, { status: 401 })))
    let sesionActual: ReturnType<typeof useSession>['sesion'] = undefined as never
    renderConProviders(
      <>
        <LoginPage />
        <ProbeSesion exponer={(s) => { sesionActual = s }} />
      </>,
      { sesion: SESION_TEC, ruta: '/login', rutas: <Route path="/" element={<p>INICIO</p>} /> },
    )
    expect(sesionActual).not.toBeNull()
    await userEvent.type(screen.getByPlaceholderText('Usuario'), 'tecnico_n')
    await userEvent.type(screen.getByPlaceholderText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument()
    expect(expirada).not.toHaveBeenCalled()
    expect(leerSesion()).toBeNull()
    // No solo el storage: el contexto de React también debe quedar sin sesión (si no, una ruta protegida
    // seguiría considerando al usuario autenticado con la sesión vieja hasta el siguiente render externo).
    expect(sesionActual).toBeNull()
  })
  it('un fallo de red reintenta una vez y si vuelve a fallar muestra el mensaje de conexión', async () => {
    let intentos = 0
    server.use(http.post('*/api/auth/login', () => { intentos++; return HttpResponse.error() }))
    montar()
    await userEvent.type(screen.getByPlaceholderText('Usuario'), 'tecnico_f')
    await userEvent.type(screen.getByPlaceholderText('Contraseña'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(await screen.findByText(/Sin conexión con el servidor/)).toBeInTheDocument()
    expect(intentos).toBe(2)
  })
  it('el ojo alterna la visibilidad de la contraseña', async () => {
    montar()
    const pass = screen.getByPlaceholderText('Contraseña')
    expect(pass).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(pass).toHaveAttribute('type', 'text')
  })
})
