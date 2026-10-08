import { fireEvent, getDefaultNormalizer, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { renderConProviders } from '@/test/render'
import type { FilaStock } from './grupos'
import { SolicitarPiezaDialog } from './SolicitarPiezaDialog'

const base: Componente = { idCom: 1, tipo: 'cami13', fechaRegistro: '2026-09-01T10:00:00', stock: 4, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null, consumoDiario: null, pedir60: null }
const slave: Componente = { ...base, idCom: 2, tipo: 'cami13pro', idComMaster: 1 }
const suelta: FilaStock = { ...base, miembros: [base] }
const grupo: FilaStock = { ...base, miembros: [base, slave] }

const montar = (componente: FilaStock | null, onConfirmar = vi.fn()) => {
  const ui = (c: FilaStock | null) => <SolicitarPiezaDialog componente={c} enviando={false} onConfirmar={onConfirmar} onCancelar={vi.fn()} />
  const r = renderConProviders(ui(componente))
  return { onConfirmar, rerender: (c: FilaStock | null) => r.rerender(ui(c)) }
}
const dialogo = () => within(screen.getByRole('dialog', { name: 'Solicitar pieza' }))

describe('SolicitarPiezaDialog con grupo compartido', () => {
  it('fila suelta: sin campo Modelo y envía su idCom', async () => {
    const { onConfirmar } = montar(suelta)
    expect(dialogo().queryByRole('combobox', { name: 'Modelo' })).not.toBeInTheDocument()
    await userEvent.click(dialogo().getByRole('button', { name: 'Solicitar' }))
    expect(onConfirmar).toHaveBeenCalledWith(1, null)
  })
  it('grupo: subtítulo con el nombre del grupo, Modelo sin elegir y "Solicitar" desactivado', () => {
    montar(grupo)
    expect(screen.getByText('Componente: cami13 / cami13pro   ·   Stock actual: 4 ud(s).', { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument()
    expect(dialogo().getByRole('combobox', { name: 'Modelo' })).not.toHaveTextContent('cami13')
    expect(dialogo().getByRole('button', { name: 'Solicitar' })).toBeDisabled()
  })
  it('grupo: confirmar sin elegir (Enter) muestra "Elige el modelo." y no envía', () => {
    const { onConfirmar } = montar(grupo)
    fireEvent.submit(dialogo().getByRole('button', { name: 'Solicitar' }).closest('form')!)
    expect(dialogo().getByRole('alert')).toHaveTextContent('Elige el modelo.')
    expect(onConfirmar).not.toHaveBeenCalled()
  })
  it('grupo: elegir el slave envía el idCom del slave', async () => {
    const { onConfirmar } = montar(grupo)
    await userEvent.click(dialogo().getByRole('combobox', { name: 'Modelo' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Modelo' })).getByRole('button', { name: 'cami13pro' }))
    await userEvent.type(dialogo().getByLabelText('Descripción (opcional)'), ' urge ')
    await userEvent.click(dialogo().getByRole('button', { name: 'Solicitar' }))
    expect(onConfirmar).toHaveBeenCalledWith(2, 'urge')
  })
  it('al reabrir no queda elegido nada', async () => {
    const { rerender } = montar(grupo)
    await userEvent.click(dialogo().getByRole('combobox', { name: 'Modelo' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Modelo' })).getByRole('button', { name: 'cami13' }))
    await userEvent.type(dialogo().getByLabelText('Descripción (opcional)'), 'x')
    rerender(null)
    rerender(grupo)
    expect(dialogo().getByRole('combobox', { name: 'Modelo' })).not.toHaveTextContent('cami13')
    expect(dialogo().getByLabelText('Descripción (opcional)')).toHaveValue('')
    expect(dialogo().getByRole('button', { name: 'Solicitar' })).toBeDisabled()
  })
})
