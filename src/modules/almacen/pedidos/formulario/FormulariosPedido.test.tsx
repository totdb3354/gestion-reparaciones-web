import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirNuevoPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { COMPONENTES, PROVEEDORES } from './datosPrueba'
import { FormulariosPedido } from './FormulariosPedido'

beforeEach(() => {
  server.use(
    http.get('*/api/componentes/gestionados', () => HttpResponse.json(COMPONENTES)),
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
  )
})

describe('FormulariosPedido', () => {
  it('sin formulario abierto no pinta nada', () => {
    renderConProviders(<FormulariosPedido />, { sesion: SESION_SUPER })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('abrirNuevoPedido pinta "Nuevo pedido"; "Cancelar" vacía el store y lo quita', async () => {
    renderConProviders(<FormulariosPedido />, { sesion: SESION_SUPER })
    act(() => abrirNuevoPedido({ modo: 'vacio' }))
    expect(await screen.findByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(formularioPedido.get()).toBeNull()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('una apertura nueva con el formulario abierto lo remonta con su precarga (key por apertura)', async () => {
    renderConProviders(<FormulariosPedido />, { sesion: SESION_SUPER })
    act(() => abrirNuevoPedido({ modo: 'componentes', idsCom: [2] }))
    expect(await screen.findByRole('combobox', { name: 'Componente línea 1' })).toHaveValue('bat-x')
    act(() => abrirNuevoPedido({ modo: 'componentes', idsCom: [1] }))
    expect(await screen.findByDisplayValue('lcd-x-negro')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('bat-x')).not.toBeInTheDocument()
  })
})
