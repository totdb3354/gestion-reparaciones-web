import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './context-menu'
import { MenuCopiarCelda } from './MenuCopiarCelda'

describe('MenuCopiarCelda', () => {
  it('copia el texto y resalta la celda; con texto vacío no hace nada', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: escribir } })
    const resaltar = vi.fn()
    const { rerender } = render(
      <ContextMenu><ContextMenuTrigger>fila</ContextMenuTrigger><ContextMenuContent><MenuCopiarCelda texto="355400000000111" celda={{ columnaId: 'imei', resaltar }} /></ContextMenuContent></ContextMenu>,
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('fila') })
    await userEvent.click(await screen.findByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).toHaveBeenCalledWith('355400000000111')
    expect(resaltar).toHaveBeenCalledTimes(1)
    rerender(
      <ContextMenu><ContextMenuTrigger>fila</ContextMenuTrigger><ContextMenuContent><MenuCopiarCelda texto={null} celda={{ columnaId: 'x', resaltar }} /></ContextMenuContent></ContextMenu>,
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('fila') })
    await userEvent.click(await screen.findByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).toHaveBeenCalledTimes(1)
    expect(resaltar).toHaveBeenCalledTimes(1)
  })
})
