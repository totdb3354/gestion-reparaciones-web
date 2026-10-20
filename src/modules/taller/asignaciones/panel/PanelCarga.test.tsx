import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Outlet } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_CARGA_TECNICOS } from '@/shared/api/cargaTecnicos'
import type { CargaTecnicosRespuesta } from '@/shared/api/client'
import { INTERVALO_CARGA_MS } from '@/shared/api/refresco'
import {
  abrirPanelCarga, CLAVE_PANEL_CARGA, cerrarPanelCarga, minimizarPanelCarga, moverPanelCarga, panelCarga, recibirFiltroPorTecnico,
} from '@/shared/lib/panelCarga'
import { renderConProviders, renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { desglose, filaCarga } from '../../test/fabrica'
import { PanelCarga } from './PanelCarga'

// Pedidos: B 95 (≥ 90), A 50, C 0. Total: A 95 y C 92 (los dos ≥ 90), B 0. El toggle reordena y cambia el contador.
const RESPUESTA: CargaTecnicosRespuesta = {
  pedidos: [
    filaCarga({ idTec: 1, nombre: 'Técnico A', pctHecho: 20, pctPendiente: 30, pendiente: desglose({ normales: 3 }) }),
    filaCarga({ idTec: 2, nombre: 'Técnico B', pctHecho: 40, pctPendiente: 55 }),
    filaCarga({ idTec: 3, nombre: 'Técnico C' }),
  ],
  total: [
    filaCarga({ idTec: 1, nombre: 'Técnico A', pctHecho: 50, pctPendiente: 45 }),
    filaCarga({ idTec: 2, nombre: 'Técnico B' }),
    filaCarga({ idTec: 3, nombre: 'Técnico C', pctHecho: 60, pctPendiente: 32 }),
  ],
}

// Lo que llega en el refresco siguiente: en Pedidos, C 99, A 92 (dos ≥ 90) y B 10. Orden C, A, B.
const SIGUIENTE: CargaTecnicosRespuesta = {
  pedidos: [
    filaCarga({ idTec: 1, nombre: 'Técnico A', pctHecho: 42, pctPendiente: 50 }),
    filaCarga({ idTec: 2, nombre: 'Técnico B', pctPendiente: 10 }),
    filaCarga({ idTec: 3, nombre: 'Técnico C', pctHecho: 9, pctPendiente: 90 }),
  ],
  total: RESPUESTA.total,
}

function servirCarga(respuesta: CargaTecnicosRespuesta = RESPUESTA) {
  const peticiones = { n: 0 }
  server.use(
    http.get('*/api/reparaciones/carga-tecnicos', () => {
      peticiones.n += 1
      return HttpResponse.json(respuesta)
    }),
  )
  return peticiones
}

const montar = (sesion = SESION_SUPER) => renderConProviders(<PanelCarga />, { sesion })
const panel = () => screen.getByRole('region', { name: 'Carga de técnicos' })
const esperarLista = async () =>
  within(await screen.findByRole('region', { name: 'Carga de técnicos' })).findByRole('list', { name: 'Carga por técnico' })
/** Nombres en el orden pintado: el primer <span> de cada fila es el nombre. */
const nombres = () =>
  within(within(panel()).getByRole('list', { name: 'Carga por técnico' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('span')?.textContent)
const filaDe = (nombre: string) => within(panel()).getByText(nombre).closest('button')!
const pastilla = () => screen.getByTestId('pastilla-carga')
const guardado = () => JSON.parse(localStorage.getItem(CLAVE_PANEL_CARGA) ?? 'null')
const avanzar = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

afterEach(() => {
  vi.useRealTimers()
})

describe('PanelCarga: quién lo ve', () => {
  it('el técnico: ni panel ni pastilla, y no pide la carga', async () => {
    const peticiones = servirCarga()
    montar(SESION_TEC)
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(screen.queryByRole('region', { name: 'Carga de técnicos' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pastilla-carga')).not.toBeInTheDocument()
    expect(peticiones.n).toBe(0)
  })

  it('el supertécnico, de fábrica: abierto, en Pedidos, de más a menos carga y abajo a la derecha', async () => {
    servirCarga()
    montar()
    await esperarLista()
    expect(nombres()).toEqual(['Técnico B', 'Técnico A', 'Técnico C'])
    expect(within(panel()).getByRole('button', { name: 'Pedidos' })).toHaveAttribute('aria-pressed', 'true')
    expect(panel()).toHaveStyle({ right: '16px', bottom: '16px' })
  })

  it('el admin también lo ve', async () => {
    servirCarga()
    montar(SESION_ADMIN)
    expect(await esperarLista()).toBeInTheDocument()
  })
})

describe('PanelCarga: abierto', () => {
  it('Total reordena sin volver a pedir y se recuerda', async () => {
    const peticiones = servirCarga()
    montar()
    await esperarLista()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Total' }))
    expect(nombres()).toEqual(['Técnico A', 'Técnico C', 'Técnico B'])
    expect(peticiones.n).toBe(1)
    expect(guardado()).toMatchObject({ alcance: 'total' })
  })

  it('pinta el sitio recordado (arriba se cuenta desde la barra azul de 64 px)', async () => {
    moverPanelCarga({ esq: 'tl', x: 20, y: 36 })
    servirCarga()
    montar()
    await esperarLista()
    expect(panel()).toHaveStyle({ left: '20px', top: '100px' })
  })

  it('el tooltip de la fila lleva el desglose y la pista del clic', async () => {
    servirCarga()
    montar()
    await esperarLista()
    expect(filaDe('Técnico A')).toHaveAttribute('title', 'Pendiente: 3 normales\nClick: ver sus asignaciones')
  })

  it('sin técnicos activos lo dice', async () => {
    servirCarga({ pedidos: [], total: [] })
    montar()
    expect(await screen.findByText('Sin técnicos activos')).toBeInTheDocument()
  })

  it('si falla sin datos, el mensaje va en el panel y no se apila el diálogo de error global', async () => {
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => new HttpResponse(null, { status: 500 })))
    montar()
    expect(await screen.findByText('No se pudo cargar la carga de técnicos.')).toBeInTheDocument()
    expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape y un clic fuera no lo cierran', async () => {
    servirCarga()
    montar()
    await esperarLista()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(document.body)
    expect(panel()).toBeInTheDocument()
    expect(panelCarga.get().estado).toBe('abierto')
  })
})

describe('PanelCarga: minimizado y cerrado', () => {
  it('«–» deja la pastilla con una mini-barra por técnico y el contador; un clic la abre', async () => {
    servirCarga()
    montar()
    await esperarLista()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Minimizar el panel de carga' }))
    expect(screen.queryByRole('region', { name: 'Carga de técnicos' })).not.toBeInTheDocument()
    expect(within(pastilla()).getByText('1 al 90 %+')).toBeInTheDocument()
    expect(pastilla().querySelectorAll('i')).toHaveLength(3)
    expect(guardado()).toMatchObject({ estado: 'minimizado' })
    await userEvent.click(within(pastilla()).getByRole('button', { name: 'Abrir el panel de carga' }))
    expect(await esperarLista()).toBeInTheDocument()
  })

  it('el contador de la pastilla sigue al alcance', async () => {
    servirCarga()
    montar()
    await esperarLista()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Total' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Minimizar el panel de carga' }))
    expect(within(pastilla()).getByText('2 al 90 %+')).toBeInTheDocument()
  })

  it('la × de la pastilla lo cierra', async () => {
    servirCarga()
    minimizarPanelCarga()
    montar()
    await within(await screen.findByTestId('pastilla-carga')).findByText('1 al 90 %+')
    await userEvent.click(within(pastilla()).getByRole('button', { name: 'Cerrar el panel de carga' }))
    expect(screen.queryByTestId('pastilla-carga')).not.toBeInTheDocument()
    expect(panelCarga.get().estado).toBe('cerrado')
  })
})

describe('PanelCarga: actualización', () => {
  it('abierto o minimizado vuelve a pedir cada 30 s; cerrado no pide nada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const peticiones = servirCarga()
    montar()
    await esperarLista()
    expect(peticiones.n).toBe(1)
    await avanzar(INTERVALO_CARGA_MS)
    await waitFor(() => expect(peticiones.n).toBe(2))
    act(() => minimizarPanelCarga())
    await avanzar(INTERVALO_CARGA_MS)
    await waitFor(() => expect(peticiones.n).toBe(3))
    act(() => cerrarPanelCarga())
    await avanzar(INTERVALO_CARGA_MS * 2)
    expect(peticiones.n).toBe(3)
  })

  it('con el ratón encima no cambia nada; al salir se pone al día', async () => {
    servirCarga()
    const { queryClient } = montar()
    await esperarLista()
    fireEvent.pointerEnter(panel())
    const peticiones = servirCarga(SIGUIENTE)
    await act(() => queryClient.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS }))
    await waitFor(() => expect(peticiones.n).toBe(1))
    expect(nombres()).toEqual(['Técnico B', 'Técnico A', 'Técnico C'])
    fireEvent.pointerLeave(panel())
    expect(nombres()).toEqual(['Técnico C', 'Técnico A', 'Técnico B'])
  })

  it('si se minimiza con el ratón encima, la pastilla no se queda congelada', async () => {
    servirCarga()
    const { queryClient } = montar()
    await esperarLista()
    fireEvent.pointerEnter(panel())
    await userEvent.click(within(panel()).getByRole('button', { name: 'Minimizar el panel de carga' }))
    servirCarga(SIGUIENTE)
    await act(() => queryClient.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS }))
    expect(await within(pastilla()).findByText('2 al 90 %+')).toBeInTheDocument()
  })

  it('minimizar con el ratón encima y reabrir desde fuera no deja el panel congelado', async () => {
    servirCarga()
    const { queryClient } = montar()
    await esperarLista()
    fireEvent.pointerEnter(panel())
    await userEvent.click(within(panel()).getByRole('button', { name: 'Minimizar el panel de carga' }))
    act(() => abrirPanelCarga())
    servirCarga(SIGUIENTE)
    await act(() => queryClient.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS }))
    await waitFor(() => expect(nombres()).toEqual(['Técnico C', 'Técnico A', 'Técnico B']))
  })

  it('cerrar con el ratón encima y reabrir desde fuera no deja el panel congelado', async () => {
    servirCarga()
    const { queryClient } = montar()
    await esperarLista()
    fireEvent.pointerEnter(panel())
    await userEvent.click(within(panel()).getByRole('button', { name: 'Cerrar el panel de carga' }))
    act(() => abrirPanelCarga())
    servirCarga(SIGUIENTE)
    await act(() => queryClient.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS }))
    await waitFor(() => expect(nombres()).toEqual(['Técnico C', 'Técnico A', 'Técnico B']))
  })

  it('si el refresco falla teniendo datos, se siguen viendo y no sale el mensaje de error', async () => {
    servirCarga()
    const { queryClient } = montar()
    await esperarLista()
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => new HttpResponse(null, { status: 500 })))
    await act(() => queryClient.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS }))
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(nombres()).toEqual(['Técnico B', 'Técnico A', 'Técnico C'])
    expect(screen.queryByText('No se pudo cargar la carga de técnicos.')).not.toBeInTheDocument()
  })

  it('la pastilla sin datos solo dice «Carga»', async () => {
    server.use(http.get('*/api/reparaciones/carga-tecnicos', () => new HttpResponse(null, { status: 500 })))
    minimizarPanelCarga()
    montar()
    const caja = await screen.findByTestId('pastilla-carga')
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(within(caja).getByText('Carga')).toBeInTheDocument()
    expect(within(caja).queryByText(/al 90 %\+/)).not.toBeInTheDocument()
  })
})

