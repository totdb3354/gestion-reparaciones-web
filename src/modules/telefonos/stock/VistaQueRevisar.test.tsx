import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AvisoBreveHost } from '@/shared/ui/AvisoBreve'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import { estadoStockTelefonos } from './estado'
import { listaRevisar, listaSubir } from './queRevisar'
import { VistaQueRevisar } from './VistaQueRevisar'

const P15 = { modelo: '15pro', modeloMaestro: '15 PRO', capacidad: '256GB', color: 'Titanio natural' }
const N11 = { modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro' }
// Revisar: 15 Pro (1 pendiente +1 con técnico, Nada con grado), 12 Pro (solo con técnico: en gris) y 13 128 Azul (Solo 1 A).
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

function pintar(moviles: Movil[] = STOCK, { cargando = false, error = false } = {}) {
  const onAbrirImei = vi.fn()
  const { unmount } = renderConProviders(
    <><VistaQueRevisar revisar={listaRevisar(moviles)} subir={listaSubir(moviles)} cargando={cargando} error={error} onAbrirImei={onAbrirImei} /><AvisoBreveHost /></>,
    { sesion: SESION_SUPER },
  )
  return Object.assign(onAbrirImei, { unmount })
}
const cabeceras = (tabla: HTMLElement) => within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
const filas = (tabla: HTMLElement) => within(tabla).getAllByRole('row').slice(1)
const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })

describe('«Qué revisar» (spec 0.9.25 §3)', () => {
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

  it('«Revisar sin grado»: una fila por modelo-color, con su motivo; el que solo tiene el técnico, en gris', () => {
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(cabeceras(tabla)).toEqual(['Motivo', 'Modelo', 'Cap.', 'Color', 'Sin grado', 'A en stock', 'Con grado'])
    const [uno, dos, tres] = filas(tabla)
    expect(uno).toHaveTextContent('Nada con grado')
    expect(uno).toHaveTextContent('iPhone 15 Pro256 GBTitanio natural')
    expect(uno).toHaveTextContent('1+1 con técnico')
    expect(dos).toHaveTextContent('Solo 1 A')
    expect(within(dos).getByTitle('1 A+')).toHaveTextContent('1A+')
    expect(tres).toHaveTextContent('iPhone 12 Pro')
    expect(tres).toHaveClass('text-texto-suave')
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

  it('«Subir B a A»: su tabla, el paso de cada móvil', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    const tabla = screen.getByRole('table', { name: 'Subir B a A' })
    expect(cabeceras(tabla)).toEqual(['Modelo', 'Cap.', 'Color', 'A en stock', 'B', 'B100'])
    expect(screen.getByText(/^Los modelos-color con móviles B y como mucho un A en stock: candidatos a chasis/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver los móviles de iPhone 11 64 GB Negro' }))
    const [b, b100] = filas(screen.getByRole('table', { name: 'Móviles de iPhone 11 64 GB Negro' }))
    expect(b).toHaveTextContent('B → A')
    expect(b100).toHaveTextContent('B100 → A100')
  })

  it('sin nada que revisar, el texto de vacío', async () => {
    const user = userEvent.setup()
    pintar([visto({ grado: 'A' })])
    expect(screen.getByText('Nada que revisar: ningún móvil sin grado en stock.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    expect(screen.getByText('Ningún B que subir.')).toBeInTheDocument()
  })

  it('con solo un modelo-color que tiene el técnico, la fila sale en gris y la tarjeta en 0', () => {
    pintar([STOCK[2]])
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('0 modelos-color · 0 móviles')
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

  it('la caja de arriba filtra las filas por palabras clave; las tarjetas siguen con todo', () => {
    estadoStockTelefonos.set((e) => ({ ...e, queRevisar: { ...e.queRevisar, buscar: '15 pro' } }))
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(filas(tabla)).toHaveLength(1)
    expect(tabla).toHaveTextContent('iPhone 15 Pro')
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
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
