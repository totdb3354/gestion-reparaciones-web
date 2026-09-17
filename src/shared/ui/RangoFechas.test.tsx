import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RangoFechas } from './RangoFechas'

describe('RangoFechas (calco de Desde:/Hasta: + DatePicker)', () => {
  it('etiqueta los dos campos y avisa con el par completo', async () => {
    const onChange = vi.fn()
    render(<RangoFechas desde="" hasta="2026-09-16" onChange={onChange} />)
    const desde = screen.getByLabelText('Desde:')
    expect(desde).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Hasta:')).toHaveValue('2026-09-16')
    await userEvent.type(desde, '2026-09-01')
    expect(onChange).toHaveBeenLastCalledWith('2026-09-01', '2026-09-16')
  })
})
