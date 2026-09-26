import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Usuario } from '@/shared/api/client'
import { DataTable } from '@/shared/ui/DataTable'
import { columnasTecnicos } from './columnas'

const usuarios: Usuario[] = [
  { idUsu: 11, nombreUsuario: 'usuario-a', rol: 'TECNICO', idTec: 21, nombreTecnico: 'tecnico-a', activo: true },
  { idUsu: 12, nombreUsuario: 'usuario-b', rol: 'SUPERTECNICO', idTec: 22, nombreTecnico: 'tecnico-b', activo: false },
]

function montar() {
  const onToggle = vi.fn()
  const onEliminar = vi.fn()
  const r = render(<DataTable columns={columnasTecnicos({ onToggle, onEliminar })} data={usuarios} vacio="No hay contenido en la tabla" getRowId={(u) => String(u.idTec)} />)
  return { ...r, onToggle, onEliminar }
}
const celdas = (container: HTMLElement, columna: string) => Array.from(container.querySelectorAll(`[data-columna="${columna}"]`)).map((c) => c.textContent)
const fila = (nombre: string) => screen.getByRole('row', { name: new RegExp(`^${nombre}`) })

/** Calco de RegisterController.configurarTabla (:97-186) y RegisterView.fxml :105-109. */
describe('columnas de técnicos', () => {
  it('Técnico, Usuario, Rol, Estado y una de acciones sin cabecera, con los prefWidth del FXML', () => {
    const { container } = montar()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Técnico', 'Usuario', 'Rol', 'Estado', ''])
    const cols = container.querySelectorAll('col')
    expect(cols[0]).toHaveStyle({ width: '160px' })
    expect(cols[1]).toHaveStyle({ width: '130px' })
    expect(cols[2]).toHaveStyle({ width: '110px' })
    expect(cols[3]).toHaveStyle({ width: '90px' })
    expect(cols[4]).toHaveStyle({ width: '80px' })
  })
  it('con ajuste "ultima" (el de la página) la de acciones absorbe el sobrante (FLEX_LAST_COLUMN) con los iconos centrados', () => {
    const { container } = render(<DataTable columns={columnasTecnicos({ onToggle: vi.fn(), onEliminar: vi.fn() })} data={usuarios}
      vacio="" getRowId={(u) => String(u.idTec)} ajuste="ultima" />)
    const cols = container.querySelectorAll('col')
    expect(cols[3]).toHaveStyle({ width: '90px' })
    expect(cols[4].style.width).toBe('')
    expect(container.querySelector('table')).toHaveStyle({ minWidth: '570px' })
    const celda = container.querySelector('[data-columna="acciones"]')!
    expect(celda.firstElementChild).toHaveClass('flex', 'justify-center')
  })
  it('nombre de técnico, de usuario y el rol en mayúsculas tal cual, en el orden recibido', () => {
    const { container } = montar()
    expect(celdas(container, 'tecnico')).toEqual(['tecnico-a', 'tecnico-b'])
    expect(celdas(container, 'usuario')).toEqual(['usuario-a', 'usuario-b'])
    expect(celdas(container, 'rol')).toEqual(['TECNICO', 'SUPERTECNICO'])
  })
  it('badge "Activo" (#2E7D32 sobre #D4EDDA) e "Inactivo" (#B03040 sobre #F5E6E6), radio 10, 11 px negrita', () => {
    montar()
    expect(screen.getByText('Activo')).toHaveClass('bg-badge-usuario-activo-bg', 'text-badge-usuario-activo-text', 'rounded-[10px]', 'px-2.5', 'py-[3px]', 'text-[11px]', 'font-bold')
    expect(screen.getByText('Inactivo')).toHaveClass('bg-badge-usuario-inactivo-bg', 'text-badge-usuario-inactivo-text')
  })
  it('candado: abierto (Unlock.png) con "Desactivar acceso" si activo, cerrado (Lock.png) con "Activar acceso" si no; papelera sin tooltip en todas las filas', () => {
    montar()
    const desactivar = within(fila('tecnico-a')).getByRole('button', { name: 'Desactivar acceso' })
    expect(desactivar).toHaveAttribute('title', 'Desactivar acceso')
    expect(desactivar.querySelector('img')).toHaveAttribute('src', '/Unlock.png')
    expect(desactivar.querySelector('img')).toHaveClass('h-[18px]', 'w-[18px]')
    const activar = within(fila('tecnico-b')).getByRole('button', { name: 'Activar acceso' })
    expect(activar).toHaveAttribute('title', 'Activar acceso')
    expect(activar.querySelector('img')).toHaveAttribute('src', '/Lock.png')
    const papeleras = screen.getAllByRole('button', { name: 'Eliminar' })
    expect(papeleras).toHaveLength(2)
    for (const p of papeleras) {
      expect(p).not.toHaveAttribute('title')
      expect(p.querySelector('img')).toHaveAttribute('src', '/borrar.png')
      expect(p.querySelector('img')).toHaveClass('h-[22px]', 'w-[22px]')
    }
  })
  it('el candado llama a onToggle y la papelera a onEliminar con su fila', async () => {
    const { onToggle, onEliminar } = montar()
    await userEvent.click(within(fila('tecnico-b')).getByRole('button', { name: 'Activar acceso' }))
    expect(onToggle).toHaveBeenCalledWith(usuarios[1])
    await userEvent.click(within(fila('tecnico-a')).getByRole('button', { name: 'Eliminar' }))
    expect(onEliminar).toHaveBeenCalledWith(usuarios[0])
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onEliminar).toHaveBeenCalledTimes(1)
  })
})
