import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConexionError } from '@/shared/api/errors'
import { AlertaProvider } from './AlertaProvider'
import { EtiquetaActualizado } from './EtiquetaActualizado'

describe('EtiquetaActualizado (calco de lblUltimaActualizacion)', () => {
  it('muestra "Actualizado HH:mm" con la hora local y recarga al pulsar', async () => {
    const recargar = vi.fn().mockResolvedValue(undefined)
    const cuando = new Date(2026, 8, 16, 9, 21).getTime()
    render(<AlertaProvider><EtiquetaActualizado actualizadoEn={cuando} onRecargar={recargar} /></AlertaProvider>)
    const boton = screen.getByRole('button', { name: 'Actualizado 09:21' })
    expect(boton).toHaveClass('text-[10px]', 'text-texto-vacio')
    await userEvent.click(boton)
    expect(recargar).toHaveBeenCalledTimes(1)
  })
  it('sin fecha no muestra texto', () => {
    render(<AlertaProvider><EtiquetaActualizado actualizadoEn={0} onRecargar={() => Promise.resolve()} /></AlertaProvider>)
    expect(screen.getByRole('button')).toHaveTextContent('')
  })
  it('si la recarga manual falla por conexión abre el diálogo con el detalle (la pidió el usuario)', async () => {
    const recargar = vi.fn().mockRejectedValue(new ConexionError(0, 'Sin conexión con el servidor.', 'Failed to fetch'))
    render(<AlertaProvider><EtiquetaActualizado actualizadoEn={Date.now()} onRecargar={recargar} /></AlertaProvider>)
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Sin conexión con el servidor: Failed to fetch'))
  })
})
