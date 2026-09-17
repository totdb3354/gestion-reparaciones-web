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

function Demo({ textoVacio = 'Cliente' }: { textoVacio?: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  return (
    <MultiSelect
      opciones={[{ n: 'WEB' }, { n: 'OTRO' }]}
      clave={(o) => o.n}
      etiqueta={(o) => o.n}
      seleccion={sel}
      onChange={setSel}
      textoVacio={textoVacio}
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

  it('es la píldora navy de los filtros del JavaFX, con flecha que no cambia el nombre accesible', async () => {
    render(<Demo />)
    const boton = screen.getByRole('button', { name: 'Cliente' })
    expect(boton).toHaveClass('rounded-3xl', 'bg-azul-noche', 'text-texto-nav-activo', 'font-bold')
    // la flecha ▾ es decorativa: si contase para el nombre accesible, los tests (y los lectores de
    // pantalla) verían "Cliente" mezclado con el icono
    expect(boton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(boton)
    expect(screen.getByRole('checkbox', { name: 'WEB' }).closest('[data-slot="popover-content"]')).toHaveClass('border-fila-sep', 'bg-superficie')
  })

  it('con varias instancias en la misma página, marcar una opción solo afecta a la instancia clicada', async () => {
    render(
      <>
        <Demo textoVacio="Cliente" />
        <Demo textoVacio="Proveedor" />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Proveedor' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'WEB' }))
    expect(screen.getByRole('button', { name: 'Cliente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'WEB' })).toBeInTheDocument()
  })

  it('con textoTodas y todas marcadas muestra "Todas"; con una marcada muestra su etiqueta, no su clave', async () => {
    const opciones = [{ id: 1, nombre: 'Técnico A' }, { id: 2, nombre: 'Técnico F' }]
    const { rerender } = render(<MultiSelect opciones={opciones} clave={(o) => String(o.id)} etiqueta={(o) => o.nombre} seleccion={new Set(['2'])} onChange={() => {}} textoVacio="Técnico" textoPlural={(n) => `${n} técnicos`} textoTodas="Todas" />)
    expect(screen.getByRole('button', { name: 'Técnico F' })).toBeInTheDocument()
    rerender(<MultiSelect opciones={opciones} clave={(o) => String(o.id)} etiqueta={(o) => o.nombre} seleccion={new Set(['1', '2'])} onChange={() => {}} textoVacio="Técnico" textoPlural={(n) => `${n} técnicos`} textoTodas="Todas" />)
    expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument()
    rerender(<MultiSelect opciones={opciones} clave={(o) => String(o.id)} etiqueta={(o) => o.nombre} seleccion={new Set(['1', '2'])} onChange={() => {}} textoVacio="Técnico" textoPlural={(n) => `${n} técnicos`} />)
    expect(screen.getByRole('button', { name: '2 técnicos' })).toBeInTheDocument()
  })
})
