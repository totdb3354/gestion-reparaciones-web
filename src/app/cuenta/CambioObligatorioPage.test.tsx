import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AVISO_MS, CLAVE_ACTIVIDAD, INACTIVIDAD_MS } from '@/shared/session/actividad'
import { leerSesion, type Sesion } from '@/shared/session/storage'
import { MSG_AVISO_TITULO } from '@/shared/session/VigilanciaInactividad'
import { renderConProviders, SESION_ADMIN, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { CambioObligatorioPage, EXPLICACION } from './CambioObligatorioPage'

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
    expect(screen.getByText(EXPLICACION)).toBeInTheDocument()
    for (const etiqueta of ['Contraseña actual', 'Nueva contraseña', 'Confirmar nueva contraseña']) {
      expect(screen.getByLabelText(etiqueta)).toHaveAttribute('type', 'password')
    }
    // Ni "Cancelar" ni volver: no se puede SALTAR el cambio. "Cerrar sesión" si esta, porque no lo salta (la barrera la
    // pone el servidor y al reentrar la marca vuelve) y sin ella un equipo compartido se queda bloqueado para el siguiente.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Mostrar contraseña',
      'Mostrar contraseña',
      'Mostrar contraseña',
      'Guardar',
      'Cerrar sesión',
    ])
    expect(screen.queryByText('APLICACIÓN')).not.toBeInTheDocument()
  })

  it('envía la actual y la nueva, quita la marca de la sesión y deja entrar en la aplicación', async () => {
    const cuerpos = registrarCambio()
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    expect(await screen.findByText('APLICACIÓN')).toBeInTheDocument()
    expect(cuerpos).toEqual([{ passwordActual: 'LaTemporal9', passwordNueva: 'MiClaveNueva1' }])
    expect(leerSesion()?.passwordTemporal).toBe(false)
  })

  it('si las dos nuevas no coinciden no llama al servidor', async () => {
    const cuerpos = registrarCambio()
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'otra')
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    expect(linea()).toHaveTextContent('Las contraseñas nuevas no coinciden.')
    expect(cuerpos).toHaveLength(0)
    expect(screen.queryByText('APLICACIÓN')).not.toBeInTheDocument()
  })

  it('una nueva demasiado corta tampoco sale de aquí', async () => {
    const cuerpos = registrarCambio()
    montar()
    await rellenar('LaTemporal9', '123456789', '123456789')
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    expect(linea()).toHaveTextContent('La contraseña debe tener al menos 10 caracteres.')
    expect(cuerpos).toHaveLength(0)
  })

  it.each([
    [422, () => HttpResponse.json({ message: 'La contraseña actual no es correcta.' }, { status: 422 }), 'La contraseña actual no es correcta.'],
    [429, () => HttpResponse.json({ message: 'Demasiados intentos fallidos. Espera unos segundos y vuelve a intentarlo.' }, { status: 429 }), 'Demasiados intentos fallidos. Espera unos segundos y vuelve a intentarlo.'],
  ])('un %s deja el mensaje del servidor en la línea y la sesión sigue retenida', async (_codigo, respuesta, texto) => {
    registrarCambio(respuesta)
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    expect(await screen.findByText(texto)).toBe(linea())
    expect(screen.queryByText('APLICACIÓN')).not.toBeInTheDocument()
    expect(leerSesion()?.passwordTemporal).toBe(true)
  })

  it('el corte de conexión lo avisa el mecanismo global, no la línea de la página', async () => {
    registrarCambio(() => new HttpResponse(null, { status: 503 }))
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    // Con el diálogo abierto, Radix oculta el resto del documento: la línea de la página se busca incluyéndolo.
    expect(screen.getByRole('alert', { hidden: true })).toBeEmptyDOMElement()
  })

  it('dos clics seguidos en Guardar envían una sola vez', async () => {
    const cuerpos = registrarCambio(async () => { await delay(20); return new HttpResponse(null, { status: 204 }) })
    montar()
    await rellenar('LaTemporal9', 'MiClaveNueva1', 'MiClaveNueva1')
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.click(guardar())
    fireEvent.click(guardar())
    expect(await screen.findByText('APLICACIÓN')).toBeInTheDocument()
    expect(cuerpos).toHaveLength(1)
  })
  // Esta pantalla vive fuera de AppLayout, donde se monta la vigilancia de inactividad; sin este test nadie
  // notaria que quedarse aqui deja la sesion abierta indefinidamente en un PC compartido.
  it('cierra por inactividad como el resto de la aplicacion', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.setSystemTime(0)
      localStorage.setItem(CLAVE_ACTIVIDAD, '0')
      montar()
      act(() => void vi.advanceTimersByTime(INACTIVIDAD_MS - AVISO_MS))
      expect(screen.getByText(MSG_AVISO_TITULO)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('la barra aparece bajo "Nueva contraseña" con la nota del servidor', async () => {
    server.use(http.post('*/api/auth/evaluar-password', () => HttpResponse.json({ nota: 3, aceptable: true, mensaje: null })))
    montar()
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'nueva-larga-123')
    expect(await screen.findByText('Segura')).toBeInTheDocument()
    expect(screen.getByText('Mínimo 10 caracteres.')).toBeInTheDocument()
  })

  it('"Guardar" se desactiva si el servidor no la acepta y enseña el motivo', async () => {
    server.use(http.post('*/api/auth/evaluar-password', () =>
      HttpResponse.json({ nota: 1, aceptable: false, mensaje: 'La contraseña es poco segura. Añade otra palabra.' })))
    montar()
    await rellenar('actual1', 'aaaaaaaaaa', 'aaaaaaaaaa')
    expect(await screen.findByText('La contraseña es poco segura. Añade otra palabra.')).toBeInTheDocument()
    expect(guardar()).toBeDisabled()
  })

  it('si la comprobación falla, "Guardar" sigue disponible y decide el servidor', async () => {
    server.use(http.post('*/api/auth/evaluar-password', () => new HttpResponse(null, { status: 500 })))
    const cuerpos = registrarCambio()
    montar()
    await rellenar('actual1', 'nueva-larga-123', 'nueva-larga-123')
    expect(await screen.findByText('No se pudo comprobar')).toBeInTheDocument()
    await userEvent.click(guardar())
    await waitFor(() => expect(cuerpos).toHaveLength(1))
  })

  it('Enter no se salta el bloqueo si el servidor no la acepta', async () => {
    server.use(http.post('*/api/auth/evaluar-password', () =>
      HttpResponse.json({ nota: 1, aceptable: false, mensaje: 'La contraseña es poco segura.' })))
    const cuerpos = registrarCambio()
    montar()
    await rellenar('actual1', 'aaaaaaaaaa', '')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'aaaaaaaaaa')
    await screen.findByText('La contraseña es poco segura.')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), '{Enter}')
    await new Promise((r) => setTimeout(r, 50))
    expect(cuerpos).toHaveLength(0)
  })

  it('con sesión de administrador recuerda que se pide «Muy segura»', () => {
    renderConProviders(<CambioObligatorioPage />, {
      sesion: { ...SESION_ADMIN, passwordTemporal: true },
      ruta: '/cuenta/cambiar-obligatorio',
      rutas: <Route path="/" element={<p>APLICACIÓN</p>} />,
    })
    expect(screen.getByText('Para el administrador se pide «Muy segura».')).toBeInTheDocument()
  })

  it('la explicación vale tanto para la temporal como para la contraseña de siempre', () => {
    montar()
    expect(screen.getByText(EXPLICACION)).toBeInTheDocument()
    expect(EXPLICACION).toBe('Para seguir tienes que elegir una contraseña nueva. Será la que quede asociada a tu nombre en el registro de actividad.')
  })
})
