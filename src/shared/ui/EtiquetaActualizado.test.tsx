import { useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConexionError } from '@/shared/api/errors'
import { renderConProviders } from '@/test/render'
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
  it('pulsar varias veces antes de que acabe la recarga no abre el diálogo «CancelledError»: cuenta la última', async () => {
    // Consulta real de TanStack: cada refetch (cancelRefetch por defecto) cancela el anterior en curso; desde el
    // tercer clic, la promesa del primero rechaza con CancelledError. La primera carga responde al momento; las
    // recargas esperan a que el test las suelte.
    const pendientes: Array<() => void> = []
    let llamadas = 0
    const pedir = () => {
      llamadas += 1
      if (llamadas === 1) return Promise.resolve(llamadas)
      const valor = llamadas
      return new Promise<number>((resolver) => pendientes.push(() => resolver(valor)))
    }
    function Vista() {
      const { dataUpdatedAt, refetch } = useQuery({ queryKey: ['etiqueta-varios-clics'], queryFn: pedir })
      return <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
    }
    const { queryClient } = renderConProviders(<Vista />)
    const boton = await screen.findByRole('button', { name: /^Actualizado/ })
    for (let i = 0; i < 3; i++) await userEvent.click(boton)
    pendientes.forEach((soltar) => soltar())
    await waitFor(() => expect(queryClient.getQueryData(['etiqueta-varios-clics'])).toBe(4))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
