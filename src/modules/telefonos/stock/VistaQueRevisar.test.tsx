import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hoyMadrid } from '@/shared/lib/fechas'
import { AvisoBreveHost } from '@/shared/ui/AvisoBreve'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import { estadoStockTelefonos } from './estado'
import { listaRevisar, listaSubir } from './queRevisar'
import { VistaQueRevisar } from './VistaQueRevisar'

const P15 = { modelo: '15pro', modeloMaestro: '15 PRO', capacidad: '256GB', color: 'Titanio natural' }
const N11 = { modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro' }
const B11 = { ...N11, color: 'Blanco' }
// Revisar: 15 Pro (1 pendiente +1 con técnico), 13 128 Azul (1 pendiente; su F no cuenta como grado, spec §10.8) y 12 Pro (solo
// con técnico: en gris). Subir: 11 Blanco (B → A y B100 → A100, ningún A). El 11 Negro tiene un A: no sale en «Revisar sin grado» ni en «Subir B a A».
const STOCK: Movil[] = [
  visto({ imeiSn: '350000000000101', ...P15, grado: 'n/a', dias: 41, ubicacion: 'En revisión' }),
  visto({ imeiSn: '350000000000102', ...P15, grado: 'n/a', dias: 23, ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico A' })] }),
  visto({ imeiSn: '350000000000103', modelo: '12pro', modeloMaestro: '12 PRO', color: 'Grafito', grado: 'n/a',
    ubicacion: 'Taller · Glass', trabajos: [trabajo({ categoria: 'GLASS', tecnico: 'Técnico B' })] }),
  visto({ imeiSn: '350000000000104', grado: 'n/a', ubicacion: 'En revisión' }),
  visto({ imeiSn: '350000000000105', grado: 'F' }),
  visto({ imeiSn: '350000000000106', ...B11, grado: 'B', dias: 25 }),
  visto({ imeiSn: '350000000000107', ...B11, grado: 'B', bateriaNueva: true, dias: 11 }),
  visto({ imeiSn: '350000000000108', ...N11, grado: 'A' }),
  visto({ imeiSn: '350000000000109', ...N11, grado: 'n/a' }),
]

type Opciones = { cargando?: boolean; error?: boolean }

/** Pinta la vista. */
function pintar(moviles: Movil[] = STOCK, { cargando = false, error = false }: Opciones = {}) {
  const onAbrirImei = vi.fn()
  const { unmount } = renderConProviders(
    <><VistaQueRevisar revisar={listaRevisar(moviles)} subir={listaSubir(moviles)} cargando={cargando} error={error}
      onAbrirImei={onAbrirImei} /><AvisoBreveHost /></>,
    { sesion: SESION_SUPER },
  )
  return Object.assign(onAbrirImei, { unmount })
}
const cabeceras = (tabla: HTMLElement) => within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
const filas = (tabla: HTMLElement) => within(tabla).getAllByRole('row').slice(1)
const celdas = (fila: HTMLElement) => within(fila).getAllByRole('cell').map((c) => c.textContent)
const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })

describe('«Qué revisar» (spec 0.9.25 §3 y §10)', () => {
  afterEach(() => {
    delete window.showSaveFilePicker
    vi.restoreAllMocks()
  })

  it('dos tarjetas con su cifra y su subtítulo, sin botón; se entra en «Revisar sin grado», con su ayuda y el pie (spec §10.10)', () => {
    pintar()
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
    expect(within(tarjeta('Revisar sin grado')).getByText('Solo n/a, lo que más queda primero')).toBeInTheDocument()
    expect(tarjeta('Subir B a A')).toHaveTextContent('1 modelo-color · 2 móviles')
    expect(tarjeta('Subir B a A')).toHaveTextContent('B y B100 de modelos sin ningún A')
    for (const t of ['Revisar sin grado', 'Subir B a A']) expect(within(tarjeta(t)).getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Copiar lista/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar sin grado' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Los modelos-color en los que nada tiene grado, solo n/a (la tabla «Solo n/a» de la hoja). Primero lo que más '
      + 'queda sin revisar. Un modelo-color sale de la lista en cuanto NSYS o el taller le ponen grado a uno de sus móviles; F, FD y RMA no '
      + 'cuentan.')).toBeInTheDocument()
    expect(screen.getByText('Solo cuenta lo que es stock. Un móvil con un trabajo abierto sale en gris y no cuenta ni va en el Excel. «A» es '
      + 'A+, A o A-, con o sin batería nueva.')).toBeInTheDocument()
  })

  it('no hay interruptor de «3 o más»: un modelo-color con 1 pendiente sale en la tabla y va en el Excel', () => {
    pintar()
    expect(screen.queryByRole('switch', { name: /3 o más/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/3 o más sin revisar/)).not.toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(filas(tabla)).toHaveLength(4) // la fila de título del bloque y los tres modelos-color
    expect(filas(tabla)[1]).toHaveTextContent('iPhone 15 Pro256 GBTitanio natural')
    expect(filas(tabla)[2]).toHaveTextContent('iPhone 13')
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (2)' })).toBeEnabled()
  })

  it('«Revisar sin grado»: Modelo (con el desplegable delante), Cap., Color y Sin grado, sin pastilla de motivo; lo que más queda primero; el que solo tiene el técnico, en gris', () => {
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(cabeceras(tabla)).toEqual(['Modelo', 'Cap.', 'Color', 'Sin grado'])
    expect(filas(tabla).map(celdas)).toEqual([
      ['Menos de 3 sin revisar · 3 modelos-color · 2 móviles'],
      ['▸iPhone 15 Pro', '256 GB', 'Titanio natural', '1+1 con técnico'],
      ['▸iPhone 13', '128 GB', 'Azul', '1'],
      ['▸iPhone 12 Pro', '128 GB', 'Grafito', '0+1 con técnico'],
    ])
    const [, uno, , tres] = filas(tabla)
    expect(within(within(uno).getAllByRole('cell')[0]).getByRole('button', { name: 'Ver los móviles de iPhone 15 Pro 256 GB Titanio natural' }))
      .toBeInTheDocument()
    expect(within(uno).getByText('+1 con técnico')).toHaveClass('text-azul-gris')
    expect(tres).toHaveClass('text-texto-suave')
    for (const motivo of ['Nada con grado', 'Ningún A', 'Solo 1 A', 'Con A']) expect(within(tabla).queryByText(motivo)).not.toBeInTheDocument()
    expect(within(tabla).queryByText(/iPhone 11/)).not.toBeInTheDocument()
  })

  it('una fila se despliega con sus móviles (más días primero; el del técnico en gris) y el IMEI abre el detalle', async () => {
    const user = userEvent.setup()
    const onAbrirImei = pintar()
    const boton = screen.getByRole('button', { name: 'Ver los móviles de iPhone 15 Pro 256 GB Titanio natural' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await user.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    const moviles = screen.getByRole('table', { name: 'Móviles de iPhone 15 Pro 256 GB Titanio natural' })
    expect(cabeceras(moviles)).toEqual(['IMEI', 'Grado', 'Ubicación', 'Días en stock', 'Quién lo tiene'])
    const [primero, segundo] = filas(moviles)
    expect(primero).toHaveTextContent('350000000000101n/aEn revisión41')
    expect(segundo).toHaveTextContent('Técnico A')
    expect(segundo).toHaveClass('text-texto-suave')
    await user.click(within(moviles).getByRole('button', { name: 'Abrir 350000000000101' }))
    expect(onAbrirImei).toHaveBeenCalledWith('350000000000101')
    await user.click(boton)
    expect(screen.queryByRole('table', { name: /^Móviles de / })).not.toBeInTheDocument()
    await user.click(within(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[2]).getByText('Azul'))
    expect(filas(screen.getByRole('table', { name: 'Móviles de iPhone 13 128 GB Azul' })).map(celdas)).toEqual([
      ['350000000000104', 'n/a', 'En revisión', '6', '—'],
    ])
  })

  it('«⬇ Descargar Excel» abre «Guardar como» con el nombre del día, manda una fila por modelo-color (sin el móvil del técnico) y lo avisa', async () => {
    const user = userEvent.setup()
    const orden: string[] = []
    const escrito: Blob[] = []
    const ventana = vi.fn(async () => {
      orden.push('ventana')
      return { name: 'mio.xlsx', createWritable: async () => ({ write: async (b: Blob) => { escrito.push(b) }, close: async () => {} }) }
    })
    window.showSaveFilePicker = ventana as unknown as typeof window.showSaveFilePicker
    const cuerpos: unknown[] = []
    server.use(http.post('*/api/stock-telefonos/que-revisar/excel', async ({ request }) => {
      orden.push('servidor')
      cuerpos.push(await request.json())
      return new HttpResponse('PK')
    }))
    pintar()
    await user.click(screen.getByRole('button', { name: '⬇ Descargar Excel (2)' }))
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent('Descargado: 2 modelos-color')
    expect(ventana).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: `Que_revisar_sin_grado_${hoyMadrid()}.xlsx` }))
    expect(orden).toEqual(['ventana', 'servidor'])
    expect(cuerpos).toEqual([{
      hoja: 'Revisar sin grado',
      columnas: ['Modelo', 'Capacidad', 'Color', 'Sin grado', 'Revisado'],
      filas: [
        ['iPhone 15 Pro', '256 GB', 'Titanio natural', '1', ''],
        ['iPhone 13', '128 GB', 'Azul', '1', ''],
      ],
    }])
    expect(await escrito[0].text()).toBe('PK')
  })

  it('un doble clic en «⬇ Descargar Excel» abre un solo «Guardar como» y manda una sola petición', async () => {
    const user = userEvent.setup()
    const ventana = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return { name: 'mio.xlsx', createWritable: async () => ({ write: async () => {}, close: async () => {} }) }
    })
    window.showSaveFilePicker = ventana as unknown as typeof window.showSaveFilePicker
    let peticiones = 0
    server.use(http.post('*/api/stock-telefonos/que-revisar/excel', () => { peticiones++; return new HttpResponse('PK') }))
    pintar()
    const boton = screen.getByRole('button', { name: '⬇ Descargar Excel (2)' })
    await user.click(boton)
    await user.click(boton)
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent('Descargado: 2 modelos-color')
    expect(ventana).toHaveBeenCalledTimes(1)
    expect(peticiones).toBe(1)
  })

  it('«Subir B a A»: su tabla, el paso de cada móvil y su Excel', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    const tabla = screen.getByRole('table', { name: 'Subir B a A' })
    expect(cabeceras(tabla)).toEqual(['Modelo', 'Cap.', 'Color', 'B', 'B100'])
    expect(filas(tabla).map(celdas)).toEqual([['▸iPhone 11', '64 GB', 'Blanco', '1', '1']])
    expect(screen.getByText('Los modelos-color con móviles B y ningún A en stock: candidatos a chasis (B → A; con batería nueva, B100 → A100). Un modelo-color sale de la lista en cuanto tiene un A.')).toBeInTheDocument()
    expect(screen.queryByText('A en stock')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /3 o más/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver los móviles de iPhone 11 64 GB Blanco' }))
    const [b, b100] = filas(screen.getByRole('table', { name: 'Móviles de iPhone 11 64 GB Blanco' }))
    expect(b).toHaveTextContent('B → A')
    expect(b100).toHaveTextContent('B100 → A100')
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (1)' })).toBeEnabled()
  })

  it('si se cancela «Guardar como», no se pide nada al servidor ni avisa', async () => {
    const user = userEvent.setup()
    let pedida = false
    window.showSaveFilePicker = vi.fn(async () => { throw new DOMException('cancelado', 'AbortError') })
    server.use(http.post('*/api/stock-telefonos/que-revisar/excel', () => {
      pedida = true
      return new HttpResponse('PK')
    }))
    pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    await user.click(screen.getByRole('button', { name: '⬇ Descargar Excel (1)' }))
    await waitFor(() => expect(window.showSaveFilePicker)
      .toHaveBeenCalledWith(expect.objectContaining({ suggestedName: `Que_revisar_subir_B_a_A_${hoyMadrid()}.xlsx` })))
    expect(pedida).toBe(false)
    expect(screen.queryByTestId('aviso-breve')).toBeNull()
  })

  it('sin nada que revisar (un n/a con un A en su modelo-color no sale), el texto de vacío y el Excel apagado', async () => {
    const user = userEvent.setup()
    pintar([visto({ imeiSn: '350000000000121', grado: 'n/a' }), visto({ imeiSn: '350000000000122', grado: 'A' })])
    expect(screen.getByText('Nada que revisar: ningún modelo-color con todo sin grado en stock.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Revisar sin grado' })).not.toBeInTheDocument()
    const excel = screen.getByRole('button', { name: '⬇ Descargar Excel' })
    expect(excel).toBeDisabled()
    expect(excel).toHaveAttribute('title', 'No hay nada pendiente')
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    expect(screen.getByText('Ningún B que subir.')).toBeInTheDocument()
  })

  it('con solo un modelo-color que tiene el técnico, la fila sale en gris, la tarjeta en 0 y el Excel apagado', () => {
    pintar([STOCK[2]])
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('0 modelos-color · 0 móviles')
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel' })).toBeDisabled()
    expect(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[1]).toHaveClass('text-texto-suave')
  })

  it('en dos bloques: «3 o más» arriba y «Menos de 3» debajo, cada uno con su fila de título antes de sus filas; el número, en negrita', () => {
    const muchos = [1, 2, 3].map((i) => visto({ imeiSn: `35000000000020${i}`, modelo: '16', modeloMaestro: '16', capacidad: '128GB', color: 'Negro', grado: 'n/a' }))
    pintar([...STOCK, ...muchos])
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(cabeceras(tabla)).toEqual(['Modelo', 'Cap.', 'Color', 'Sin grado'])
    expect(filas(tabla).map(celdas)).toEqual([
      ['3 o más sin revisar · 1 modelo-color · 3 móviles'],
      ['▸iPhone 16', '128 GB', 'Negro', '3'],
      ['Menos de 3 sin revisar · 3 modelos-color · 2 móviles'],
      ['▸iPhone 15 Pro', '256 GB', 'Titanio natural', '1+1 con técnico'],
      ['▸iPhone 13', '128 GB', 'Azul', '1'],
      ['▸iPhone 12 Pro', '128 GB', 'Grafito', '0+1 con técnico'],
    ])
    expect(within(filas(tabla)[1]).getByText('3')).toHaveClass('font-bold')
    expect(within(filas(tabla)[3]).getByText('1')).toHaveClass('font-bold')
    expect(within(filas(tabla)[3]).getByText('+1 con técnico')).not.toHaveClass('font-bold')
  })

  it('con una búsqueda que deja solo modelos-color de menos de 3, solo sale ese bloque', () => {
    const muchos = [1, 2, 3].map((i) => visto({ imeiSn: `35000000000020${i}`, modelo: '16', modeloMaestro: '16', capacidad: '128GB', color: 'Negro', grado: 'n/a' }))
    estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, buscar: '15 pro' } }))
    pintar([...STOCK, ...muchos])
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(filas(tabla).map(celdas)).toEqual([
      ['Menos de 3 sin revisar · 1 modelo-color · 1 móvil'],
      ['▸iPhone 15 Pro', '256 GB', 'Titanio natural', '1+1 con técnico'],
    ])
    expect(within(tabla).queryByText(/^3 o más sin revisar/)).not.toBeInTheDocument()
  })

  it('«Subir B a A» sin bloques, y las dos tablas dejan de ocupar todo el ancho', async () => {
    const user = userEvent.setup()
    pintar()
    expect(screen.getByRole('table', { name: 'Revisar sin grado' })).not.toHaveClass('w-full')
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    const tabla = screen.getByRole('table', { name: 'Subir B a A' })
    expect(tabla).not.toHaveClass('w-full')
    expect(within(tabla).queryByText(/sin revisar ·/)).not.toBeInTheDocument()
  })

  it('cargando', () => {
    pintar([], { cargando: true })
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('sin poder cargar lo dice y no afirma que no haya nada', () => {
    pintar([], { error: true })
    expect(screen.getByText('No se pudo cargar el stock de teléfonos.')).toBeInTheDocument()
    expect(screen.queryByText(/^Nada que revisar/)).not.toBeInTheDocument()
  })

  it('al volver del detalle del IMEI, la tarjeta elegida y lo desplegado siguen donde estaban', async () => {
    const user = userEvent.setup()
    const primero = pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    await user.click(screen.getByRole('button', { name: 'Ver los móviles de iPhone 11 64 GB Blanco' }))
    primero.unmount()
    pintar()
    expect(screen.getByRole('button', { name: 'Subir B a A' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('table', { name: 'Móviles de iPhone 11 64 GB Blanco' })).toBeInTheDocument()
  })

  it('con el sondeo, lo desplegado sigue desplegado y un modelo-color que se queda sin nada desaparece', async () => {
    const user = userEvent.setup()
    const primero = pintar()
    await user.click(screen.getByRole('button', { name: 'Ver los móviles de iPhone 15 Pro 256 GB Titanio natural' }))
    expect(screen.getByRole('button', { name: 'Ver los móviles de iPhone 13 128 GB Azul' })).toBeInTheDocument()
    primero.unmount()
    pintar(STOCK.filter((m) => m.imeiSn !== '350000000000104'))
    expect(screen.queryByRole('button', { name: 'Ver los móviles de iPhone 13 128 GB Azul' })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Móviles de iPhone 15 Pro 256 GB Titanio natural' })).toBeInTheDocument()
  })

  it('la caja de arriba filtra las filas y el Excel por palabras clave; las tarjetas siguen con todo', () => {
    estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, buscar: '15 pro' } }))
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(filas(tabla)).toHaveLength(2) // título y modelo-color
    expect(tabla).toHaveTextContent('iPhone 15 Pro')
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (1)' })).toBeEnabled()
  })

  it('sin nada que coincida lo dice', () => {
    estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, buscar: ' xyz ' } }))
    pintar()
    expect(screen.getByText('Ningún modelo-color con «xyz».')).toBeInTheDocument()
  })

  it('un trozo de IMEI de 6 cifras abre su modelo-color con el móvil resaltado', () => {
    estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, buscar: '000101' } }))
    pintar()
    expect(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[1]).toHaveTextContent('iPhone 15 Pro')
    const [primero, segundo] = filas(screen.getByRole('table', { name: 'Móviles de iPhone 15 Pro 256 GB Titanio natural' }))
    expect(primero).toHaveClass('bg-amarillo/40')
    expect(segundo).not.toHaveClass('bg-amarillo/40')
  })
})
