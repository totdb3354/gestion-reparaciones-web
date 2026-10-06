import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LetreroEntorno, TEXTO_LETRERO_PRE } from './LetreroEntorno'

afterEach(() => {
  vi.unstubAllEnvs()
  document.title = 'FSGR'
})

describe('LetreroEntorno', () => {
  it('en preproducción se ve el aviso, fijo, por encima de todo y sin recibir clics', () => {
    vi.stubEnv('VITE_ENTORNO', 'preproduccion')
    render(<LetreroEntorno />)
    const aviso = screen.getByRole('note', { name: 'Entorno de preproducción' })
    expect(aviso).toHaveTextContent(TEXTO_LETRERO_PRE)
    expect(aviso).toHaveClass('pointer-events-none', 'fixed', 'z-[70]')
  })

  it('en preproducción la pestaña lleva "[PRE] " delante', () => {
    vi.stubEnv('VITE_ENTORNO', 'preproduccion')
    document.title = 'FSGR'
    render(<LetreroEntorno />)
    expect(document.title).toBe('[PRE] FSGR')
  })

  it('sin VITE_ENTORNO no pinta nada ni toca el título', () => {
    vi.stubEnv('VITE_ENTORNO', '')
    document.title = 'FSGR'
    const { container } = render(<LetreroEntorno />)
    expect(container).toBeEmptyDOMElement()
    expect(document.title).toBe('FSGR')
  })

  it('con otro valor no pinta nada', () => {
    vi.stubEnv('VITE_ENTORNO', 'produccion')
    const { container } = render(<LetreroEntorno />)
    expect(container).toBeEmptyDOMElement()
  })
})
