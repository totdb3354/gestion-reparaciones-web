import { getDefaultNormalizer, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { renderConProviders } from '@/test/render'
import { AjustarMinimoDialog } from './AjustarMinimoDialog'
import { parseEnteroNoNegativo, subtituloComponente } from './dialogos'
import { EditarStockDialog } from './EditarStockDialog'
import { SolicitarPiezaDialog } from './SolicitarPiezaDialog'

const comp: Componente = { idCom: 1, tipo: 'lcd-x', fechaRegistro: '2026-09-01T10:00:00', stock: 3, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null }

describe('helpers', () => {
  it('subtítulo con los tres espacios a cada lado del punto medio', () => {
    expect(subtituloComponente(comp)).toBe('Componente: lcd-x   ·   Stock actual: 3 ud(s).')
  })
  it('parseEnteroNoNegativo: entero ≥ 0 o null', () => {
    expect(parseEnteroNoNegativo(' 4 ')).toBe(4)
    expect(parseEnteroNoNegativo('0')).toBe(0)
    expect(parseEnteroNoNegativo('-3')).toBeNull()
    expect(parseEnteroNoNegativo('abc')).toBeNull()
    expect(parseEnteroNoNegativo('2.5')).toBeNull()
    expect(parseEnteroNoNegativo('')).toBeNull()
  })
})

describe('EditarStockDialog', () => {
  it('abre con el stock precargado y el subtítulo; confirma con el entero', async () => {
    const onConfirmar = vi.fn()
    renderConProviders(<EditarStockDialog componente={comp} enviando={false} onConfirmar={onConfirmar} onCancelar={vi.fn()} />)
    const dlg = within(screen.getByRole('dialog', { name: 'Editar stock' }))
    expect(dlg.getByText('Componente: lcd-x   ·   Stock actual: 3 ud(s).', { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument()
    const campo = dlg.getByLabelText('Nueva cantidad')
    expect(campo).toHaveValue('3')
    expect(campo).toHaveFocus()
    await userEvent.clear(campo)
    await userEvent.type(campo, '9{Enter}')
    expect(onConfirmar).toHaveBeenCalledWith(9)
  })
  it('con "-3" muestra el error y no confirma; el diálogo sigue abierto', async () => {
    const onConfirmar = vi.fn()
    renderConProviders(<EditarStockDialog componente={comp} enviando={false} onConfirmar={onConfirmar} onCancelar={vi.fn()} />)
    const campo = screen.getByLabelText('Nueva cantidad')
    await userEvent.clear(campo)
    await userEvent.type(campo, '-3')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Cantidad no válida (debe ser ≥ 0).')
    expect(onConfirmar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('un 422 del servidor se muestra inline y el diálogo sigue abierto; se oculta al teclear', async () => {
    renderConProviders(<EditarStockDialog componente={comp} enviando={false} errorServidor="Cantidad no válida (debe ser ≥ 0)." onConfirmar={vi.fn()} onCancelar={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Cantidad no válida (debe ser ≥ 0).')
    expect(screen.getByRole('dialog', { name: 'Editar stock' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('AjustarMinimoDialog', () => {
  it('título "Ajustar mínimo", subtítulo de componente, etiqueta "Nuevo stock mínimo:", precargado con el mínimo; error con -1', async () => {
    const onConfirmar = vi.fn()
    renderConProviders(<AjustarMinimoDialog componente={comp} enviando={false} onConfirmar={onConfirmar} onCancelar={vi.fn()} />)
    const dlg = within(screen.getByRole('dialog', { name: 'Ajustar mínimo' }))
    expect(dlg.getByText('Componente: lcd-x   ·   Stock actual: 3 ud(s).', { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument()
    const campo = dlg.getByLabelText('Nuevo stock mínimo:')
    expect(campo).toHaveValue('2')
    await userEvent.clear(campo)
    await userEvent.type(campo, '-1')
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Valor no válido (debe ser ≥ 0).')
    await userEvent.clear(campo)
    await userEvent.type(campo, '5{Enter}')
    expect(onConfirmar).toHaveBeenCalledWith(5)
  })
  it('un 422 del servidor se muestra inline y el diálogo sigue abierto; se oculta al teclear', async () => {
    renderConProviders(<AjustarMinimoDialog componente={comp} enviando={false} errorServidor="Valor no válido (debe ser ≥ 0)." onConfirmar={vi.fn()} onCancelar={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Valor no válido (debe ser ≥ 0).')
    expect(screen.getByRole('dialog', { name: 'Ajustar mínimo' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nuevo stock mínimo:'), '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('SolicitarPiezaDialog', () => {
  it('área de 3 filas con su placeholder y botón "Solicitar"; vacía → null, con texto → recortado', async () => {
    const onConfirmar = vi.fn()
    renderConProviders(<SolicitarPiezaDialog componente={comp} enviando={false} onConfirmar={onConfirmar} onCancelar={vi.fn()} />)
    const dlg = within(screen.getByRole('dialog', { name: 'Solicitar pieza' }))
    const area = dlg.getByLabelText('Descripción (opcional)')
    expect(area).toHaveAttribute('placeholder', 'Motivo o contexto de la solicitud...')
    expect(area).toHaveAttribute('rows', '3')
    expect(area).toHaveFocus()
    await userEvent.click(dlg.getByRole('button', { name: 'Solicitar' }))
    expect(onConfirmar).toHaveBeenLastCalledWith(null)
    await userEvent.type(area, '  urge  ')
    await userEvent.click(dlg.getByRole('button', { name: 'Solicitar' }))
    expect(onConfirmar).toHaveBeenLastCalledWith('urge')
  })
})
