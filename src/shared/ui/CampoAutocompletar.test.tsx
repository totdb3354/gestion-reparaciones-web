import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { CampoAutocompletar } from './CampoAutocompletar'

const OPCIONES = [
  { clave: '14', etiqueta: 'iPhone 14' }, { clave: '14pro', etiqueta: 'iPhone 14 Pro' },
  { clave: '14promax', etiqueta: 'iPhone 14 Pro Max' }, { clave: '15', etiqueta: 'iPhone 15' },
]

function Envoltorio({ onElegir = vi.fn(), onTextoCambiado = vi.fn(), inicial = null as string | null }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return <>
    <CampoAutocompletar aria-label="Modelo" placeholder="Escribe modelo..." valor={valor} opciones={OPCIONES}
      onElegir={(c) => { setValor(c); onElegir(c) }} onTextoCambiado={onTextoCambiado} />
    <button>fuera</button>
  </>
}

/** Envoltorio para el caso de "cambio externo": el padre cambia `valor` sin pasar por `onElegir` del propio campo
 *  (p. ej. al resetear el modal o al recibir una predicción de otro sitio). El texto mostrado debe seguirlo. */
function EnvoltorioExterno({ inicial = null as string | null }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return <>
    <CampoAutocompletar aria-label="Modelo" placeholder="Escribe modelo..." valor={valor} opciones={OPCIONES}
      onElegir={setValor} />
    <button onClick={() => setValor('14promax')}>elegir desde fuera</button>
  </>
}

/** Envoltorio del caso de DetalleEntrada: al escribir sobre un modelo ya elegido, el padre lo borra (BORRAR_MODELO)
 *  desde `onTextoCambiado`, así que `valor` pasa a null mientras el usuario teclea. */
function EnvoltorioQueBorra({ inicial = null as string | null }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return <CampoAutocompletar aria-label="Modelo" placeholder="Escribe modelo..." valor={valor} opciones={OPCIONES}
    onElegir={setValor} onTextoCambiado={() => setValor(null)} />
}

describe('CampoAutocompletar', () => {
  it('filtra por "contiene" y elige con clic', async () => {
    const onElegir = vi.fn()
    render(<Envoltorio onElegir={onElegir} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Modelo' }), '14 pro')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['iPhone 14 Pro', 'iPhone 14 Pro Max'])
    await userEvent.click(screen.getByRole('option', { name: 'iPhone 14 Pro Max' }))
    expect(onElegir).toHaveBeenCalledWith('14promax')
    expect(screen.getByRole('combobox')).toHaveValue('iPhone 14 Pro Max')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('Enter elige la primera filtrada, pero no con el campo vacío ni con lo ya elegido', async () => {
    const onElegir = vi.fn()
    render(<Envoltorio onElegir={onElegir} inicial="15" />)
    const campo = screen.getByRole('combobox')
    await userEvent.type(campo, '{Enter}')
    expect(onElegir).not.toHaveBeenCalled()
    await userEvent.clear(campo)
    await userEvent.type(campo, '{Enter}')
    expect(onElegir).not.toHaveBeenCalled()
    await userEvent.type(campo, 'pro{Enter}')
    expect(onElegir).toHaveBeenCalledWith('14pro')
  })
  it('al salir: coincidencia exacta decide; si no, restaura', async () => {
    const onElegir = vi.fn()
    render(<Envoltorio onElegir={onElegir} inicial="15" />)
    const campo = screen.getByRole('combobox')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'iphone 14')
    await userEvent.click(screen.getByRole('button', { name: 'fuera' }))
    expect(onElegir).toHaveBeenCalledWith('14')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'iph')
    await userEvent.click(screen.getByRole('button', { name: 'fuera' }))
    expect(campo).toHaveValue('iPhone 14')
  })
  it('avisa cuando el texto deja de coincidir con lo elegido', async () => {
    const onTextoCambiado = vi.fn()
    render(<Envoltorio onTextoCambiado={onTextoCambiado} inicial="15" />)
    await userEvent.type(screen.getByRole('combobox'), 'x')
    expect(onTextoCambiado).toHaveBeenCalledWith('iPhone 15x')
  })
  it('muestra como mucho 6 filas a la vez (alto del popup)', async () => {
    render(<CampoAutocompletar aria-label="C" placeholder="" valor={null} onElegir={vi.fn()}
      opciones={Array.from({ length: 10 }, (_, i) => ({ clave: String(i), etiqueta: `Cliente ${i}` }))} />)
    await userEvent.type(screen.getByRole('combobox'), 'cliente')
    expect(screen.getByRole('listbox')).toHaveStyle({ maxHeight: '180px' })
  })
  it('la lista va en un portal: no queda anidada dentro de un contenedor con scroll propio (C24, DialogoLineas)', async () => {
    const contenedor = document.createElement('div')
    contenedor.setAttribute('data-testid', 'contenedor-scroll')
    document.body.appendChild(contenedor)
    render(<Envoltorio />, { container: contenedor })
    await userEvent.type(screen.getByRole('combobox', { name: 'Modelo' }), '14')
    const lista = screen.getByRole('listbox')
    expect(contenedor.contains(lista)).toBe(false)
    expect(document.body.contains(lista)).toBe(true)
  })
  it('sigue el valor cuando el padre lo cambia desde fuera (sin pasar por onElegir del propio campo)', async () => {
    render(<EnvoltorioExterno inicial="14" />)
    const campo = screen.getByRole('combobox')
    expect(campo).toHaveValue('iPhone 14')
    await userEvent.click(screen.getByRole('button', { name: 'elegir desde fuera' }))
    expect(campo).toHaveValue('iPhone 14 Pro Max')
  })
  it('escribir sobre lo elegido conserva el texto aunque el padre borre el valor en onTextoCambiado', async () => {
    render(<EnvoltorioQueBorra inicial="15" />)
    const campo = screen.getByRole('combobox')
    await userEvent.type(campo, 'x')
    expect(campo).toHaveValue('iPhone 15x')
    await userEvent.type(campo, 'y')
    expect(campo).toHaveValue('iPhone 15xy')
  })
})
