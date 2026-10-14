import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { AccionBloqueDialog } from './AccionBloqueDialog'
import { lineaDePrueba as l } from './datosPrueba'
import { JuntarDialog } from './JuntarDialog'
import { NotaBloqueDialog } from './NotaBloqueDialog'
import { agruparEnBloques } from './reglas'
import { SepararDialog } from './SepararDialog'

const U = '2026-10-09T10:00:00'
let peticiones: { ruta: string; cuerpo: unknown }[]
let respuesta: () => Response

beforeEach(() => {
  peticiones = []
  respuesta = () => new HttpResponse(null, { status: 200 })
  server.use(http.all('*/api/bloques-compra/:id/:accion', async ({ request }) => {
    peticiones.push({ ruta: new URL(request.url).pathname, cuerpo: await request.json() })
    return respuesta()
  }))
})

/** Bloque 41: pendiente (1), en camino (2, bat-x) y parcial 1/2 (3). */
const mezclado = () => agruparEnBloques([
  l({ idCompra: 1 }),
  l({ idCompra: 2, estado: 'en_camino', tipoComponente: 'bat-x' }),
  l({ idCompra: 3, estado: 'parcial', cantidad: 2, cantidadRecibida: 1 }),
]).get('41')!

describe('AccionBloqueDialog (spec §6.5)', () => {
  it('«Recibir todo»: lista lo que cambia y lo que no, y manda solo las en camino', async () => {
    const onCerrar = vi.fn()
    renderConProviders(<AccionBloqueDialog bloque={mezclado()} accion="recibir" onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Recibir todo · Bloque 41' })
    expect(dlg).toHaveTextContent('Proveedor A · 09/10/2026')
    expect(within(dlg).getByRole('region', { name: 'Se reciben (suman al stock) (1)' })).toHaveTextContent('bat-x')
    const quedan = within(dlg).getByRole('region', { name: 'No cambian (2)' })
    expect(quedan).toHaveTextContent('pendiente: aún no se ha pedido')
    expect(quedan).toHaveTextContent('parcial (1/2): usa «Recibir resto» en su fila')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Recibir (1)' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(peticiones).toEqual([{ ruta: '/api/bloques-compra/41/recibir', cuerpo: { lineas: [{ idCompra: 2, updatedAt: U }] } }])
  })

  it('un 409 cierra y avisa como «Advertencia»', async () => {
    respuesta = () => HttpResponse.json({ message: 'Este bloque fue modificado por otro usuario.' }, { status: 409 })
    const onCerrar = vi.fn()
    renderConProviders(<AccionBloqueDialog bloque={mezclado()} accion="confirmar" onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar (1)' }))
    expect(await screen.findByText('Este bloque fue modificado por otro usuario. Los datos se han recargado.')).toBeInTheDocument()
    expect(onCerrar).toHaveBeenCalled()
  })

  it('«Cancelar bloque» y «Borrar bloque» llevan el botón en rojo', async () => {
    renderConProviders(<AccionBloqueDialog bloque={mezclado()} accion="cancelar" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    expect(await screen.findByRole('button', { name: 'Cancelar líneas (1)' })).toHaveClass('bg-rojo-accion')
  })

  it('«Borrar bloque» lleva el botón en rojo', async () => {
    const b = agruparEnBloques([l({ idCompra: 1 }), l({ idCompra: 2 })]).get('41')!
    renderConProviders(<AccionBloqueDialog bloque={b} accion="borrar" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    expect(await screen.findByRole('button', { name: 'Borrar bloque' })).toHaveClass('bg-rojo-accion')
  })

  it('sin lineas que cambien el boton queda deshabilitado y no manda nada', async () => {
    const b = agruparEnBloques([l({ idCompra: 2, estado: 'en_camino' })]).get('41')!
    renderConProviders(<AccionBloqueDialog bloque={b} accion="confirmar" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const boton = await screen.findByRole('button', { name: 'Confirmar (0)' })
    expect(boton).toBeDisabled()
    await userEvent.click(boton)
    expect(peticiones).toEqual([])
  })

  it('un 422 se muestra dentro del dialogo, no lo cierra y deja reintentar', async () => {
    respuesta = () => HttpResponse.json({ message: 'Regla de negocio sintetica incumplida.' }, { status: 422 })
    const onCerrar = vi.fn()
    renderConProviders(<AccionBloqueDialog bloque={mezclado()} accion="confirmar" onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Confirmar bloque · Bloque 41' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirmar (1)' }))
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('Regla de negocio sintetica incumplida.')
    expect(onCerrar).not.toHaveBeenCalled()
    expect(within(dlg).getByRole('button', { name: 'Confirmar (1)' })).toBeEnabled()
  })
})

/** Bloque 41: pendiente (1) y tres en camino (2 bat-x, 3 lcd-y, 4 mc-x). */
const tresEnCamino = () => agruparEnBloques([
  l({ idCompra: 1 }),
  l({ idCompra: 2, estado: 'en_camino', tipoComponente: 'bat-x' }),
  l({ idCompra: 3, estado: 'en_camino', tipoComponente: 'lcd-y' }),
  l({ idCompra: 4, estado: 'en_camino', tipoComponente: 'mc-x' }),
]).get('41')!

describe('AccionBloqueDialog con casillas (0.9.13)', () => {
  it('abre con todas marcadas; desmarcar una cambia título, botón, aviso y su texto, y manda solo las marcadas', async () => {
    const onCerrar = vi.fn()
    renderConProviders(<AccionBloqueDialog bloque={tresEnCamino()} accion="recibir" onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Recibir todo · Bloque 41' })
    const casilla = within(dlg).getByRole('checkbox', { name: 'lcd-y (ID 3)' })
    expect(casilla).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: 'Marcar todas' })).toBeChecked()
    expect(within(dlg).getByRole('region', { name: 'Se reciben (suman al stock) (3)' })).toBeInTheDocument()
    expect(within(dlg).queryByText(/desmarcadas? no cambia/)).not.toBeInTheDocument()

    await userEvent.click(casilla)
    expect(casilla).not.toBeChecked()
    const lista = within(dlg).getByRole('region', { name: 'Se reciben (suman al stock) (2 de 3)' })
    expect(within(lista).getByText('lcd-y')).toHaveClass('line-through')
    expect(lista).toHaveTextContent('se queda en camino')
    expect(within(dlg).getByRole('checkbox', { name: 'Marcar todas' })).toHaveAttribute('aria-checked', 'mixed')
    expect(within(dlg).getByText('Se queda en camino 1 línea: la desmarcada no cambia.')).toBeInTheDocument()

    await userEvent.click(within(dlg).getByRole('button', { name: 'Recibir (2)' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(peticiones).toEqual([{
      ruta: '/api/bloques-compra/41/recibir',
      cuerpo: { lineas: [{ idCompra: 2, updatedAt: U }, { idCompra: 4, updatedAt: U }] },
    }])
  })

  it('el aviso de desmarcadas está montado y vacío al abrir, y se rellena al desmarcar una', async () => {
    renderConProviders(<AccionBloqueDialog bloque={tresEnCamino()} accion="recibir" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Recibir todo · Bloque 41' })
    const aviso = within(dlg).getByRole('status')
    expect(aviso).toBeEmptyDOMElement()
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'lcd-y (ID 3)' }))
    expect(within(dlg).getByRole('status')).toHaveTextContent('Se queda en camino 1 línea: la desmarcada no cambia.')
  })

  it('«Marcar todas» desmarca todas (botón deshabilitado) y, a medias, las vuelve a marcar todas', async () => {
    renderConProviders(<AccionBloqueDialog bloque={tresEnCamino()} accion="cancelar" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Cancelar bloque · Bloque 41' })
    const todas = within(dlg).getByRole('checkbox', { name: 'Marcar todas' })
    await userEvent.click(todas)
    expect(todas).not.toBeChecked()
    expect(within(dlg).getByRole('button', { name: 'Cancelar líneas (0)' })).toBeDisabled()
    expect(within(dlg).getByText('Se quedan en camino 3 líneas: las desmarcadas no cambian.')).toBeInTheDocument()

    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'bat-x (ID 2)' }))
    expect(todas).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(todas)
    expect(todas).toBeChecked()
    expect(within(dlg).getByRole('button', { name: 'Cancelar líneas (3)' })).toBeEnabled()
    expect(within(dlg).getByRole('region', { name: 'Se cancelan (no se pueden reactivar) (3)' })).toBeInTheDocument()
    expect(peticiones).toEqual([])
  })

  it('«Confirmar bloque» con una desmarcada: «se queda pendiente»', async () => {
    const b = agruparEnBloques([l({ idCompra: 1 }), l({ idCompra: 2, tipoComponente: 'bat-x' })]).get('41')!
    renderConProviders(<AccionBloqueDialog bloque={b} accion="confirmar" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Confirmar bloque · Bloque 41' })
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'bat-x (ID 2)' }))
    expect(within(dlg).getByRole('region', { name: 'Pasan a en camino (1 de 2)' })).toHaveTextContent('se queda pendiente')
    expect(within(dlg).getByText('Se queda pendiente 1 línea: la desmarcada no cambia.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Confirmar (1)' })).toBeEnabled()
  })

  it('«No cambian» y «Borrar bloque» no llevan casillas', async () => {
    const { unmount } = renderConProviders(<AccionBloqueDialog bloque={mezclado()} accion="recibir" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Recibir todo · Bloque 41' })
    expect(within(within(dlg).getByRole('region', { name: 'No cambian (2)' })).queryAllByRole('checkbox')).toHaveLength(0)
    unmount()

    const b = agruparEnBloques([l({ idCompra: 1 }), l({ idCompra: 2 })]).get('41')!
    renderConProviders(<AccionBloqueDialog bloque={b} accion="borrar" onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const borrar = await screen.findByRole('dialog', { name: 'Borrar bloque · Bloque 41' })
    expect(within(borrar).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(borrar).getByRole('region', { name: 'Se borran el bloque y todas sus líneas (2)' })).toBeInTheDocument()
  })
})

