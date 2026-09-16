import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { reportarExito, reportarFallo } from '@/shared/api/conexion'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { AppLayout } from './AppLayout'

describe('banner de conexión', () => {
  beforeEach(() => reportarExito())
  it('oculto conectado; aparece al fallar y desaparece al recuperarse', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    expect(screen.queryByText(/Sin conexión con el servidor/)).not.toBeInTheDocument()
    act(() => reportarFallo())
    expect(screen.getByText('⚠ Sin conexión con el servidor. Reintentando…')).toBeInTheDocument()
    act(() => reportarExito())
    expect(screen.queryByText(/Sin conexión con el servidor/)).not.toBeInTheDocument()
  })
  it('usa los colores del banner del JavaFX (amarillo con texto oscuro)', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    act(() => reportarFallo())
    const banner = screen.getByRole('status')
    expect(banner).toHaveClass('bg-banner-bg')
    expect(banner).toHaveClass('text-banner-text')
  })
  it('la región viva existe también conectado (vacía y solo para lectores de pantalla)', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveClass('sr-only')
    act(() => reportarFallo())
    expect(region).not.toHaveClass('sr-only')
    expect(region).toHaveTextContent('⚠ Sin conexión con el servidor. Reintentando…')
  })
})
