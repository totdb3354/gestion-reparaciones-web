import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { lineaDePrueba as l } from './datosPrueba'
import { BotonMenuBloque } from './MenuBloque'
import { agruparEnBloques, entradasMenuBloque } from './reglas'

describe('BotonMenuBloque (spec §6.4)', () => {
  it('⋮ abre el menú; las deshabilitadas llevan su motivo; elegir una avisa con su acción', async () => {
    const onAccion = vi.fn()
    const onInteraccion = vi.fn()
    const b = agruparEnBloques([l({ idCompra: 1 }), l({ idCompra: 2, estado: 'en_camino' })]).get('41')!
    render(<BotonMenuBloque idBloque={41} entradas={entradasMenuBloque(b, 0)} onAccion={onAccion} onInteraccion={onInteraccion} />)
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    expect(onInteraccion).toHaveBeenLastCalledWith(true)
    const juntar = screen.getByRole('menuitem', { name: /Juntar con…/ })
    expect(juntar).toHaveAttribute('aria-disabled', 'true')
    expect(juntar).toHaveTextContent('no hay otro bloque vivo de este proveedor')
    expect(screen.getByRole('menuitem', { name: /Borrar bloque/ })).toHaveClass('text-rojo-accion')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recibir todo (1)' }))
    expect(onAccion).toHaveBeenCalledWith('recibir')
  })

  it('si se desmonta con el menú abierto, el sondeo se descongela (última llamada false)', async () => {
    const onInteraccion = vi.fn()
    const b = agruparEnBloques([l({ idCompra: 1 })]).get('41')!
    const { unmount } = render(<BotonMenuBloque idBloque={41} entradas={entradasMenuBloque(b, 0)} onAccion={vi.fn()} onInteraccion={onInteraccion} />)
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    expect(onInteraccion).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onInteraccion).toHaveBeenLastCalledWith(false)
  })
})
