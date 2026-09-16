import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlertaProvider } from './AlertaProvider'
import { TextoExpandible } from './TextoExpandible'

// navigator.clipboard no existe en jsdom por defecto: se define con Object.defineProperty (configurable) para
// poder restaurar el descriptor original después de cada test, en vez de dejar la mutación de Object.assign.
const descriptorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  if (descriptorClipboard) Object.defineProperty(navigator, 'clipboard', descriptorClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('TextoExpandible (calco de labelExpandible + ConfirmDialog.mostrarTexto)', () => {
  it('con texto abre el popup con el texto completo y "Copiar" copia y cierra', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    render(<TextoExpandible titulo="Observaciones" texto="maquina laser" />, { wrapper: AlertaProvider })
    await userEvent.click(screen.getByRole('button', { name: 'maquina laser' }))
    const dlg = screen.getByRole('dialog', { name: 'Observaciones' })
    expect(dlg.querySelector('textarea')).toHaveValue('maquina laser')
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(escribir).toHaveBeenCalledWith('maquina laser')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('sin texto no pinta nada', () => {
    const { container } = render(<TextoExpandible titulo="Observaciones" texto={null} />, { wrapper: AlertaProvider })
    expect(container).toBeEmptyDOMElement()
  })
  it('el popup no cuelga del componente que lo abre: sus eventos no llegan a los manejadores de React que lo envuelven', async () => {
    const dobleClic = vi.fn()
    const clicDerecho = vi.fn()
    const tecla = vi.fn()
    render(
      <div onDoubleClick={dobleClic} onContextMenu={clicDerecho} onKeyDown={tecla}>
        <TextoExpandible titulo="Observaciones" texto="texto de prueba" />
      </div>,
      { wrapper: AlertaProvider },
    )
    await userEvent.click(screen.getByRole('button', { name: 'texto de prueba' }))
    const area = screen.getByRole('dialog', { name: 'Observaciones' }).querySelector('textarea')!
    await userEvent.dblClick(area)
    await userEvent.pointer({ keys: '[MouseRight]', target: area })
    await userEvent.type(area, '{ArrowDown}')
    expect(dobleClic).not.toHaveBeenCalled()
    expect(clicDerecho).not.toHaveBeenCalled()
    expect(tecla).not.toHaveBeenCalled()
  })
})
