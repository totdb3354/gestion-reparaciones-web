import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CampoPassword } from './CampoPassword'

function Demo({ alCambiar, className }: { alCambiar?: (v: string) => void; className?: string }) {
  const [valor, setValor] = useState('')
  return (
    <CampoPassword
      valor={valor}
      onChange={(v) => { setValor(v); alCambiar?.(v) }}
      placeholder="Nueva contraseña"
      aria-label="Nueva contraseña"
      className={className}
    />
  )
}

/** Calco del par PasswordField/TextField con el botón del ojo de LoginController :70-85 y CambiarPasswordController :41-72. */
describe('CampoPassword', () => {
  it('empieza oculto, con el placeholder y el ojo de mostrar (ojo_activar.png, 18 px)', () => {
    render(<Demo />)
    const campo = screen.getByLabelText('Nueva contraseña')
    expect(campo).toHaveAttribute('type', 'password')
    expect(campo).toHaveAttribute('placeholder', 'Nueva contraseña')
    const ojo = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(ojo).toHaveAttribute('type', 'button')
    expect(ojo.querySelector('img')).toHaveAttribute('src', '/ojo_activar.png')
    expect(ojo.querySelector('img')).toHaveClass('h-[18px]', 'w-[18px]')
  })
  it('el ojo alterna type, aria-label e icono y conserva el texto escrito', async () => {
    render(<Demo />)
    const campo = screen.getByLabelText('Nueva contraseña')
    await userEvent.type(campo, 'secreta1')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    expect(campo).toHaveValue('secreta1')
    const ocultar = screen.getByRole('button', { name: 'Ocultar contraseña' })
    expect(ocultar.querySelector('img')).toHaveAttribute('src', '/ojo_desactivar.png')
    await userEvent.click(ocultar)
    expect(campo).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument()
  })
  it('llama a onChange con cada tecla y el className del input no se come el hueco del ojo', async () => {
    const alCambiar = vi.fn()
    render(<Demo alCambiar={alCambiar} className="px-3.5 clase-extra" />)
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'abc')
    expect(alCambiar).toHaveBeenCalledTimes(3)
    expect(alCambiar).toHaveBeenLastCalledWith('abc')
    expect(screen.getByLabelText('Nueva contraseña')).toHaveClass('clase-extra', 'px-3.5', 'pr-11')
  })
  it('id, autoComplete y autoFocus llegan al input', () => {
    render(<CampoPassword valor="" onChange={() => {}} placeholder="Contraseña actual" aria-label="Contraseña actual" id="campo-actual" autoComplete="current-password" autoFocus />)
    const campo = screen.getByLabelText('Contraseña actual')
    expect(campo).toHaveAttribute('id', 'campo-actual')
    expect(campo).toHaveAttribute('autocomplete', 'current-password')
    expect(campo).toHaveFocus()
  })
})
