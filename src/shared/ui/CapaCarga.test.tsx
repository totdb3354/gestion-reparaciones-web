import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapaCarga, RETARDO_CAPA_MS } from './CapaCarga'

describe('CapaCarga', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('no aparece antes de 200 ms y aparece después, con role="status" y "Cargando…" solo para lectores de pantalla', () => {
    render(<CapaCarga activa />)
    act(() => vi.advanceTimersByTime(RETARDO_CAPA_MS - 1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    const capa = screen.getByRole('status')
    expect(capa).toHaveTextContent('Cargando…')
    expect(screen.getByText('Cargando…')).toHaveClass('sr-only')
    expect(capa).toHaveClass('fixed', 'inset-0', 'z-[60]', 'bg-fondo-vista/60')
    expect(RETARDO_CAPA_MS).toBe(200)
  })

  it('si la carga acaba antes de 200 ms no llega a aparecer', () => {
    const { rerender } = render(<CapaCarga activa />)
    act(() => vi.advanceTimersByTime(150))
    rerender(<CapaCarga activa={false} />)
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('desaparece en cuanto la condición cae, sin retardo, y al volver a activarse espera otra vez los 200 ms', () => {
    const { rerender } = render(<CapaCarga activa />)
    act(() => vi.advanceTimersByTime(RETARDO_CAPA_MS))
    expect(screen.getByRole('status')).toBeInTheDocument()
    rerender(<CapaCarga activa={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    rerender(<CapaCarga activa />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(RETARDO_CAPA_MS))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('mientras se ve bloquea clics y teclas de lo que hay debajo; al ocultarse los deja pasar', () => {
    const onClick = vi.fn()
    const onKeyDown = vi.fn()
    const Vista = ({ activa }: { activa: boolean }) => (
      <>
        <button type="button" onClick={onClick} onKeyDown={onKeyDown}>Debajo</button>
        <CapaCarga activa={activa} />
      </>
    )
    const { rerender } = render(<Vista activa />)
    act(() => vi.advanceTimersByTime(RETARDO_CAPA_MS))
    const boton = screen.getByRole('button', { name: 'Debajo' })
    fireEvent.click(boton)
    fireEvent.keyDown(boton, { key: 'Enter' })
    expect(onClick).not.toHaveBeenCalled()
    expect(onKeyDown).not.toHaveBeenCalled()
    rerender(<Vista activa={false} />)
    fireEvent.click(boton)
    fireEvent.keyDown(boton, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})
