import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hoyMadrid } from '@/shared/lib/fechas'
import { AvisoBreveHost } from '@/shared/ui/AvisoBreve'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import { buscarQueRevisar, estadoStockTelefonos } from './estado'
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
/** Lo que hace la caja de arriba de la página al escribir en ella (spec §3.6 y §10.14), con las listas de STOCK. */
const escribir = (texto: string) => estadoStockTelefonos.set((e) => ({
  ...e, queRevisar: buscarQueRevisar(e.queRevisar, texto, { revisar: listaRevisar(STOCK), subir: listaSubir(STOCK) }),
}))
const cabeceras = (tabla: HTMLElement) => within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
const filas = (tabla: HTMLElement) => within(tabla).getAllByRole('row').slice(1)
const celdas = (fila: HTMLElement) => within(fila).getAllByRole('cell').map((c) => c.textContent)
const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })
const PULSA = 'Pulsa un modelo-color para ver sus móviles.'
const panel = () => screen.getByRole('region', { name: 'Móviles del modelo-color' })
const elegir = (descripcion: string) => screen.getByRole('button', { name: `Ver los móviles de ${descripcion}` })
/** El título del panel (la descripción y su cuenta); null sin elegido. */
const titulo = () => within(panel()).queryByRole('heading')?.textContent ?? null

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

  it('«Revisar sin grado»: Modelo (con el botón que lo elige delante), Cap., Color y Sin grado, sin pastilla de motivo; lo que más queda primero; el que solo tiene el técnico, en gris', () => {
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
    const boton = within(within(uno).getAllByRole('cell')[0]).getByRole('button', { name: 'Ver los móviles de iPhone 15 Pro 256 GB Titanio natural' })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
    expect(boton).toHaveAttribute('aria-controls', panel().id)
    expect(boton).not.toHaveAttribute('aria-expanded')
    expect(within(uno).getByText('+1 con técnico')).toHaveClass('text-azul-gris')
    expect(tres).toHaveClass('text-texto-suave')
    for (const motivo of ['Nada con grado', 'Ningún A', 'Solo 1 A', 'Con A']) expect(within(tabla).queryByText(motivo)).not.toBeInTheDocument()
    expect(within(tabla).queryByText(/iPhone 11/)).not.toBeInTheDocument()
  })

  it('sin elegir, el panel dice «Pulsa…»; al pulsar una fila, su panel con la cuenta y sus móviles (más días primero; el del técnico en gris), y el IMEI abre el detalle', async () => {
    const user = userEvent.setup()
    const onAbrirImei = pintar()
    expect(panel()).toHaveTextContent(PULSA)
    expect(titulo()).toBeNull()
    expect(within(panel()).queryByRole('table')).not.toBeInTheDocument()
    await user.click(elegir('iPhone 15 Pro 256 GB Titanio natural'))
    expect(elegir('iPhone 15 Pro 256 GB Titanio natural')).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByRole('heading', { name: 'iPhone 15 Pro 256 GB Titanio natural · 1 sin grado · +1 con técnico' })).toBeInTheDocument()
    expect(panel()).not.toHaveTextContent(PULSA)
    const moviles = within(panel()).getByRole('table', { name: 'Móviles de iPhone 15 Pro 256 GB Titanio natural' })
    expect(cabeceras(moviles)).toEqual(['IMEI', 'Grado', 'Ubicación', 'Días en stock', 'Quién lo tiene'])
    expect(filas(moviles).map(celdas)).toEqual([
      ['350000000000101', 'n/a', 'En revisión', '41', '—'],
      ['350000000000102', 'n/a', 'Taller · Reparación', '23', 'Técnico A'],
    ])
    const [primero, segundo] = filas(moviles)
    expect(primero).not.toHaveClass('text-texto-suave')
    expect(segundo).toHaveClass('text-texto-suave')
    await user.click(within(moviles).getByRole('button', { name: 'Abrir 350000000000101' }))
    expect(onAbrirImei).toHaveBeenCalledWith('350000000000101')
  })

  it('la fila elegida queda marcada y las demás no; pulsar otra (en cualquier sitio de la fila) cambia el panel, y volver a pulsarla no la quita', async () => {
    const user = userEvent.setup()
    pintar()
    const tabla = () => screen.getByRole('table', { name: 'Revisar sin grado' })
    const marcadas = () => filas(tabla()).slice(1).map((f) => [
      within(f).getByRole('button').getAttribute('aria-pressed'), f.classList.contains('bg-seleccion-suave'),
    ])
    expect(marcadas()).toEqual([['false', false], ['false', false], ['false', false]])
    await user.click(elegir('iPhone 15 Pro 256 GB Titanio natural'))
    expect(marcadas()).toEqual([['true', true], ['false', false], ['false', false]])
    const antes = panel()
    await user.click(within(filas(tabla())[2]).getByText('Azul'))
    expect(marcadas()).toEqual([['false', false], ['true', true], ['false', false]])
    expect(panel()).not.toBe(antes) // se pinta de nuevo: empieza arriba, no donde se quedó el del 15 Pro
    expect(panel().id).toBe(antes.id)
    expect(titulo()).toBe('iPhone 13 128 GB Azul · 1 sin grado')
    expect(filas(within(panel()).getByRole('table', { name: 'Móviles de iPhone 13 128 GB Azul' })).map(celdas)).toEqual([
      ['350000000000104', 'n/a', 'En revisión', '6', '—'],
    ])
    await user.click(within(filas(tabla())[2]).getByText('128 GB'))
    expect(marcadas()).toEqual([['false', false], ['true', true], ['false', false]])
    expect(titulo()).toBe('iPhone 13 128 GB Azul · 1 sin grado')
  })

  it('ya no se despliega nada dentro de la tabla: la lista no cambia al elegir', async () => {
    const user = userEvent.setup()
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    const antes = filas(tabla).map(celdas)
    await user.click(elegir('iPhone 15 Pro 256 GB Titanio natural'))
    expect(filas(tabla).map(celdas)).toEqual(antes)
    expect(within(tabla).queryByRole('table')).not.toBeInTheDocument()
    expect(within(tabla).queryByText('350000000000101')).not.toBeInTheDocument()
  })

  it('el que solo tiene el técnico: su panel dice «0 sin grado · +1 con técnico» y su móvil sale en gris', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(elegir('iPhone 12 Pro 128 GB Grafito'))
    expect(titulo()).toBe('iPhone 12 Pro 128 GB Grafito · 0 sin grado · +1 con técnico')
    const [fila] = filas(within(panel()).getByRole('table', { name: 'Móviles de iPhone 12 Pro 128 GB Grafito' }))
    expect(celdas(fila)).toEqual(['350000000000103', 'n/a', 'Taller · Glass', '6', 'Técnico B (glass) sin entregar'])
    expect(fila).toHaveClass('text-texto-suave')
  })

  it('dos columnas desde 1024 px: la tabla a la izquierda y el panel a la derecha, arriba y con su propio desplazamiento', () => {
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    const columnas = panel().parentElement!
    expect(columnas).toHaveClass('flex', 'flex-col', 'lg:flex-row')
    expect(columnas.firstElementChild).toContainElement(tabla)
    expect(columnas.firstElementChild).toHaveClass('overflow-auto')
    expect(columnas.lastElementChild).toBe(panel())
    expect(panel()).toHaveClass('overflow-y-auto', 'lg:self-start', 'lg:max-h-full', 'lg:flex-1')
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

  it('«Subir B a A»: su tabla, su panel con «· 1 B · 1 B100» y el paso de cada móvil, y su Excel', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    const tabla = screen.getByRole('table', { name: 'Subir B a A' })
    expect(cabeceras(tabla)).toEqual(['Modelo', 'Cap.', 'Color', 'B', 'B100'])
    expect(filas(tabla).map(celdas)).toEqual([['▸iPhone 11', '64 GB', 'Blanco', '1', '1']])
    expect(screen.getByText('Los modelos-color con móviles B y ningún A en stock: candidatos a chasis (B → A; con batería nueva, B100 → A100). Un modelo-color sale de la lista en cuanto tiene un A.')).toBeInTheDocument()
    expect(screen.queryByText('A en stock')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /3 o más/ })).not.toBeInTheDocument()
    expect(panel()).toHaveTextContent(PULSA)
    await user.click(elegir('iPhone 11 64 GB Blanco'))
    expect(elegir('iPhone 11 64 GB Blanco')).toHaveAttribute('aria-pressed', 'true')
    expect(titulo()).toBe('iPhone 11 64 GB Blanco · 1 B · 1 B100')
    const moviles = within(panel()).getByRole('table', { name: 'Móviles de iPhone 11 64 GB Blanco' })
    expect(cabeceras(moviles)).toEqual(['IMEI', 'Grado', 'Ubicación', 'Días en stock', 'Quién lo tiene'])
    expect(filas(moviles).map(celdas)).toEqual([
      ['350000000000106', 'B → A', 'Listos', '25', '—'],
      ['350000000000107', 'B100 → A100', 'Listos', '11', '—'],
    ])
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (1)' })).toBeEnabled()
  })

  it('«Subir B a A»: el título cuenta los B y B100 sin los del técnico y, aparte, «+1 con técnico»; el del técnico, en gris', async () => {
    const user = userEvent.setup()
    pintar([...STOCK,
      visto({ imeiSn: '350000000000110', ...B11, grado: 'B', bateriaNueva: true, dias: 3 }),
      visto({ imeiSn: '350000000000111', ...B11, grado: 'B', dias: 2, ubicacion: 'Taller · Pulir', trabajos: [trabajo({ categoria: 'PULIDO', tecnico: 'Técnico C' })] }),
    ])
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    await user.click(elegir('iPhone 11 64 GB Blanco'))
    expect(titulo()).toBe('iPhone 11 64 GB Blanco · 1 B · 2 B100 · +1 con técnico')
    const moviles = filas(within(panel()).getByRole('table', { name: 'Móviles de iPhone 11 64 GB Blanco' }))
    expect(moviles.map(celdas)).toEqual([
      ['350000000000106', 'B → A', 'Listos', '25', '—'],
      ['350000000000107', 'B100 → A100', 'Listos', '11', '—'],
      ['350000000000110', 'B100 → A100', 'Listos', '3', '—'],
      ['350000000000111', 'B → A', 'Taller · Pulir', '2', 'Técnico C (pulido)'],
    ])
    expect(moviles.map((f) => f.classList.contains('text-texto-suave'))).toEqual([false, false, false, true])
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

  it('sin nada que revisar (un n/a con un A en su modelo-color no sale), el texto de vacío, sin panel, y el Excel apagado', async () => {
    const user = userEvent.setup()
    pintar([visto({ imeiSn: '350000000000121', grado: 'n/a' }), visto({ imeiSn: '350000000000122', grado: 'A' })])
    expect(screen.getByText('Nada que revisar: ningún modelo-color con todo sin grado en stock.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Revisar sin grado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Móviles del modelo-color' })).not.toBeInTheDocument()
    const excel = screen.getByRole('button', { name: '⬇ Descargar Excel' })
    expect(excel).toBeDisabled()
    expect(excel).toHaveAttribute('title', 'No hay nada pendiente')
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    expect(screen.getByText('Ningún B que subir.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Móviles del modelo-color' })).not.toBeInTheDocument()
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

  it('al volver del detalle del IMEI, la tarjeta elegida y lo elegido siguen donde estaban', async () => {
    const user = userEvent.setup()
    const primero = pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    await user.click(elegir('iPhone 11 64 GB Blanco'))
    primero.unmount()
    pintar()
    expect(screen.getByRole('button', { name: 'Subir B a A' })).toHaveAttribute('aria-pressed', 'true')
    expect(elegir('iPhone 11 64 GB Blanco')).toHaveAttribute('aria-pressed', 'true')
    expect(titulo()).toBe('iPhone 11 64 GB Blanco · 1 B · 1 B100')
  })

  it('lo elegido es de cada tarjeta y sigue al cambiar de tarjeta y volver', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(elegir('iPhone 13 128 GB Azul'))
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    expect(panel()).toHaveTextContent(PULSA)
    await user.click(elegir('iPhone 11 64 GB Blanco'))
    await user.click(screen.getByRole('button', { name: 'Revisar sin grado' }))
    expect(titulo()).toBe('iPhone 13 128 GB Azul · 1 sin grado')
    expect(elegir('iPhone 13 128 GB Azul')).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    expect(titulo()).toBe('iPhone 11 64 GB Blanco · 1 B · 1 B100')
    expect(estadoStockTelefonos.get().queRevisar.elegido).toEqual({ revisar: 'iPhone 13|128GB|Azul', subir: 'iPhone 11|64GB|Blanco' })
  })

  it('con el sondeo, lo elegido sigue elegido y un modelo-color que se queda sin nada desaparece', async () => {
    const user = userEvent.setup()
    const primero = pintar()
    await user.click(elegir('iPhone 15 Pro 256 GB Titanio natural'))
    expect(elegir('iPhone 13 128 GB Azul')).toBeInTheDocument()
    primero.unmount()
    pintar(STOCK.filter((m) => m.imeiSn !== '350000000000104'))
    expect(screen.queryByRole('button', { name: 'Ver los móviles de iPhone 13 128 GB Azul' })).not.toBeInTheDocument()
    expect(titulo()).toBe('iPhone 15 Pro 256 GB Titanio natural · 1 sin grado · +1 con técnico')
  })

  it('si el modelo-color elegido deja de estar en la lista (un Items nuevo o la búsqueda), el panel vuelve a «Pulsa…»', async () => {
    const user = userEvent.setup()
    const primero = pintar()
    await user.click(elegir('iPhone 13 128 GB Azul'))
    primero.unmount()
    pintar(STOCK.filter((m) => m.imeiSn !== '350000000000104'))
    expect(panel()).toHaveTextContent(PULSA)
    expect(titulo()).toBeNull()
    await user.click(elegir('iPhone 15 Pro 256 GB Titanio natural'))
    act(() => escribir('12 pro'))
    expect(screen.queryByRole('button', { name: 'Ver los móviles de iPhone 15 Pro 256 GB Titanio natural' })).not.toBeInTheDocument()
    expect(elegir('iPhone 12 Pro 128 GB Grafito')).toHaveAttribute('aria-pressed', 'false')
    expect(panel()).toHaveTextContent(PULSA)
    expect(titulo()).toBeNull()
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

  it('sin nada que coincida lo dice, sin panel', () => {
    estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, buscar: ' xyz ' } }))
    pintar()
    expect(screen.getByText('Ningún modelo-color con «xyz».')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Móviles del modelo-color' })).not.toBeInTheDocument()
  })

  it('un trozo de IMEI de 6 cifras elige su modelo-color y resalta el móvil en el panel', () => {
    escribir('000101')
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(filas(tabla).map(celdas)).toEqual([
      ['Menos de 3 sin revisar · 1 modelo-color · 1 móvil'],
      ['▸iPhone 15 Pro', '256 GB', 'Titanio natural', '1+1 con técnico'],
    ])
    expect(elegir('iPhone 15 Pro 256 GB Titanio natural')).toHaveAttribute('aria-pressed', 'true')
    expect(titulo()).toBe('iPhone 15 Pro 256 GB Titanio natural · 1 sin grado · +1 con técnico')
    const [primero, segundo] = filas(within(panel()).getByRole('table', { name: 'Móviles de iPhone 15 Pro 256 GB Titanio natural' }))
    expect(primero).toHaveClass('bg-amarillo/40')
    expect(segundo).not.toHaveClass('bg-amarillo/40')
  })

  it('buscar un IMEI elige el primero con ese IMEI y no pisa lo elegido a mano mientras la búsqueda no cambie', async () => {
    const user = userEvent.setup()
    escribir('35000000000010')
    const primero = pintar()
    expect(titulo()).toBe('iPhone 15 Pro 256 GB Titanio natural · 1 sin grado · +1 con técnico')
    await user.click(elegir('iPhone 13 128 GB Azul'))
    expect(titulo()).toBe('iPhone 13 128 GB Azul · 1 sin grado')
    primero.unmount()
    pintar()
    expect(titulo()).toBe('iPhone 13 128 GB Azul · 1 sin grado')
    act(() => escribir('000103'))
    expect(titulo()).toBe('iPhone 12 Pro 128 GB Grafito · 0 sin grado · +1 con técnico')
    expect(filas(within(panel()).getByRole('table', { name: 'Móviles de iPhone 12 Pro 128 GB Grafito' }))[0]).toHaveClass('bg-amarillo/40')
  })
})
