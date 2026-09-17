import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { FiltroImei } from './FiltroImei'

function Prueba() {
  const [v, setV] = useState('')
  return <FiltroImei valor={v} onChange={setV} />
}

describe('FiltroImei (calco del TextField "Filtrar por IMEI")', () => {
  it('canonicaliza al teclear y pinta el borde por estado', async () => {
    render(<Prueba />)
    const campo = screen.getByPlaceholderText('Filtrar por IMEI')
    expect(campo).toHaveClass('border-azul-gris')
    await userEvent.type(campo, '3554')
    expect(campo).toHaveValue('3554')
    expect(campo).toHaveClass('border-fila-incidencia-brd')
    await userEvent.type(campo, '00000000111')
    expect(campo).toHaveValue('355400000000111, ')
    expect(campo).toHaveClass('border-fila-reparado-ico')
    await userEvent.type(campo, 'x1')
    expect(campo).toHaveValue('355400000000111, 1')
  })

  it('un carácter descartado no deja armado el salto de caret para una edición posterior en mitad de la cadena', async () => {
    render(<Prueba />)
    const campo = screen.getByPlaceholderText('Filtrar por IMEI') as HTMLInputElement
    await userEvent.type(campo, '12345')
    expect(campo).toHaveValue('12345')
    // la 'x' no cambia el valor canónico (se descarta), pero sí difiere del texto crudo del input
    await userEvent.type(campo, 'x')
    expect(campo).toHaveValue('12345')
    // edición válida en mitad de la cadena, sin retoque de formato: el caret debe quedarse donde escribe el
    // usuario (justo tras el '9'), no saltar al final como haría si moverCaret hubiera quedado armado por la 'x'
    await userEvent.type(campo, '9', { initialSelectionStart: 2, initialSelectionEnd: 2 })
    expect(campo).toHaveValue('129345')
    expect(campo.selectionStart).toBe(3)
  })
})
