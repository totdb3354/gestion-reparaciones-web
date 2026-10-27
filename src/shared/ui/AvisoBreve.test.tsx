import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvisoBreveHost, DURACION_AVISO_MS } from './AvisoBreve'
import { avisar } from './avisos'

describe('AvisoBreve (spec 2026-10-13 §2.7)', () => {
  afterEach(() => vi.useRealTimers())

  it('no pinta nada hasta que llega un aviso', () => {
    render(<AvisoBreveHost />)
    expect(screen.queryByTestId('aviso-breve')).not.toBeInTheDocument()
  })

  it('enseña el texto con su icono y no es un diálogo', () => {
    render(<AvisoBreveHost />)
    act(() => avisar({ texto: 'Entregado a Técnico H · Abierto', tipo: 'ok' }))
    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent('Entregado a Técnico H · Abierto')
    expect(aviso).toHaveAttribute('data-tipo', 'ok')
    expect(aviso).toHaveTextContent('✓')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('«i» para informativo y «!» para el caso de seguridad', () => {
    render(<AvisoBreveHost />)
    act(() => avisar({ texto: 'Entregado a Técnico H · ya estaba abierto', tipo: 'info' }))
    expect(screen.getByTestId('aviso-breve')).toHaveTextContent(/^i/)
    act(() => avisar({ texto: 'Entregado a Técnico H · sin «Abrir» (el modelo no tiene pieza otro)', tipo: 'warn' }))
    expect(screen.getByTestId('aviso-breve')).toHaveTextContent(/^!/)
  })

  it('se cierra solo a los 4 s', () => {
    vi.useFakeTimers()
    render(<AvisoBreveHost />)
    act(() => avisar({ texto: 'Llegada registrada', tipo: 'info' }))
    act(() => vi.advanceTimersByTime(DURACION_AVISO_MS - 1))
    expect(screen.getByTestId('aviso-breve')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByTestId('aviso-breve')).not.toBeInTheDocument()
  })

  it('uno nuevo sustituye al anterior y vuelve a contar 4 s', () => {
    vi.useFakeTimers()
    render(<AvisoBreveHost />)
    act(() => avisar({ texto: 'Primero', tipo: 'ok' }))
    act(() => vi.advanceTimersByTime(3000))
    act(() => avisar({ texto: 'Segundo', tipo: 'warn' }))
    expect(screen.getAllByTestId('aviso-breve')).toHaveLength(1)
    expect(screen.getByTestId('aviso-breve')).toHaveTextContent('Segundo')
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByTestId('aviso-breve')).toHaveTextContent('Segundo')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByTestId('aviso-breve')).not.toBeInTheDocument()
  })

  it('un clic lo cierra', async () => {
    render(<AvisoBreveHost />)
    act(() => avisar({ texto: 'Entrega deshecha', tipo: 'info' }))
    await userEvent.click(screen.getByTestId('aviso-breve'))
    expect(screen.queryByTestId('aviso-breve')).not.toBeInTheDocument()
  })

  it('lleva la barra que se consume y una × que lo cierra antes', async () => {
    render(<AvisoBreveHost />)
    act(() => avisar({ texto: 'Descartado «SIN-IMEI-CAM»', tipo: 'ok' }))
    expect(screen.getByTestId('aviso-breve').querySelector('.aviso-barra')).not.toBeNull()
    const x = screen.getByRole('button', { name: 'Cerrar aviso' })
    expect(x).toHaveAttribute('title', 'Cerrar')
    await userEvent.click(x)
    expect(screen.queryByTestId('aviso-breve')).not.toBeInTheDocument()
  })
})