describe('SepararDialog', () => {
  it('sin marcar no deja; con todas avisa; con ya pedidas cambia el botón; manda las marcadas', async () => {
    const onCerrar = vi.fn()
    renderConProviders(<SepararDialog bloque={mezclado()} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Separar líneas · Bloque 41' })
    expect(dlg).toHaveTextContent('Las marcadas pasan a un bloque nuevo de Proveedor A con fecha de hoy.')
    expect(within(dlg).getByRole('button', { name: 'Separar' })).toBeDisabled()
    for (const n of [1, 2, 3]) await userEvent.click(within(dlg).getByRole('checkbox', { name: new RegExp(`\\(ID ${n}\\)`) }))
    expect(within(dlg).getByText('Deja al menos una línea en el Bloque 41.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Separar igualmente (3)' })).toBeDisabled()
    await userEvent.click(within(dlg).getByRole('checkbox', { name: /\(ID 1\)/ }))
    expect(within(dlg).getByText('2 líneas de las marcadas ya se pidieron: el movimiento quedará apuntado en el registro.')).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Separar igualmente (2)' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(peticiones).toEqual([{ ruta: '/api/bloques-compra/41/separar', cuerpo: { lineas: [{ idCompra: 2, updatedAt: U }, { idCompra: 3, updatedAt: U }] } }])
  })
})

