import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { DestinoRecuadro, RecuadroProveedor, RecuadroRepartir, RecuadroSinProveedor } from './RecuadroProveedor'

function recuadro(extra: Partial<ComponentProps<typeof RecuadroProveedor>> = {}) {
  const props: ComponentProps<typeof RecuadroProveedor> = {
    nombre: 'ACME', divisa: 'EUR', nLineas: 2, destino: <span>destino</span>, nPrevision: 3, previsionDeshabilitada: false,
    onPrevision: vi.fn(), onQuitar: vi.fn(), bloqueado: false, onAnadir: vi.fn(), onAnadirOtro: vi.fn(), avisos: [], plegado: false, onPlegar: vi.fn(),
    marcado: false, aLaVista: false, children: <p>tabla</p>, ...extra,
  }
  render(<RecuadroProveedor {...props} />)
  return props
}

describe('RecuadroProveedor (0.9.9, varios proveedores)', () => {
  it('cabecera con el proveedor, sus líneas, divisa, destino, «Añadir previsión (n)» y la ×; el cuerpo con la tabla y «+ Añadir línea»', async () => {
    const p = recuadro()
    const r = screen.getByRole('region', { name: 'Pedido a ACME' })
    expect(r).toHaveTextContent('ACME')
    expect(r).toHaveTextContent('· 2 líneas · EUR')
    expect(r).toHaveTextContent('destino')
    expect(within(r).getByText('tabla')).toBeInTheDocument()
    await userEvent.click(within(r).getByRole('button', { name: 'Añadir previsión (3)' }))
    expect(p.onPrevision).toHaveBeenCalled()
    await userEvent.click(within(r).getByRole('button', { name: 'Quitar ACME' }))
    expect(p.onQuitar).toHaveBeenCalled()
    await userEvent.click(within(r).getByRole('button', { name: '+ Añadir línea' }))
    expect(p.onAnadir).toHaveBeenCalled()
    const otro = within(r).getByRole('button', { name: '+ Añadir otro' })
    expect(otro.previousElementSibling).toHaveTextContent('+ Añadir línea')
    expect(otro).toHaveClass('border-otro-boton', 'text-otro-text')
    await userEvent.click(otro)
    expect(p.onAnadirOtro).toHaveBeenCalled()
    const plegar = within(r).getByRole('button', { name: 'Plegar ACME' })
    expect(plegar).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(plegar)
    expect(p.onPlegar).toHaveBeenCalled()
  })

  it('plegado: sin cuerpo y el botón dice «Desplegar ACME»', () => {
    recuadro({ plegado: true })
    expect(screen.queryByText('tabla')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Añadir línea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Añadir otro' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desplegar ACME' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('sin onQuitar no hay ×; con la previsión a 0, deshabilitada; avisos «también va a»; una línea en singular', () => {
    recuadro({ onQuitar: undefined, nPrevision: 0, avisos: ['lcd-x-negro también va a Proveedor B (4).'], nLineas: 1 })
    expect(screen.queryByRole('button', { name: 'Quitar ACME' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir previsión (0)' })).toBeDisabled()
    expect(screen.getByText('lcd-x-negro también va a Proveedor B (4).')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pedido a ACME' })).toHaveTextContent('· 1 línea · EUR')
  })

  it('marcado: data-marcado y borde de error; aLaVista: se desplaza hasta él', () => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView')
    onTestFinished(() => desplazar.mockRestore())
    recuadro({ marcado: true, aLaVista: true })
    const r = screen.getByRole('region', { name: 'Pedido a ACME' })
    expect(r).toHaveAttribute('data-marcado', 'true')
    expect(r).toHaveClass('border-texto-error')
    expect(desplazar.mock.contexts).toContain(r)
  })
})

describe('RecuadroRepartir', () => {
  it('cabecera ámbar con las líneas y la explicación; plegado sin cuerpo', async () => {
    const onPlegar = vi.fn()
    const { rerender } = render(<RecuadroRepartir nLineas={2} plegado={false} onPlegar={onPlegar} marcado={false} aLaVista={false}><p>filas</p></RecuadroRepartir>)
    const r = screen.getByRole('region', { name: 'Por repartir' })
    expect(r).toHaveTextContent('⚠ Por repartir')
    expect(r).toHaveTextContent('· 2 líneas · las venden varios proveedores o ninguno: elige a quién se las pides')
    expect(within(r).getByText('filas')).toBeInTheDocument()
    await userEvent.click(within(r).getByRole('button', { name: 'Plegar Por repartir' }))
    expect(onPlegar).toHaveBeenCalled()
    rerender(<RecuadroRepartir nLineas={2} plegado onPlegar={onPlegar} marcado={false} aLaVista={false}><p>filas</p></RecuadroRepartir>)
    expect(screen.queryByText('filas')).not.toBeInTheDocument()
  })
})

describe('RecuadroSinProveedor', () => {
  it('cabecera con el selector y «Añadir previsión» deshabilitado; el cuerpo con la tabla', () => {
    render(<RecuadroSinProveedor selector={<button type="button">elegir</button>}><p>tabla vacía</p></RecuadroSinProveedor>)
    const r = screen.getByRole('region', { name: 'Pedido sin proveedor' })
    expect(within(r).getByRole('button', { name: 'elegir' })).toBeInTheDocument()
    expect(within(r).getByRole('button', { name: 'Añadir previsión' })).toBeDisabled()
    expect(within(r).getByText('tabla vacía')).toBeInTheDocument()
  })
})

describe('DestinoRecuadro', () => {
  it('fijado, cargando y sin abiertos', () => {
    const { rerender } = render(<DestinoRecuadro nombre="ACME" fijado={41} />)
    expect(screen.getByText(/Bloque 41/).parentElement).toHaveTextContent('Bloque 41 (fijado)')
    rerender(<DestinoRecuadro nombre="ACME" cargando />)
    expect(screen.getByText('Cargando bloques…')).toBeInTheDocument()
    rerender(<DestinoRecuadro nombre="ACME" opciones={[]} />)
    expect(screen.getByText(/Bloque nuevo/).parentElement).toHaveTextContent('Bloque nuevo (no tiene ninguno abierto)')
  })

  it('con abiertos, el combo «Bloque de ACME»: «Bloque nuevo» → null; un bloque → su id', async () => {
    const onElegir = vi.fn()
    const opciones = [{ valor: '41', etiqueta: 'Añadir a Bloque 41 · 09/10 · 1 línea' }, { valor: 'nuevo', etiqueta: 'Bloque nuevo' }]
    render(<DestinoRecuadro nombre="ACME" opciones={opciones} valor={41} onElegir={onElegir} />)
    expect(screen.getByRole('combobox', { name: 'Bloque de ACME' })).toHaveTextContent('Añadir a Bloque 41')
    await userEvent.click(screen.getByRole('combobox', { name: 'Bloque de ACME' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Bloque de ACME' })).getByRole('button', { name: 'Bloque nuevo' }))
    expect(onElegir).toHaveBeenLastCalledWith(null)
  })
})
