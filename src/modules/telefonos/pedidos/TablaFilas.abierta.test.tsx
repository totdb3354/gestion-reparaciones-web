import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { fila } from '../test/fabrica'
import { maquetarJsdom } from './layoutJsdom'
import { TablaFilas } from './TablaFilas'

const FILAS = [1, 2, 3].map((i) => fila({ idFila: i, pedido: `402-0000000-000000${i}` }))
const campo = () => screen.queryByRole('textbox', { name: 'IMEI' })

beforeEach(() => {
  maquetarJsdom()
  server.use(http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([])))
})

describe('TablaFilas: la celda abierta no se reabre sola', () => {
  it('si un filtro esconde la fila abierta, al quitarlo sigue cerrada', async () => {
    const user = userEvent.setup()
    function Filtrable() {
      const [soloTres, setSoloTres] = useState(false)
      return (<><button onClick={() => setSoloTres((s) => !s)}>filtrar</button><TablaFilas filas={soloTres ? FILAS.filter((f) => f.idFila === 3) : FILAS} /></>)
    }
    renderConProviders(<Filtrable />, { sesion: SESION_SUPER })
    await user.click(screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    expect(campo()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'filtrar', hidden: true }))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'filtrar' }))
    expect(campo()).not.toBeInTheDocument()
  })

  it('si la fila abierta pasa a enviada, se cierra y no se reabre al volver a estar sin enviar', async () => {
    const user = userEvent.setup()
    function Enviable() {
      const [enviada, setEnviada] = useState(false)
      return (<><button onClick={() => setEnviada((s) => !s)}>enviar</button><TablaFilas filas={[fila({ idFila: 1, enviada }), FILAS[1]]} /></>)
    }
    renderConProviders(<Enviable />, { sesion: SESION_SUPER })
    await user.click(screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    expect(campo()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'enviar', hidden: true }))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'enviar' }))
    expect(campo()).not.toBeInTheDocument()
  })
})