describe('SepararDialog con líneas cerradas', () => {
  it('las recibidas y canceladas se ven pero su casilla está deshabilitada; las vivas no', async () => {
    const b = agruparEnBloques([
      l({ idCompra: 1 }),
      l({ idCompra: 2, estado: 'recibido', cantidadRecibida: 1, tipoComponente: 'bat-x' }),
      l({ idCompra: 3, estado: 'cancelado', tipoComponente: 'mc-x' }),
    ]).get('41')!
    renderConProviders(<SepararDialog bloque={b} onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Separar líneas · Bloque 41' })
    expect(within(dlg).getByRole('checkbox', { name: /\(ID 1\)/ })).toBeEnabled()
    expect(within(dlg).getByRole('checkbox', { name: 'Separar bat-x (ID 2)' })).toBeDisabled()
    expect(within(dlg).getByRole('checkbox', { name: 'Separar mc-x (ID 3)' })).toBeDisabled()
  })
})

describe('JuntarDialog', () => {
  it('elegir destino, avisar de las ya pedidas y mandar el bloque entero', async () => {
    const onCerrar = vi.fn()
    const bloques = agruparEnBloques([
      l({ idCompra: 1, estado: 'en_camino', notaBloque: 'Ped. 2' }),
      l({ idCompra: 2, idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }),
    ])
    renderConProviders(<JuntarDialog bloque={bloques.get('41')!} candidatos={[bloques.get('40')!]} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Juntar Bloque 41 con…' })
    expect(dlg).toHaveTextContent('Su línea pasa al bloque que elijas y el Bloque 41 desaparece. Su nota se añade a la del destino.')
    expect(within(dlg).getByText('El Bloque 41 tiene 1 línea ya pedida: el movimiento quedará apuntado en el registro.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Juntar' })).toBeDisabled()
    await userEvent.click(within(dlg).getByRole('radio', { name: /Bloque 40/ }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Juntar' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(peticiones).toEqual([{ ruta: '/api/bloques-compra/41/juntar', cuerpo: { destino: 40, lineas: [{ idCompra: 1, updatedAt: U }] } }])
  })
})

describe('NotaBloqueDialog', () => {
  it('cuenta los caracteres, recorta y manda null si queda vacía', async () => {
    const onCerrar = vi.fn()
    const b = agruparEnBloques([l({ notaBloque: 'Ped. 1' })]).get('41')!
    renderConProviders(<NotaBloqueDialog bloque={b} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Nota · Bloque 41' })
    const campo = within(dlg).getByRole('textbox', { name: 'Nota del bloque' })
    expect(campo).toHaveValue('Ped. 1')
    expect(dlg).toHaveTextContent('6/200')
    await userEvent.clear(campo)
    await userEvent.type(campo, '  Ped. 9  ')
    expect(dlg).toHaveTextContent('10/200')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    await userEvent.clear(campo)
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(peticiones).toHaveLength(2))
    expect(peticiones.map((p) => p.cuerpo)).toEqual([{ nota: 'Ped. 9', updatedAt: U }, { nota: null, updatedAt: U }])
  })

  it('con varias líneas el subtítulo va en plural', async () => {
    const bloques = agruparEnBloques([
      l({ idCompra: 1 }), l({ idCompra: 3 }),
      l({ idCompra: 2, idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }),
    ])
    renderConProviders(<JuntarDialog bloque={bloques.get('41')!} candidatos={[bloques.get('40')!]} onCerrar={vi.fn()} />, { sesion: SESION_SUPER })
    const dlg = await screen.findByRole('dialog', { name: 'Juntar Bloque 41 con…' })
    expect(dlg).toHaveTextContent('Sus 2 líneas pasan al bloque que elijas y el Bloque 41 desaparece.')
  })
})
