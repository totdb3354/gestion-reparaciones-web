import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvisoVersion, MSG_VERSION_NUEVA } from './AvisoVersion'
import { INTERVALO_VERSION_MS } from './versionPublicada'

vi.mock('@/shared/lib/version', () => ({ APP_VERSION: '0.9.0' }))

const leer = vi.fn()
vi.mock('./versionPublicada', async (importar) => {
  const real = await importar<typeof import('./versionPublicada')>()
  return { ...real, leerVersionPublicada: () => leer() }
})

/** Forma mínima del espía de `setInterval` que hace falta aquí: qué intervalos se crearon y con qué id. */
type EspiaIntervalo = { mock: { calls: unknown[][]; results: { value: unknown }[] } }

/** Id del sondeo de versión (el intervalo creado con INTERVALO_VERSION_MS), para comprobar que se limpia. */
function idDelSondeo(espia: EspiaIntervalo): unknown {
  const cual = espia.mock.calls.findIndex((argumentos) => argumentos[1] === INTERVALO_VERSION_MS)
  expect(cual).toBeGreaterThanOrEqual(0)
  return espia.mock.results[cual].value
}

describe('aviso de versión nueva', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    leer.mockReset()
  })

  it('con la misma versión no muestra nada', async () => {
    leer.mockResolvedValue('0.9.0')
    render(<AvisoVersion />)
    await waitFor(() => expect(leer).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('con una versión distinta ofrece recargar', async () => {
    leer.mockResolvedValue('0.9.1')
    render(<AvisoVersion />)
    expect(await screen.findByRole('button', { name: /recargar/i })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(MSG_VERSION_NUEVA)
  })

  it('si no se puede saber la versión no muestra nada', async () => {
    leer.mockResolvedValue(null)
    render(<AvisoVersion />)
    await waitFor(() => expect(leer).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('no recarga por su cuenta', async () => {
    leer.mockResolvedValue('0.9.1')
    const recargar = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: recargar })
    render(<AvisoVersion />)
    await screen.findByRole('button', { name: /recargar/i })
    expect(recargar).not.toHaveBeenCalled()
  })

  it('recarga solo cuando se pulsa el botón', async () => {
    leer.mockResolvedValue('0.9.1')
    const recargar = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: recargar })
    render(<AvisoVersion />)
    await userEvent.click(await screen.findByRole('button', { name: /recargar/i }))
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('deja de sondear en cuanto detecta la diferencia', async () => {
    leer.mockResolvedValue('0.9.1')
    const crear = vi.spyOn(window, 'setInterval')
    const limpiar = vi.spyOn(window, 'clearInterval')
    render(<AvisoVersion />)
    await screen.findByRole('button', { name: /recargar/i })
    expect(limpiar).toHaveBeenCalledWith(idDelSondeo(crear))
  })

  it('no deja el sondeo vivo al desmontar', async () => {
    leer.mockResolvedValue('0.9.0')
    const crear = vi.spyOn(window, 'setInterval')
    const limpiar = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<AvisoVersion />)
    await waitFor(() => expect(leer).toHaveBeenCalled())
    const sondeo = idDelSondeo(crear)
    expect(limpiar).not.toHaveBeenCalledWith(sondeo)
    unmount()
    expect(limpiar).toHaveBeenCalledWith(sondeo)
  })
})
