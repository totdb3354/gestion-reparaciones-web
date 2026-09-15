import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button (shadcn)', () => {
  it('renderiza y acepta utilidades de token', () => {
    render(<Button className="bg-azul-noche text-crema">Iniciar Sesión</Button>)
    const btn = screen.getByRole('button', { name: 'Iniciar Sesión' })
    expect(btn).toHaveClass('bg-azul-noche')
    expect(btn).toHaveClass('text-crema')
  })
})
