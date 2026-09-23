import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoEscaneo } from './CampoEscaneo'
import { FilaCola } from './FilaCola'
import { ListaTecnicos } from './ListaTecnicos'
import { entrada } from './estado/fabrica'
import { filaCarga, tecnico } from '../../test/fabrica'

const IMEI = '111111111111111'

describe('CampoEscaneo', () => {
  it('solo dígitos; a los 15 se entrega sin Enter y se vacía si se acepta', async () => {
    const onImei = vi.fn(() => true)
    render(<CampoEscaneo etiqueta="Escanear IMEI → pendiente de asignar" onImei={onImei} onPegado={vi.fn()} />)
    const campo = screen.getByRole('textbox')
    await userEvent.type(campo, '11111a1111111111')
    expect(onImei).toHaveBeenCalledWith(IMEI)
    expect(campo).toHaveValue('')
  })
  it('si no se acepta (repetido) los dígitos se quedan', async () => {
    render(<CampoEscaneo etiqueta="x" onImei={() => false} onPegado={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), IMEI)
    expect(screen.getByRole('textbox')).toHaveValue(IMEI)
  })
  it('incompleto + Enter no hace nada y conserva los dígitos (D6)', async () => {
    const onImei = vi.fn(() => true)
    render(<CampoEscaneo etiqueta="x" onImei={onImei} onPegado={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), '12345{Enter}')
    expect(onImei).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('12345')
  })
  it('un pegado de más de 15 va a onPegado y vacía el campo', async () => {
    const onPegado = vi.fn()
    render(<CampoEscaneo etiqueta="x" onImei={vi.fn(() => true)} onPegado={onPegado} />)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(`${IMEI}\n222222222222222`)
    expect(onPegado).toHaveBeenCalledWith(`${IMEI}222222222222222`)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })
  it('onTeclear se llama en cada cambio con 15 dígitos o menos, antes de entregar', async () => {
    const llamadas: string[] = []
    const onImei = vi.fn(() => { llamadas.push('entregar'); return true })
    const onTeclear = vi.fn(() => llamadas.push('teclear'))
    render(<CampoEscaneo etiqueta="x" onImei={onImei} onPegado={vi.fn()} onTeclear={onTeclear} />)
    await userEvent.type(screen.getByRole('textbox'), IMEI.slice(0, 3))
    expect(onTeclear).toHaveBeenCalledTimes(3)
    await userEvent.type(screen.getByRole('textbox'), IMEI.slice(3))
    expect(onImei).toHaveBeenCalledWith(IMEI)
    // en el cambio que entrega los 15 dígitos, onTeclear se llama justo antes que onImei
    expect(llamadas.slice(-2)).toEqual(['teclear', 'entregar'])
  })
  it('un pegado (>15) no llama a onTeclear', async () => {
    const onTeclear = vi.fn()
    render(<CampoEscaneo etiqueta="x" onImei={vi.fn(() => true)} onPegado={vi.fn()} onTeclear={onTeclear} />)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(`${IMEI}222222222222222`)
    expect(onTeclear).not.toHaveBeenCalled()
  })
})

describe('FilaCola', () => {
  it('roja: IMEI, badge y pastilla de modelo / buscando / falta modelo', () => {
    const { rerender } = render(<FilaCola e={entrada({ seq: 1, imei: IMEI, modelo: '14' })} nombresTecnicos="" seleccionada={false} onCargar={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Rep')).toBeInTheDocument()
    expect(screen.getByText('iPhone 14')).toBeInTheDocument()
    rerender(<FilaCola e={entrada({ seq: 1, imei: IMEI, buscando: true })} nombresTecnicos="" seleccionada={false} onCargar={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Buscando…')).toBeInTheDocument()
    rerender(<FilaCola e={entrada({ seq: 1, imei: IMEI })} nombresTecnicos="" seleccionada={false} onCargar={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('⚠ falta modelo')).toBeInTheDocument()
  })
  it('verde glass automática: "auto" y los técnicos; "Calculando…" mientras llega la predicción', () => {
    const { rerender } = render(<FilaCola e={entrada({ seq: 2, imei: IMEI, tipo: 'GLASS', asignada: true, auto: true, tecnicos: [4], modelo: '14' })}
      nombresTecnicos="Técnico G" seleccionada={false} onCargar={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Glass')).toBeInTheDocument()
    expect(screen.getByText('auto')).toBeInTheDocument()
    expect(screen.getByText('Técnico G')).toBeInTheDocument()
    rerender(<FilaCola e={entrada({ seq: 2, imei: IMEI, tipo: 'GLASS', calculando: true, modelo: '14' })} nombresTecnicos="" seleccionada={false} onCargar={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Calculando…')).toBeInTheDocument()
  })
  it('clic carga; la ✕ quita sin cargar', async () => {
    const onCargar = vi.fn()
    const onQuitar = vi.fn()
    render(<FilaCola e={entrada({ seq: 1, imei: IMEI })} nombresTecnicos="" seleccionada={false} onCargar={onCargar} onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: `Quitar ${IMEI}` }))
    expect(onQuitar).toHaveBeenCalled()
    expect(onCargar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText(IMEI))
    expect(onCargar).toHaveBeenCalled()
  })
})

describe('ListaTecnicos', () => {
  const tecnicos = [tecnico({ idTec: 3, nombre: 'Técnico A', esGlass: true }), tecnico({ idTec: 4, nombre: 'Técnico B' })]
  const carga = [filaCarga({ idTec: 3, pctPendiente: 29, pctHecho: 0 })]

  it('nombre ● % de Pedidos (0% si no está en la carga) y pastilla "glass" solo en la cola Glass', () => {
    const { rerender } = render(<ListaTecnicos tecnicos={tecnicos} carga={carga} marcados={[]} ocupados={new Set()} marcarGlass={false} onMarcar={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /Técnico A.*29%/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Técnico B.*0%/ })).toBeInTheDocument()
    expect(screen.queryByText('glass')).toBeNull()
    rerender(<ListaTecnicos tecnicos={tecnicos} carga={carga} marcados={[]} ocupados={new Set()} marcarGlass onMarcar={vi.fn()} />)
    expect(screen.getByText('glass')).toBeInTheDocument()
  })
  it('ocupados deshabilitados y pastilla "N asignado(s)"', () => {
    const { rerender } = render(<ListaTecnicos tecnicos={tecnicos} carga={carga} marcados={[]} ocupados={new Set([3])} marcarGlass={false} onMarcar={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /Técnico A/ })).toBeDisabled()
    expect(screen.getByText('1 asignado')).toBeInTheDocument()
    rerender(<ListaTecnicos tecnicos={tecnicos} carga={carga} marcados={[]} ocupados={new Set([3, 4])} marcarGlass={false} onMarcar={vi.fn()} />)
    expect(screen.getByText('2 asignados')).toBeInTheDocument()
  })
  it('marcar avisa con el id y el nuevo estado', async () => {
    const onMarcar = vi.fn()
    render(<ListaTecnicos tecnicos={tecnicos} carga={carga} marcados={[4]} ocupados={new Set()} marcarGlass={false} onMarcar={onMarcar} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /Técnico A/ }))
    expect(onMarcar).toHaveBeenCalledWith(3, true)
    await userEvent.click(screen.getByRole('checkbox', { name: /Técnico B/ }))
    expect(onMarcar).toHaveBeenCalledWith(4, false)
  })
})
