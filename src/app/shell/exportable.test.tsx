import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ExportableProvider, useExportable, useRegistrarExportable } from './exportable'

/** Sonda que solo lee el exportador activo, como hace UserMenu. */
function Sonda() {
  const exportar = useExportable()
  return (
    <button disabled={!exportar} onClick={() => exportar?.()}>
      exportar
    </button>
  )
}

/**
 * Vista consumidora que registra una función INLINE (el punto de uso natural,
 * p.ej. useRegistrarExportable(() => exportarCsv())) y se re-renderiza a sí misma
 * un par de veces con un contador. Antes del fix, cada registro cambiaba la
 * identidad del contexto y de la función inline, lo que reiniciaba el efecto
 * sin parar ("Maximum update depth exceeded"); el guard de renders de abajo
 * corta ese bucle pronto para que el test falle rápido en vez de colgarse.
 */
function Consumidor({ llamadas, renderCountRef }: { llamadas: number[]; renderCountRef: { current: number } }) {
  const [contador, setContador] = useState(0)
  // Guard anti-bucle: mutar el ref en un layout effect (no durante el render, regla
  // react-hooks/refs) para que corte pronto si algo reintroduce el bucle de renderizado.
  useLayoutEffect(() => {
    renderCountRef.current += 1
    if (renderCountRef.current > 50) {
      throw new Error(`bucle de renderizado detectado: ${renderCountRef.current} renders`)
    }
  })
  useRegistrarExportable(() => {
    llamadas.push(contador)
  })
  return <button onClick={() => setContador((c) => c + 1)}>incrementar</button>
}

function ConsumidorSimple() {
  useRegistrarExportable(() => {})
  return null
}

function ConsumidorNulo() {
  useRegistrarExportable(null)
  return null
}

describe('exportable (registro de "Descargar CSV" de la vista activa)', () => {
  it('una función inline no provoca bucle de renderizado y usa siempre el último cierre', async () => {
    const llamadas: number[] = []
    const renderCountRef = { current: 0 }
    render(
      <ExportableProvider>
        <Consumidor llamadas={llamadas} renderCountRef={renderCountRef} />
        <Sonda />
      </ExportableProvider>,
    )
    expect(screen.getByRole('button', { name: 'exportar' })).not.toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'incrementar' }))
    await userEvent.click(screen.getByRole('button', { name: 'incrementar' }))
    await userEvent.click(screen.getByRole('button', { name: 'exportar' }))

    expect(llamadas).toEqual([2])
    expect(renderCountRef.current).toBeLessThan(20)
  })

  it('al desmontarse la vista que exporta, useExportable() vuelve a null', async () => {
    function Wrapper() {
      const [montado, setMontado] = useState(true)
      return (
        <ExportableProvider>
          {montado && <ConsumidorSimple />}
          <Sonda />
          <button onClick={() => setMontado(false)}>desmontar</button>
        </ExportableProvider>
      )
    }
    render(<Wrapper />)
    expect(screen.getByRole('button', { name: 'exportar' })).not.toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'desmontar' }))
    expect(screen.getByRole('button', { name: 'exportar' })).toBeDisabled()
  })

  it('una vista que registra null (p.ej. Clientes) deja useExportable() en null', () => {
    render(
      <ExportableProvider>
        <ConsumidorNulo />
        <Sonda />
      </ExportableProvider>,
    )
    expect(screen.getByRole('button', { name: 'exportar' })).toBeDisabled()
  })
})
