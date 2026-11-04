import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MovilVendido } from '@/shared/api/client'
import { hoyMadrid } from '@/shared/lib/fechas'
import { AvisoBreveHost } from '@/shared/ui/AvisoBreve'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { movilVendido, trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import { estadoStockTelefonos } from './estado'
import { listaRevisar, listaSubir } from './queRevisar'
import { VistaQueRevisar } from './VistaQueRevisar'

const P15 = { modelo: '15pro', modeloMaestro: '15 PRO', capacidad: '256GB', color: 'Titanio natural' }
const N11 = { modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro' }
// Revisar: 15 Pro (1 pendiente +1 con técnico, Nada con grado), 13 128 Azul (Solo 1 A) y 12 Pro (solo con técnico: en gris).
// Subir: 11 Negro (B → A y B100 → A100).
const STOCK: Movil[] = [
  visto({ imeiSn: '350000000000101', ...P15, grado: 'n/a', dias: 41, ubicacion: 'En revisión' }),
  visto({ imeiSn: '350000000000102', ...P15, grado: 'n/a', dias: 23, ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico A' })] }),
  visto({ imeiSn: '350000000000103', modelo: '12pro', modeloMaestro: '12 PRO', color: 'Grafito', grado: 'n/a',
    ubicacion: 'Taller · Glass', trabajos: [trabajo({ categoria: 'GLASS', tecnico: 'Técnico B' })] }),
  visto({ imeiSn: '350000000000104', grado: 'n/a', ubicacion: 'En revisión' }),
  visto({ imeiSn: '350000000000105', grado: 'A+' }),
  visto({ imeiSn: '350000000000106', ...N11, grado: 'B', dias: 25 }),
  visto({ imeiSn: '350000000000107', ...N11, grado: 'B', bateriaNueva: true, dias: 11 }),
  visto({ imeiSn: '350000000000108', ...N11, grado: 'A' }),
]

type Opciones = { cargando?: boolean; error?: boolean; soloTres?: boolean; vendidos?: MovilVendido[]; sinVentas?: boolean }

/** Pinta la vista. Los modelos-color de STOCK tienen 1 pendiente o ninguno, así que por defecto el interruptor «Solo con 3 o más
 *  sin revisar» va apagado; el test del interruptor lo enciende. */
function pintar(moviles: Movil[] = STOCK, { cargando = false, error = false, soloTres = false, vendidos = [], sinVentas = false }: Opciones = {}) {
  estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, soloTres } }))
  const onAbrirImei = vi.fn()
  const { unmount } = renderConProviders(
    <><VistaQueRevisar revisar={listaRevisar(moviles, vendidos)} subir={listaSubir(moviles)} sinVentas={sinVentas} cargando={cargando} error={error}
      onAbrirImei={onAbrirImei} /><AvisoBreveHost /></>,
    { sesion: SESION_SUPER },
  )
  return Object.assign(onAbrirImei, { unmount })
}
const cabeceras = (tabla: HTMLElement) => within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
const filas = (tabla: HTMLElement) => within(tabla).getAllByRole('row').slice(1)
const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })
const interruptor = () => screen.getByRole('switch', { name: 'Solo con 3 o más sin revisar' })

