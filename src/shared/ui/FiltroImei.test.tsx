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
})