describe('PanelCarga: arrastre', () => {
  // jsdom no pinta: las cajas miden 0 × 0 y están en el origen, y la ventana mide 1024 × 768 (innerWidth/innerHeight).
  it('soltar la pastilla en otro sitio guarda la esquina más cercana y no la abre', async () => {
    servirCarga()
    minimizarPanelCarga()
    montar()
    const caja = await screen.findByTestId('pastilla-carga')
    const abrir = within(caja).getByRole('button', { name: 'Abrir el panel de carga' })
    // 300 px a la izquierda y 250 hacia arriba: la caja queda en (0, 64), recortada (nunca bajo la barra azul).
    fireEvent.pointerDown(abrir, { pointerId: 1, button: 0, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(caja, { pointerId: 1, clientX: 200, clientY: 150 })
    expect(caja).toHaveStyle({ left: '0px', top: '64px' })
    fireEvent.pointerUp(caja, { pointerId: 1, clientX: 200, clientY: 150 })
    fireEvent.click(caja) // el clic que el navegador manda al soltar: con la captura, al contenedor
    expect(panelCarga.get()).toMatchObject({ estado: 'minimizado', ancla: { esq: 'tl', x: 0, y: 0 } })
    expect(guardado()).toMatchObject({ ancla: { esq: 'tl', x: 0, y: 0 } })
    expect(screen.getByTestId('pastilla-carga')).toHaveStyle({ left: '0px', top: '64px' })
  })

  it('un clic sin moverse (por debajo de 4 px) la abre', async () => {
    servirCarga()
    minimizarPanelCarga()
    montar()
    const caja = await screen.findByTestId('pastilla-carga')
    const abrir = within(caja).getByRole('button', { name: 'Abrir el panel de carga' })
    fireEvent.pointerDown(abrir, { pointerId: 1, button: 0, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(caja, { pointerId: 1, clientX: 502, clientY: 401 })
    fireEvent.pointerUp(caja, { pointerId: 1, clientX: 502, clientY: 401 })
    fireEvent.click(caja) // con la captura del puntero, el navegador manda el clic al contenedor, no al botón
    expect(await esperarLista()).toBeInTheDocument()
  })

  it('con el teclado (Intro sobre «Abrir») la pastilla se abre sin eventos de puntero', async () => {
    servirCarga()
    minimizarPanelCarga()
    montar()
    const caja = await screen.findByTestId('pastilla-carga')
    fireEvent.click(within(caja).getByRole('button', { name: 'Abrir el panel de carga' }))
    expect(await esperarLista()).toBeInTheDocument()
  })

  it('un arrastre cancelado no se traga el siguiente clic del teclado', async () => {
    servirCarga()
    minimizarPanelCarga()
    montar()
    const caja = await screen.findByTestId('pastilla-carga')
    fireEvent.pointerDown(caja, { pointerId: 1, button: 0, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(caja, { pointerId: 1, clientX: 200, clientY: 150 })
    fireEvent.pointerCancel(caja, { pointerId: 1 })
    fireEvent.click(within(caja).getByRole('button', { name: 'Abrir el panel de carga' }))
    expect(await esperarLista()).toBeInTheDocument()
  })

  it('el panel se arrastra por la cabecera, y sus botones no arrastran', async () => {
    servirCarga()
    montar()
    await esperarLista()
    const asa = within(panel()).getByTitle('Arrastra para moverlo')
    fireEvent.pointerDown(within(panel()).getByRole('button', { name: 'Total' }), { pointerId: 1, button: 0, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(asa, { pointerId: 1, clientX: 100, clientY: 100 })
    expect(panel()).toHaveStyle({ right: '16px', bottom: '16px' }) // empezó en un botón: no hay arrastre
    fireEvent.pointerUp(asa, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerDown(asa, { pointerId: 2, button: 0, clientX: 500, clientY: 400 })
    fireEvent.pointerMove(asa, { pointerId: 2, clientX: 900, clientY: 700 })
    fireEvent.pointerUp(asa, { pointerId: 2, clientX: 900, clientY: 700 })
    // La caja, llevada a (400, 300): su centro cae arriba a la izquierda (la mitad vertical de 64..768 es 416).
    expect(panelCarga.get().ancla).toEqual({ esq: 'tl', x: 400, y: 236 })
  })
})

describe('PanelCarga: pulsar un técnico', () => {
  it('desde otra pantalla lleva a Asignaciones y pide su filtro; el panel sigue abierto', async () => {
    servirCarga()
    const recibidos: number[] = []
    const baja = recibirFiltroPorTecnico((idTec) => {
      recibidos.push(idTec)
    })
    function Marco() {
      return (
        <>
          <Outlet />
          <PanelCarga />
        </>
      )
    }
    const { router } = renderConRouter(
      [
        {
          element: <Marco />,
          children: [
            { path: '/stock', element: <p>STOCK</p> },
            { path: '/reparaciones/asignaciones', element: <p>ASIGNACIONES</p> },
          ],
        },
      ],
      { sesion: SESION_SUPER, ruta: '/stock' },
    )
    await esperarLista()
    await userEvent.click(filaDe('Técnico B'))
    expect(await screen.findByText('ASIGNACIONES')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reparaciones/asignaciones')
    expect(recibidos).toEqual([2])
    expect(panel()).toBeInTheDocument()
    baja()
  })
})