describe('«Qué revisar» (spec 0.9.25 §3 y §10)', () => {
  afterEach(() => {
    delete window.showSaveFilePicker
    vi.restoreAllMocks()
  })

  it('dos tarjetas con su cifra y su subtítulo, sin botón; se entra en «Revisar sin grado», con su ayuda y el pie', () => {
    pintar()
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('n/a en stock, lo más pedido primero')
    expect(tarjeta('Subir B a A')).toHaveTextContent('1 modelo-color · 2 móviles')
    expect(tarjeta('Subir B a A')).toHaveTextContent('B y B100 de modelos con 0 o 1 A')
    for (const t of ['Revisar sin grado', 'Subir B a A']) expect(within(tarjeta(t)).getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Copiar lista/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar sin grado' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/^Los modelos-color con móviles sin grado \(n\/a\)\. Primero lo que más se pide/)).toBeInTheDocument()
    expect(screen.getByText(/^Solo cuenta lo que es stock\. Un móvil con un trabajo abierto sale en gris y no cuenta ni va en el Excel\./)).toBeInTheDocument()
  })

  it('se entra con «Solo con 3 o más sin revisar» encendido: solo esos modelos-color, y las tarjetas siguen con todo; apagado, todos', async () => {
    const user = userEvent.setup()
    expect(estadoStockTelefonos.get().queRevisar.soloTres).toBe(true)
    const tres = [101, 102, 103].map((n) => visto({ imeiSn: `350000000000${n + 100}`, ...N11, grado: 'n/a' }))
    pintar([...STOCK, ...tres], { soloTres: true })
    expect(interruptor()).toHaveAttribute('aria-checked', 'true')
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(filas(tabla)).toHaveLength(1)
    expect(filas(tabla)[0]).toHaveTextContent('iPhone 1164 GBNegro3')
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('3 modelos-color · 5 móviles')
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (3)' })).toBeEnabled()
    await user.click(interruptor())
    expect(interruptor()).toHaveAttribute('aria-checked', 'false')
    expect(estadoStockTelefonos.get().queRevisar.soloTres).toBe(false)
    expect(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))).toHaveLength(4)
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (5)' })).toBeEnabled()
  })

  it('con el interruptor encendido y nada con 3 o más, lo dice y el Excel va apagado', () => {
    pintar(STOCK, { soloTres: true })
    expect(screen.getByText('Ningún modelo-color con 3 o más sin revisar: apaga «Solo con 3 o más sin revisar» para verlos todos.')).toBeInTheDocument()
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
    const excel = screen.getByRole('button', { name: '⬇ Descargar Excel' })
    expect(excel).toBeDisabled()
    expect(excel).toHaveAttribute('title', 'No hay nada pendiente')
  })

  it('«Revisar sin grado»: una fila por modelo-color con su motivo y «Pedidos 15 d»; los de más pendientes primero; el que solo tiene el técnico, en gris', () => {
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(cabeceras(tabla)).toEqual(['Motivo', 'Modelo', 'Cap.', 'Color', 'Sin grado', 'Pedidos 15 d', 'A en stock', 'Con grado'])
    const [uno, dos, tres] = filas(tabla)
    expect(uno).toHaveTextContent('Nada con grado')
    expect(uno).toHaveTextContent('iPhone 15 Pro256 GBTitanio natural')
    expect(uno).toHaveTextContent('1+1 con técnico')
    expect(within(uno).getByTitle('0 vendidos + 0 de pedido')).toHaveTextContent('0')
    expect(dos).toHaveTextContent('Solo 1 A')
    expect(within(dos).getByTitle('1 A+')).toHaveTextContent('1A+')
    expect(tres).toHaveTextContent('iPhone 12 Pro')
    expect(tres).toHaveClass('text-texto-suave')
  })

  it('«Pedidos 15 d»: los vendidos y los de pedido de su modelo-color lo ponen primero, con el desglose al pasar el ratón', () => {
    pintar([
      ...STOCK,
      visto({ imeiSn: '350000000000109', ...N11, grado: 'n/a' }),
      visto({ imeiSn: '350000000000110', ...N11, grado: 'A', estado: 'DE_PEDIDO' }),
    ], { vendidos: [movilVendido({ ...N11, imeiSn: '350000000000111' }), movilVendido({ ...N11, imeiSn: '350000000000112' })] })
    const [uno] = filas(screen.getByRole('table', { name: 'Revisar sin grado' }))
    expect(uno).toHaveTextContent('iPhone 11')
    expect(within(uno).getByTitle('2 vendidos + 1 de pedido')).toHaveTextContent('3')
  })

  it('un modelo-color con 2 A también sale, con «Con A» en gris', () => {
    pintar([visto({ imeiSn: '350000000000121', grado: 'n/a' }), visto({ imeiSn: '350000000000122', grado: 'A' }),
      visto({ imeiSn: '350000000000123', grado: 'A-' })])
    const pastilla = within(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[0]).getByText('Con A')
    expect(pastilla).toHaveClass('bg-crema', 'text-azul-gris')
  })

  it('sin las ventas, la cabecera lo dice y solo cuentan los de pedido', () => {
    pintar(STOCK, { sinVentas: true })
    expect(screen.getByRole('columnheader', { name: 'Pedidos 15 d (sin ventas)' }))
      .toHaveAttribute('title', 'No se pudieron leer las ventas: solo cuentan los de pedido')
    expect(within(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[0]).getByTitle('0 de pedido (sin ventas)')).toBeInTheDocument()
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
    await user.click(screen.getByText('Solo 1 A'))
    expect(screen.getByRole('table', { name: 'Móviles de iPhone 13 128 GB Azul' })).toBeInTheDocument()
  })

  it('«⬇ Descargar Excel» abre «Guardar como» con el nombre del día, manda lo que se ve (sin el del técnico) y lo avisa', async () => {
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
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent('Descargado: 2 móviles')
    expect(ventana).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: `Que_revisar_sin_grado_${hoyMadrid()}.xlsx` }))
    expect(orden).toEqual(['ventana', 'servidor'])
    expect(cuerpos).toEqual([{
      hoja: 'Revisar sin grado',
      columnas: ['Modelo', 'Capacidad', 'Color', 'IMEI', 'Ubicación', 'Días en stock', 'Pedidos 15 d', 'Revisado'],
      filas: [
        ['iPhone 15 Pro', '256 GB', 'Titanio natural', '350000000000101', 'En revisión', '41', '0', ''],
        ['iPhone 13', '128 GB', 'Azul', '350000000000104', 'En revisión', '6', '0', ''],
      ],
    }])
    expect(await escrito[0].text()).toBe('PK')
  })

  it('«Subir B a A»: su tabla, el paso de cada móvil y su Excel, sin el interruptor', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    const tabla = screen.getByRole('table', { name: 'Subir B a A' })
    expect(cabeceras(tabla)).toEqual(['Modelo', 'Cap.', 'Color', 'A en stock', 'B', 'B100'])
    expect(screen.getByText(/^Los modelos-color con móviles B y como mucho un A en stock: candidatos a chasis/)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Solo con 3 o más sin revisar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver los móviles de iPhone 11 64 GB Negro' }))
    const [b, b100] = filas(screen.getByRole('table', { name: 'Móviles de iPhone 11 64 GB Negro' }))
    expect(b).toHaveTextContent('B → A')
    expect(b100).toHaveTextContent('B100 → A100')
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel (2)' })).toBeEnabled()
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
    await user.click(screen.getByRole('button', { name: '⬇ Descargar Excel (2)' }))
    await waitFor(() => expect(window.showSaveFilePicker)
      .toHaveBeenCalledWith(expect.objectContaining({ suggestedName: `Que_revisar_subir_B_a_A_${hoyMadrid()}.xlsx` })))
    expect(pedida).toBe(false)
    expect(screen.queryByTestId('aviso-breve')).toBeNull()
  })

  it('sin nada que revisar, el texto de vacío y el Excel apagado', async () => {
    const user = userEvent.setup()
    pintar([visto({ grado: 'A' })])
    expect(screen.getByText('Nada que revisar: ningún móvil sin grado en stock.')).toBeInTheDocument()
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
    expect(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[0]).toHaveClass('text-texto-suave')
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
    await user.click(screen.getByRole('button', { name: 'Ver los móviles de iPhone 11 64 GB Negro' }))
    primero.unmount()
    pintar()
    expect(screen.getByRole('button', { name: 'Subir B a A' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('table', { name: 'Móviles de iPhone 11 64 GB Negro' })).toBeInTheDocument()
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
    expect(filas(tabla)).toHaveLength(1)
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
    expect(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[0]).toHaveTextContent('iPhone 15 Pro')
    const [primero, segundo] = filas(screen.getByRole('table', { name: 'Móviles de iPhone 15 Pro 256 GB Titanio natural' }))
    expect(primero).toHaveClass('bg-amarillo/40')
    expect(segundo).not.toHaveClass('bg-amarillo/40')
  })
})
