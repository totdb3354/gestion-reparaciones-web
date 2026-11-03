import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { useEfectosModal } from './useEfectosModal'
import type { Efecto } from './estado/tipos'

const IMEI = '111111111111111'
const pred: Efecto = { id: 1, tipo: 'prediccion', seq: 2, token: 1, imei: IMEI, conCliente: true, verdes: [] }

describe('useEfectosModal', () => {
  it('ejecuta cada efecto una sola vez, marca consumidos y despacha el resultado', async () => {
    let llamadas = 0
    server.use(
      http.post('*/api/glass/prediccion', () => {
        llamadas++
        return HttpResponse.json({ idTec: 4, nombre: 'x' })
      }),
    )
    const dispatch = vi.fn()
    const ids = new Set<number>()
    const { rerender } = renderHook(({ ef }) => useEfectosModal(ef, dispatch, ids), { initialProps: { ef: [pred] } })
    rerender({ ef: [pred] }) // el mismo efecto otra vez (StrictMode, re-render): no se repite
    expect(dispatch).toHaveBeenCalledWith({ tipo: 'EFECTOS_CONSUMIDOS', ids: [1] })
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ tipo: 'PREDICCION_RESUELTA', seq: 2, token: 1, idTec: 4 }))
    expect(llamadas).toBe(1)
  })

  it('una predicción que falla se despacha como fallida', async () => {
    server.use(http.post('*/api/glass/prediccion', () => new HttpResponse(null, { status: 500 })))
    const dispatch = vi.fn()
    renderHook(() => useEfectosModal([pred], dispatch, new Set()))
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ tipo: 'PREDICCION_FALLIDA', seq: 2, token: 1 }))
  })

  it('lookup y cliente de pulido', async () => {
    server.use(
      http.get('*/api/telefonos/:imei/modelo', () => HttpResponse.json({ value: '12' })),
      http.get('*/api/telefonos/:imei/cliente', () => HttpResponse.json({ value: '5' })),
    )
    const dispatch = vi.fn()
    const efectos: Efecto[] = [
      { id: 1, tipo: 'lookup', seq: 1, imei: IMEI, buscarModelo: true },
      { id: 2, tipo: 'clientePulido', seq: 3, imei: IMEI },
    ]
    renderHook(() => useEfectosModal(efectos, dispatch, new Set([5])))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ tipo: 'LOOKUP_RESUELTO', seq: 1, modelo: '12', idCliBd: 5 })
      expect(dispatch).toHaveBeenCalledWith({ tipo: 'PULIDO_CLIENTE_BD', seq: 3, idCli: 5 })
    })
  })
  it('0.9.23: comprobarNsys despacha lo que dice NSYS', async () => {
    server.use(http.post('*/api/stock-telefonos/comprobar', () => HttpResponse.json([{ imei: IMEI, encontrado: false }])))
    const dispatch = vi.fn()
    renderHook(() => useEfectosModal([{ id: 1, tipo: 'comprobarNsys', imeis: [IMEI] }], dispatch, new Set()))
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ tipo: 'NSYS_COMPROBADO', resultado: { [IMEI]: false } }))
  })

  it('0.9.23: si la pregunta a NSYS falla no se despacha nada más que los consumidos', async () => {
    let pedida = false
    server.use(http.post('*/api/stock-telefonos/comprobar', () => {
      pedida = true
      return new HttpResponse(null, { status: 500 })
    }))
    const dispatch = vi.fn()
    renderHook(() => useEfectosModal([{ id: 1, tipo: 'comprobarNsys', imeis: [IMEI] }], dispatch, new Set()))
    await waitFor(() => expect(pedida).toBe(true))
    await new Promise((r) => setTimeout(r, 20))
    expect(dispatch.mock.calls.map(([a]) => a.tipo)).toEqual(['EFECTOS_CONSUMIDOS'])
  })
})
