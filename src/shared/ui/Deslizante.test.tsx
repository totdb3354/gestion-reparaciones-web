import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MS_PANEL, PanelDeslizante, usePresencia } from './Deslizante'

function Prueba({ valor }: { valor: string | null }) {
  const p = usePresencia(valor)
  return p.valor ? <PanelDeslizante saliendo={p.saliendo}><p>{p.valor}</p></PanelDeslizante> : null
}

const reducir = (si: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: si && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }))

describe('usePresencia y PanelDeslizante', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('al cerrar sigue montado con el ultimo valor mientras sale y se desmonta al terminar', () => {
    const { rerender } = render(<Prueba valor="fila A" />)
    expect(screen.getByText('fila A').parentElement).toHaveClass('opacity-0') // entra: empieza cerrado
    act(() => { vi.advanceTimersByTime(30) })
    expect(screen.getByText('fila A').parentElement).not.toHaveAttribute('data-saliendo')
    expect(screen.getByText('fila A').parentElement).toHaveClass('opacity-100') // abierto
    rerender(<Prueba valor={null} />)
    expect(screen.getByText('fila A').parentElement).toHaveAttribute('data-saliendo')
    expect(screen.getByText('fila A').parentElement).toHaveClass('opacity-0')
    act(() => { vi.advanceTimersByTime(MS_PANEL - 10) })
    expect(screen.getByText('fila A')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(20) })
    expect(screen.queryByText('fila A')).not.toBeInTheDocument()
  })

  it('volver a abrir mientras sale lo mantiene montado y abierto', () => {
    const { rerender } = render(<Prueba valor="fila A" />)
    act(() => { vi.advanceTimersByTime(30) })
    rerender(<Prueba valor={null} />)
    act(() => { vi.advanceTimersByTime(50) })
    rerender(<Prueba valor="fila B" />)
    act(() => { vi.advanceTimersByTime(MS_PANEL * 2) })
    expect(screen.getByText('fila B').parentElement).not.toHaveAttribute('data-saliendo')
  })

  it('con «reducir movimiento» se desmonta al momento', () => {
    reducir(true)
    const { rerender } = render(<Prueba valor="fila A" />)
    rerender(<Prueba valor={null} />)
    expect(screen.queryByText('fila A')).not.toBeInTheDocument()
  })
})
