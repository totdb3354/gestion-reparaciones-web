import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MultiSelect, textoMultiSelect } from './MultiSelect'

describe('textoMultiSelect (calco de actualizarTextoFiltro)', () => {
  it('vacío, uno y varios', () => {
    expect(textoMultiSelect([], 'Cliente', (n) => `${n} clientes`)).toBe('Cliente')
    expect(textoMultiSelect(['WEB'], 'Cliente', (n) => `${n} clientes`)).toBe('WEB')
    expect(textoMultiSelect(['WEB', 'OTRO'], 'Cliente', (n) => `${n} clientes`)).toBe('2 clientes')
  })
})

function Demo() {
  const [sel, setSel] = useState<Set<string>>(new Set())
  return (
    <MultiSelect
      opciones={[{ n: 'WEB' }, { n: 'OTRO' }]}
      clave={(o) => o.n}
      etiqueta={(o) => o.n}
      seleccion={sel}
      onChange={setSel}
      textoVacio="Cliente"
      textoPlural={(k) => `${k} clientes`}
    />
  )
}

describe('MultiSelect', () => {
  it('marca y desmarca con checkboxes y actualiza la etiqueta', async () => {
    render(<Demo />)
    await userEvent.click(screen.getByRole('button', { name: 'Cliente' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'WEB' }))
    expect(screen.getByRole('button', { name: 'WEB' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'OTRO' }))
    expect(screen.getByRole('button', { name: '2 clientes' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'WEB' }))
    expect(screen.getByRole('button', { name: 'OTRO' })).toBeInTheDocument()
  })
})
