import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { resumen, tecnico } from '../test/fabrica'
import { DialogoIncidencia } from './DialogoIncidencia'

const rep = resumen({ idRep: 'R20260916_6', imei: '358800000000131', idTec: 5 })

beforeEach(() => {
  server.use(http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 5, nombre: 'tecnico_i' })])))
})

async function abrir() {
  const onGuardar = vi.fn()
  renderConProviders(<DialogoIncidencia rep={rep} enviando={false} onGuardar={onGuardar} onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
  const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
  await waitFor(() => expect(within(dlg).getByLabelText('Técnico asignado')).toHaveValue('5'))
  await userEvent.type(within(dlg).getByLabelText('Comentario de incidencia'), 'no carga')
  return { dlg, onGuardar }
}

describe('DialogoIncidencia', () => {
  it('dos clics seguidos en "Añadir incidencia y asignar" guardan una sola vez', async () => {
    const { dlg, onGuardar } = await abrir()
    const boton = within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar).toHaveBeenCalledWith('no carga', 5)
  })
  it('mientras guarda, el botón, "Cerrar" y Escape no hacen nada', async () => {
    const onGuardar = vi.fn()
    const onCerrar = vi.fn()
    renderConProviders(<DialogoIncidencia rep={rep} enviando onGuardar={onGuardar} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
    expect(within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })).toBeDisabled()
    expect(within(dlg).getByRole('button', { name: 'Cerrar' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
