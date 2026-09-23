import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { AsignarTrabajosDialog } from './AsignarTrabajosDialog'
import { filaCarga, tecnico } from '../../test/fabrica'

const IMEI = '111111111111111'
let lotes: { cuerpo: unknown; clave: string | null }[]
let respuestaLote: () => Response

beforeEach(() => {
  lotes = []
  respuestaLote = () => HttpResponse.json({ creadas: [], conflictos: [] })
  server.use(
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 3, nombre: 'Técnico A' }), tecnico({ idTec: 4, nombre: 'Técnico G', esGlass: true })])),
    http.get('*/api/reparaciones/carga-tecnicos', () => HttpResponse.json({ pedidos: [filaCarga({ idTec: 3 })], total: [] })),
    http.get('*/api/clientes', () => HttpResponse.json([])),
    http.get('*/api/telefonos/:imei/modelo', () => HttpResponse.json({ value: '14' })),
    http.get('*/api/telefonos/:imei/cliente', () => HttpResponse.json({ value: '' })),
    http.post('*/api/glass/prediccion', () => HttpResponse.json({ idTec: 4, nombre: 'Técnico G' })),
    http.post('*/api/asignaciones/lote', async ({ request }) => {
      lotes.push({ cuerpo: await request.json(), clave: request.headers.get('Idempotency-Key') })
      return respuestaLote()
    }),
  )
})

function abrir() {
  const onCerrar = vi.fn()
  renderConProviders(<AsignarTrabajosDialog tabla={[]} onCerrar={onCerrar} onInteraccion={vi.fn()} />, { sesion: SESION_SUPER })
  return onCerrar
}

