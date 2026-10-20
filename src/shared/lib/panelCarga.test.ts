import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CLAVE_PANEL_CARGA, PANEL_DE_FABRICA, abrirPanelCarga, cambiarAlcancePanelCarga, cerrarPanelCarga,
  leerPanelCarga, minimizarPanelCarga, moverPanelCarga, panelCarga, pedirFiltroPorTecnico, recibirFiltroPorTecnico,
  usePanelCarga,
} from './panelCarga'
import { reiniciarStores } from './store'

const guardado = () => JSON.parse(localStorage.getItem(CLAVE_PANEL_CARGA) ?? 'null')

describe('leerPanelCarga', () => {
  it('sin nada guardado: abierto, Pedidos, arriba a la derecha a 16 px', () => {
    expect(leerPanelCarga()).toEqual({ estado: 'abierto', alcance: 'pedidos', ancla: { esq: 'tr', x: 16, y: 16 } })
  })

  it('lee lo guardado', () => {
    localStorage.setItem(CLAVE_PANEL_CARGA, JSON.stringify({ estado: 'minimizado', alcance: 'total', ancla: { esq: 'tl', x: 20, y: 36 } }))
    expect(leerPanelCarga()).toEqual({ estado: 'minimizado', alcance: 'total', ancla: { esq: 'tl', x: 20, y: 36 } })
  })

  it('un JSON roto da lo de fábrica', () => {
    localStorage.setItem(CLAVE_PANEL_CARGA, '{roto')
    expect(leerPanelCarga()).toEqual(PANEL_DE_FABRICA)
  })

  it('cada campo inválido cae a lo de fábrica sin arrastrar a los demás', () => {
    localStorage.setItem(CLAVE_PANEL_CARGA, JSON.stringify({ estado: 'flotando', alcance: 'total', ancla: { esq: 'br', x: -5, y: 3 } }))
    expect(leerPanelCarga()).toEqual({ estado: 'abierto', alcance: 'total', ancla: { esq: 'tr', x: 16, y: 16 } })
  })

  it('si el navegador no deja leer, lo de fábrica', () => {
    const espia = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    try {
      expect(leerPanelCarga()).toEqual(PANEL_DE_FABRICA)
    } finally {
      espia.mockRestore()
    }
  })
})

describe('acciones del panel', () => {
  it('cada acción cambia el store y lo guarda', () => {
    minimizarPanelCarga()
    expect(panelCarga.get().estado).toBe('minimizado')
    expect(guardado()).toMatchObject({ estado: 'minimizado' })
    cambiarAlcancePanelCarga('total')
    moverPanelCarga({ esq: 'tl', x: 20, y: 36 })
    expect(guardado()).toEqual({ estado: 'minimizado', alcance: 'total', ancla: { esq: 'tl', x: 20, y: 36 } })
    cerrarPanelCarga()
    expect(panelCarga.get().estado).toBe('cerrado')
    abrirPanelCarga()
    expect(panelCarga.get().estado).toBe('abierto')
  })

  it('si el navegador no deja guardar, el cambio vale para la página', () => {
    const espia = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('almacenamiento lleno')
    })
    try {
      cerrarPanelCarga()
      expect(panelCarga.get().estado).toBe('cerrado')
    } finally {
      espia.mockRestore()
    }
  })

  it('al reiniciar los stores (cierre de sesión) se relee lo guardado, no se vuelve a lo de fábrica', () => {
    minimizarPanelCarga()
    reiniciarStores()
    expect(panelCarga.get().estado).toBe('minimizado')
  })

  it('usePanelCarga sigue los cambios', () => {
    const { result } = renderHook(() => usePanelCarga())
    expect(result.current.estado).toBe('abierto')
    act(() => minimizarPanelCarga())
    expect(result.current.estado).toBe('minimizado')
  })
})

describe('filtro por técnico pedido desde el panel', () => {
  it('lo pedido antes de que Asignaciones escuche se entrega al empezar, una sola vez', () => {
    pedirFiltroPorTecnico(4)
    const aplicar = vi.fn()
    const baja = recibirFiltroPorTecnico(aplicar)
    expect(aplicar.mock.calls).toEqual([[4]])
    baja()
    const otra = vi.fn()
    recibirFiltroPorTecnico(otra)()
    expect(otra).not.toHaveBeenCalled()
  })

  it('lo pedido con Asignaciones ya escuchando se entrega en el acto; tras la baja, ya no', () => {
    const aplicar = vi.fn()
    const baja = recibirFiltroPorTecnico(aplicar)
    pedirFiltroPorTecnico(2)
    expect(aplicar.mock.calls).toEqual([[2]])
    baja()
    pedirFiltroPorTecnico(3)
    expect(aplicar.mock.calls).toEqual([[2]])
  })
})
