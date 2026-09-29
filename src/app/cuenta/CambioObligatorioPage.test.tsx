import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import { leerSesion, type Sesion } from '@/shared/session/storage'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { CambioObligatorioPage } from './CambioObligatorioPage'

const SESION_CON_TEMPORAL: Sesion = { ...SESION_TEC, passwordTemporal: true }

/** Registra los cuerpos de cada PATCH; por defecto responde 204, como el diálogo del menú de usuario. */
function registrarCambio(respuesta: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 })) {
  const cuerpos: unknown[] = []
  server.use(
    http.patch('*/api/auth/cambiar-password', async ({ request }) => {
      cuerpos.push(await request.json())
      return respuesta()
    }),
  )
  return cuerpos
}

function montar() {
  return renderConProviders(<CambioObligatorioPage />, {
    sesion: SESION_CON_TEMPORAL,
    ruta: '/cuenta/cambiar-obligatorio',
    rutas: <Route path="/" element={<p>APLICACIÓN</p>} />,
  })
}

async function rellenar(actual: string, nueva: string, confirmar: string) {
  if (actual) await userEvent.type(screen.getByLabelText('Contraseña actual'), actual)
  if (nueva) await userEvent.type(screen.getByLabelText('Nueva contraseña'), nueva)
  if (confirmar) await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), confirmar)
}

const guardar = () => screen.getByRole('button', { name: 'Guardar' })
const linea = () => screen.getByRole('alert')

describe('CambioObligatorioPage', () => {
  it('explica la situación, no ofrece ninguna salida y pide las tres contraseñas', () => {
    montar()
    expect(screen.getByRole('heading', { name: 'Cambia tu contraseña' })).toBeInTheDocument()
    expect(screen.getByText(/temporal/i)).toBeInTheDocument()
    for (const etiqueta of ['Contraseña actual', 'Nueva contraseña', 'Confirmar nueva contraseña']) {
      expect(screen.getByLabelText(etiqueta)).toHaveAttribute('type', 'password')
    }
    // Ni "Cancelar", ni volver, ni cerrar sesión: de aquí solo se sale cambiándola.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Mostrar contraseña',
      'Mostrar contraseña',
      'Mostrar contraseña',
      'Guardar',
    ])
    expect(screen.queryByText('APLICACIÓN')).not.toBeInTheDocument()
  })

  it('envía la actual y la nueva, quita la marca de la sesión y deja entrar en la aplicación', async () => {
    const cuerpos = registrarCambio()
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await userEvent.click(guardar())
    expect(await screen.findByText('APLICACIÓN')).toBeInTheDocument()
    expect(cuerpos).toEqual([{ passwordActual: 'LaTemporal9', passwordNueva: 'MiClaveNueva1' }])
    expect(leerSesion()?.passwordTemporal).toBe(false)
  })

  it('si las dos nuevas no coinciden no llama al servidor', async () => {
    const cuerpos = registrarCambio()
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'otra')
    await userEvent.click(guardar())
    expect(linea()).toHaveTextContent('Las contraseñas nuevas no coinciden.')
    expect(cuerpos).toHaveLength(0)
    expect(screen.queryByText('APLICACIÓN')).not.toBeInTheDocument()
  })

  it('una nueva demasiado corta tampoco sale de aquí', async () => {
    const cuerpos = registrarCambio()
    montar()
    await rellenar('LaTemporal9', '12345', '12345')
    await userEvent.click(guardar())
    expect(linea()).toHaveTextContent('La contraseña debe tener al menos 6 caracteres.')
    expect(cuerpos).toHaveLength(0)
  })

  it.each([
    [422, () => HttpResponse.json({ message: 'La contraseña actual no es correcta.' }, { status: 422 }), 'La contraseña actual no es correcta.'],
    [429, () => HttpResponse.json({ message: 'Demasiados intentos fallidos. Espera unos segundos y vuelve a intentarlo.' }, { status: 429 }), 'Demasiados intentos fallidos. Espera unos segundos y vuelve a intentarlo.'],
  ])('un %s deja el mensaje del servidor en la línea y la sesión sigue retenida', async (_codigo, respuesta, texto) => {
    registrarCambio(respuesta)
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await userEvent.click(guardar())
    expect(await screen.findByText(texto)).toBe(linea())
    expect(screen.queryByText('APLICACIÓN')).not.toBeInTheDocument()
    expect(leerSesion()?.passwordTemporal).toBe(true)
  })

  it('el corte de conexión lo avisa el mecanismo global, no la línea de la página', async () => {
    registrarCambio(() => new HttpResponse(null, { status: 503 }))
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await userEvent.click(guardar())
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    // Con el diálogo abierto, Radix oculta el resto del documento: la línea de la página se busca incluyéndolo.
    expect(screen.getByRole('alert', { hidden: true })).toBeEmptyDOMElement()
  })

  it('dos clics seguidos en Guardar envían una sola vez', async () => {
    const cuerpos = registrarCambio(async () => { await delay(20); return new HttpResponse(null, { status: 204 }) })
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    fireEvent.click(guardar())
    fireEvent.click(guardar())
    expect(await screen.findByText('APLICACIÓN')).toBeInTheDocument()
    expect(cuerpos).toHaveLength(1)
  })
})
