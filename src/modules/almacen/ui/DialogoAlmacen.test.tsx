import { getDefaultNormalizer, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderConProviders } from '@/test/render'
import { DialogoAlmacen } from './DialogoAlmacen'

const SIN_COLAPSAR = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) }

function montar(props: Partial<Parameters<typeof DialogoAlmacen>[0]> = {}) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  renderConProviders(
    <DialogoAlmacen abierto titulo="Editar stock" subtitulo="Componente: lcd-x   ·   Stock actual: 3 ud(s)." error={null} textoAccion="Confirmar" onConfirmar={onConfirmar} onCancelar={onCancelar} {...props}>
      <label htmlFor="campo">Nueva cantidad</label>
      <input id="campo" defaultValue="3" />
    </DialogoAlmacen>,
  )
  return { onConfirmar, onCancelar }
}

describe('DialogoAlmacen', () => {
  it('pinta título, subtítulo, los campos y los botones Cancelar / acción', () => {
    montar()
    const dlg = within(screen.getByRole('dialog', { name: 'Editar stock' }))
    expect(dlg.getByText('Componente: lcd-x   ·   Stock actual: 3 ud(s).', SIN_COLAPSAR)).toHaveClass('text-[12px]', 'text-azul-gris', 'whitespace-pre')
    // El subtítulo es la descripción accesible (Radix la enlaza sola; ver el spread de aria-describedby).
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/^Componente: lcd-x\s+·\s+Stock actual: 3 ud\(s\)\.$/)
    expect(dlg.getByLabelText('Nueva cantidad')).toHaveValue('3')
    // La ✕ de DialogContent ("Close", sr-only) se pinta después de los children: va la última.
    const botones = dlg.getAllByRole('button').map((b) => b.textContent)
    expect(botones).toEqual(['Cancelar', 'Confirmar', 'Close'])
  })
  it('Enter en un campo confirma; Cancelar y Escape cancelan', async () => {
    const { onConfirmar, onCancelar } = montar()
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '{Enter}')
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })
  it('el error se pinta en rojo de 11 px solo cuando hay texto', () => {
    montar({ error: 'Cantidad no válida (debe ser ≥ 0).' })
    expect(screen.getByRole('alert')).toHaveTextContent('Cantidad no válida (debe ser ≥ 0).')
    expect(screen.getByRole('alert')).toHaveClass('text-[11px]', 'text-texto-error')
  })
  it('sin error no hay región de alerta', () => {
    montar()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('enviando deshabilita los dos botones', () => {
    montar({ enviando: true })
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})
