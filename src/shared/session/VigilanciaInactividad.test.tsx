import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AVISO_MS, CLAVE_ACTIVIDAD, INACTIVIDAD_MS, leerActividad } from './actividad'
import { CLAVE_SESION } from './storage'
import { VigilanciaInactividad } from './VigilanciaInactividad'

/**
 * Corre el reloj simulado dentro de `act` para que React agote las actualizaciones que el latido
 * encadena (incluida la que el diálogo modal lanza desde su propio efecto). Con reloj real eso pasa
 * solo entre dos vueltas del `setInterval`; el reloj simulado nunca cede un tick, de ahí el `act`.
 */
const avanzar = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

const SESION = JSON.stringify({ idUsu: 8, nombreUsuario: 'ana', rol: 'TECNICO', idTec: 4, token: 't' })

const expulsar = vi.fn()
vi.mock('./expiracion', () => ({
  dispararSesionExpirada: () => expulsar(),
}))

describe('cierre por inactividad', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(CLAVE_SESION, SESION)
    expulsar.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('con actividad reciente no avisa ni expulsa', () => {
    localStorage.setItem(CLAVE_ACTIVIDAD, '0')
    render(<VigilanciaInactividad />)
    avanzar(60_000)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(expulsar).not.toHaveBeenCalled()
  })

  it('avisa un minuto antes del cierre', () => {
    localStorage.setItem(CLAVE_ACTIVIDAD, '0')
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS - AVISO_MS)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(expulsar).not.toHaveBeenCalled()
  })

  it('el aviso dice que se puede perder lo no guardado', () => {
    localStorage.setItem(CLAVE_ACTIVIDAD, '0')
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS - AVISO_MS)
    expect(screen.getByRole('dialog').textContent).toMatch(/sin guardar/i)
  })

  it('pasado el tope expulsa por el camino de sesión caducada', () => {
    localStorage.setItem(CLAVE_ACTIVIDAD, '0')
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS)
    expect(expulsar).toHaveBeenCalledTimes(1)
  })

  it('el botón de seguir renueva la marca y cierra el aviso', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    localStorage.setItem(CLAVE_ACTIVIDAD, '0')
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS - AVISO_MS)
    await usuario.click(screen.getByRole('button', { name: /seguir/i }))
    expect(leerActividad()).toBeGreaterThan(0)
    expect(screen.queryByRole('dialog')).toBeNull()
    avanzar(AVISO_MS + 1_000)
    expect(expulsar).not.toHaveBeenCalled()
  })

  it('la actividad en otra pestaña retira el aviso', () => {
    localStorage.setItem(CLAVE_ACTIVIDAD, '0')
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS - AVISO_MS)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()))
    avanzar(2_000)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sin sesión no hace nada', () => {
    localStorage.removeItem(CLAVE_SESION)
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS + 10_000)
    expect(expulsar).not.toHaveBeenCalled()
  })

  it('sin marca previa arranca contando desde ahora', () => {
    render(<VigilanciaInactividad />)
    avanzar(INACTIVIDAD_MS - AVISO_MS - 5_000)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
