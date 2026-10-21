import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarcaTaller } from './MarcaTaller'

describe('MarcaTaller (spec 0.9.21 §2.4)', () => {
  it('sin nada del taller, el valor tal cual', () => {
    const { container } = render(<MarcaTaller nsys={null}>Azul</MarcaTaller>)
    expect(container).toHaveTextContent(/^Azul$/)
    expect(screen.queryByText('taller')).not.toBeInTheDocument()
  })

  it('con lo del taller, la marca y lo de NSYS debajo', () => {
    const { container } = render(<MarcaTaller nsys="Azul">Rojo</MarcaTaller>)
    expect(screen.getByText('taller')).toHaveClass('bg-taller')
    expect(screen.getByText('NSYS: Azul')).toHaveClass('block')
    expect(container).toHaveTextContent('Rojo taller')
  })

  it('en línea, lo de NSYS a la derecha', () => {
    const { container } = render(<MarcaTaller nsys="B" enLinea>A</MarcaTaller>)
    expect(screen.getByText('NSYS: B')).not.toHaveClass('block')
    expect(container).toHaveTextContent('A taller NSYS: B')
  })
})
