import { useState } from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Blocker } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderConRouter } from '@/test/render'
import { GuardiaAtras } from './GuardiaAtras'

/** Monta la guarda como los diálogos que la usan (pedido nuevo, "Asignar trabajos"): guarda el bloqueo en su estado y lo
 *  enseña; "Quitar guarda" la desmonta, como cuando el diálogo se queda sin líneas o sin IMEIs. */
function Anfitrion() {
  const [bloqueo, setBloqueo] = useState<Blocker | null>(null)
  const [conGuarda, setConGuarda] = useState(true)
  return (
    <>
      <p>ESTADO {bloqueo?.state ?? 'ninguno'}</p>
      <button onClick={() => setConGuarda(false)}>Quitar guarda</button>
      {conGuarda && <GuardiaAtras activa onBloqueo={setBloqueo} />}
    </>
  )
}

describe('GuardiaAtras', () => {
  it('para el Atrás del navegador y entrega el bloqueo a quien la monta', async () => {
    const { router } = renderConRouter([{ path: '/a', element: <p>A</p> }, { path: '/b', element: <Anfitrion /> }], { ruta: '/a' })
    await act(() => router.navigate('/b'))
    expect(screen.getByText('ESTADO unblocked')).toBeInTheDocument()
    await act(() => router.navigate(-1))
    expect(screen.getByText('ESTADO blocked')).toBeInTheDocument()
  })

  it('al desmontarse entrega null: quien la monta no se queda con un bloqueo pendiente', async () => {
    const { router } = renderConRouter([{ path: '/a', element: <p>A</p> }, { path: '/b', element: <Anfitrion /> }], { ruta: '/a' })
    await act(() => router.navigate('/b'))
    await act(() => router.navigate(-1))
    expect(screen.getByText('ESTADO blocked')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar guarda' }))
    expect(screen.getByText('ESTADO ninguno')).toBeInTheDocument()
  })
})
