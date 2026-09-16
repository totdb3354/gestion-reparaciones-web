import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { reiniciarEstadoTaller } from '../estado'
import { resumen, tecnico } from '../test/fabrica'
import { HistorialPulidosPage } from './HistorialPulidosPage'

const filas = [
  resumen({ idRep: 'P20260915_10', imei: '351200000000021', modelo: '13', nombreTecnico: 'tecnico_k', idTec: 5, fechaAsig: '2026-09-15T09:44:00', fechaFin: '2026-09-15T09:44:00', nombreTecnicoAsigna: 'Técnico F', cliente: null }),
  resumen({ idRep: 'P20260905_1', imei: '351800000000031', modelo: null, nombreTecnico: 'tecnico_c', idTec: 6, fechaAsig: '2026-09-05T14:32:00', fechaFin: '2026-09-05T14:32:00', nombreTecnicoAsigna: 'tecnico_c', cliente: 'CLIENTE F' }),
]

beforeEach(() => {
  reiniciarEstadoTaller()
  server.use(
    http.get('*/api/pulidos/historial', () => HttpResponse.json(filas)),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 5, nombre: 'tecnico_k' }), tecnico({ idTec: 6, nombre: 'tecnico_c' })])),
  )
})
const abrir = (sesion = SESION_SUPER) => renderConProviders(<HistorialPulidosPage />, { sesion, ruta: '/reparaciones/historial/pulidos' })

describe('HistorialPulidosPage (ficha docs/paridad/historial.md, toggle Pulidos)', () => {
  it('título, contador, filtros y columnas', async () => {
    abrir(SESION_TEC)
    expect(await screen.findByRole('heading', { name: 'Historial de pulidos' })).toBeInTheDocument()
    // findByText (no getByText): primera aserción dependiente de datos tras el heading estático, que se pinta
    // antes de que resuelva la petición — mismo patrón que HistorialPage.test.tsx ("3 reparaciones").
    expect(await screen.findByText('2 pulidos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Técnico' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Id Pulido', 'IMEI', 'Modelo', 'Técnico', 'Fecha asignación', 'Fecha fin', 'Comentario', 'Cliente', 'Asignado por'])
    expect(screen.getAllByText('2026/09/15 11:44')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Técnico' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'tecnico_c' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByText('1 pulido')).toBeInTheDocument()
  })
  it('"Editar modelo" abre el selector con el modelo actual y guarda con POST /api/telefonos', async () => {
    let body: unknown = null
    server.use(http.post('*/api/telefonos', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 201 }) }))
    abrir()
    await screen.findByText('P20260915_10')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('P20260915_10') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['Editar modelo', 'Borrar', '📋  Copiar celda'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar modelo' }))
    const dlg = await screen.findByRole('dialog', { name: 'Editar modelo' })
    expect(within(dlg).getByText('Selecciona el modelo:')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'iPhone 13' })).toHaveClass('bg-seleccion-suave')
    await userEvent.type(within(dlg).getByPlaceholderText('Filtrar modelo…'), '13 pro max')
    await userEvent.click(within(dlg).getByRole('button', { name: 'iPhone 13 Pro Max' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(body).toEqual({ imei: '351200000000021', modelo: '13promax', idCli: null, clienteExplicito: null }))
  })
  it('"Borrar" pide motivo con su título y llama a DELETE', async () => {
    let body: unknown = null
    server.use(http.delete('*/api/pulidos/historial/P20260905_1', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText('P20260905_1')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('P20260905_1') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    const dlg = await screen.findByRole('dialog', { name: 'Borrar pulido P20260905_1' })
    expect(within(dlg).getByText('Se borrará P20260905_1 del historial de pulido. Escribe el motivo.')).toBeInTheDocument()
    await userEvent.type(within(dlg).getByPlaceholderText('Escribe el motivo del borrado...'), 'duplicado')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(body).toEqual({ motivo: 'duplicado' }))
  })
  it('el técnico solo tiene Copiar celda; placeholder', async () => {
    abrir(SESION_TEC)
    await screen.findByText('P20260915_10')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('P20260915_10') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
    await userEvent.keyboard('{Escape}')
    server.use(http.get('*/api/pulidos/historial', () => HttpResponse.json([])))
    renderConProviders(<HistorialPulidosPage />, { sesion: SESION_TEC, ruta: '/reparaciones/historial/pulidos' })
    expect(await screen.findByText('No hay pulidos completados')).toBeInTheDocument()
  })
})