async function asignarUnaConGlass() {
  await userEvent.type(screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...'), IMEI)
  await screen.findByText('iPhone 14')
  await userEvent.click(await screen.findByRole('checkbox', { name: /Técnico A/ }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Lleva glass' }))
  await userEvent.click(screen.getByRole('button', { name: 'Asignar →' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar (2)' })).toBeEnabled())
}

describe('AsignarTrabajosDialog', () => {
  it('abre con su cabecera, las tres pestañas y Guardar (0) deshabilitado', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Asignar trabajos' })).toBeInTheDocument()
    expect(screen.getByText('Elige el tipo, escanea IMEIs y configúralos. Los técnicos se mantienen entre IMEIs. Se guardan todos al final.')).toBeInTheDocument()
    for (const n of ['Reparación', 'Glass', 'Pulido']) expect(screen.getByRole('button', { name: new RegExp(`^${n}`) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar (0)' })).toBeDisabled()
    expect(screen.getByText('0 configurados · 0 pendientes')).toBeInTheDocument()
  })

  it('flujo completo: reparación + glass automática → un lote con clave → se cierra', async () => {
    const onCerrar = abrir()
    await asignarUnaConGlass()
    expect(screen.getByRole('button', { name: /^Glass/ })).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: /^Glass/ }))
    expect(screen.getByText('auto')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar (2)' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(lotes).toHaveLength(1)
    expect(lotes[0].clave).toBeTruthy()
    expect(lotes[0].cuerpo).toEqual({
      telefonos: [{ imei: IMEI, modelo: '14', idCli: null, clienteExplicito: false }],
      asignaciones: [
        { imei: IMEI, categoria: 'R', idTec: 3, comentario: null, esChasis: false },
        { imei: IMEI, categoria: 'G', idTec: 4, comentario: null, esChasis: false },
      ],
    })
  })

  it('conflictos: aviso con el texto del JavaFX', async () => {
    respuestaLote = () => HttpResponse.json({ creadas: [], conflictos: [{ imei: IMEI, idTec: 3, nombreTecnico: 'Técnico A', categoria: 'R' }] })
    abrir()
    await asignarUnaConGlass()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar (2)' }))
    expect(await screen.findByText(/Algunas asignaciones no se crearon:/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`• ${IMEI} → Técnico A \\(ya asignado · Reparación\\)`))).toBeInTheDocument()
  })

  it('si el guardado falla, el modal sigue abierto y el reintento usa la MISMA clave', async () => {
    respuestaLote = () => HttpResponse.json({ message: 'Falta el modelo del IMEI' }, { status: 422 })
    const onCerrar = abrir()
    await asignarUnaConGlass()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar (2)' }))
    await waitFor(() => expect(lotes).toHaveLength(1))
    expect(await screen.findByText('Falta el modelo del IMEI')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar' }))   // el diálogo de error
    respuestaLote = () => HttpResponse.json({ creadas: [], conflictos: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar (2)' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(lotes).toHaveLength(2)
    expect(lotes[1].clave).toBeTruthy()
    expect(lotes[1].clave).toBe(lotes[0].clave)
  })

  it('si la predicción falla: glass roja y aviso', async () => {
    server.use(http.post('*/api/glass/prediccion', () => new HttpResponse(null, { status: 500 })))
    abrir()
    await userEvent.type(screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...'), IMEI)
    await screen.findByText('iPhone 14')
    await userEvent.click(await screen.findByRole('checkbox', { name: /Técnico A/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lleva glass' }))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar →' }))
    expect(await screen.findByText('No se pudo calcular la glass automática; asígnala a mano.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar (1)' })).toBeDisabled()
  })

  it('cerrar: sin entradas se cierra; con entradas pide "Descartar" con el total', async () => {
    // onCerrar es un mock: el modal sigue montado tras el primer cierre y sirve para probar el segundo caso.
    const onCerrar = abrir()
    await screen.findByRole('heading', { name: 'Asignar trabajos' })
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Se descartarán/)).not.toBeInTheDocument()

    await asignarUnaConGlass()
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('Se descartarán los 2 IMEIs escaneados.')).toBeInTheDocument()
    expect(onCerrar).toHaveBeenCalledTimes(1)
    // Cancelar deja el modal con todo el lote
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText(/Se descartarán/)).not.toBeInTheDocument())
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Guardar (2)' })).toBeEnabled()
  })

  it('cerrar con entradas pide confirmación', async () => {
    const onCerrar = abrir()
    await asignarUnaConGlass()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))   // la ✕ de DialogContent (sr-only "Close")
    expect(await screen.findByText('Se descartarán los 2 IMEIs escaneados.')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('D6: un IMEI escaneado antes de que carguen los clientes recibe su cliente de BD cuando llegan', async () => {
    let soltar!: () => void
    const clientesListos = new Promise<void>((r) => { soltar = r })
    let pedidosModelo = 0
    server.use(
      http.get('*/api/clientes', async () => {
        await clientesListos
        return HttpResponse.json([{ idCli: 7, nombre: 'CLIENTE B', activo: true, updatedAt: '2026-09-01T00:00:00' }])
      }),
      http.get('*/api/telefonos/:imei/modelo', () => { pedidosModelo += 1; return HttpResponse.json({ value: '14' }) }),
      http.get('*/api/telefonos/:imei/cliente', () => HttpResponse.json({ value: '7' })),
    )
    const onCerrar = abrir()
    await userEvent.type(screen.getByPlaceholderText('Escanea o escribe el IMEI (15 dígitos)...'), IMEI)
    // Mientras no hay clientes, la cola de efectos espera: ni el lookup sale.
    await new Promise((r) => setTimeout(r, 50))
    expect(pedidosModelo).toBe(0)
    soltar()
    await screen.findByText('iPhone 14')
    await userEvent.click(await screen.findByRole('checkbox', { name: /Técnico A/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar →' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar (1)' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Guardar (1)' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(lotes[0].cuerpo).toMatchObject({ telefonos: [{ imei: IMEI, modelo: '14', idCli: 7, clienteExplicito: false }] })
  })
})
