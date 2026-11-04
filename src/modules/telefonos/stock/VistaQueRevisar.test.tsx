import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AvisoBreveHost } from '@/shared/ui/AvisoBreve'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
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
  renderConProviders(
    <><VistaQueRevisar revisar={listaRevisar(moviles)} subir={listaSubir(moviles)} cargando={cargando} error={error} onAbrirImei={onAbrirImei} /><AvisoBreveHost /></>,
    { sesion: SESION_SUPER },
  )
  return onAbrirImei
}
const cabeceras = (tabla: HTMLElement) => within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
const filas = (tabla: HTMLElement) => within(tabla).getAllByRole('row').slice(1)
const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })

describe('«Qué revisar» (spec 0.9.25 §3)', () => {
  it('dos tarjetas con su cifra, su subtítulo y su botón; se entra en «Revisar sin grado», con su ayuda y el pie', () => {
    pintar()
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('2 modelos-color · 2 móviles')
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('n/a de modelos con 0 o 1 A')
    expect(within(tarjeta('Revisar sin grado')).getByRole('button', { name: 'Copiar lista (2)' })).toBeEnabled()
    expect(tarjeta('Subir B a A')).toHaveTextContent('1 modelo-color · 2 móviles')
    expect(tarjeta('Subir B a A')).toHaveTextContent('B y B100 de modelos con 0 o 1 A')
    expect(screen.getByRole('button', { name: 'Revisar sin grado' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/^Los modelos-color con móviles sin grado \(n\/a\) y como mucho un A/)).toBeInTheDocument()
    expect(screen.getByText(/^Solo cuenta lo que es stock\./)).toBeInTheDocument()
  })

  it('«Revisar sin grado»: una fila por modelo-color, con su motivo; el que solo tiene el técnico, en gris', () => {
    pintar()
    const tabla = screen.getByRole('table', { name: 'Revisar sin grado' })
    expect(cabeceras(tabla)).toEqual(['Motivo', 'Modelo', 'Cap.', 'Color', 'Sin grado', 'A en stock', 'Con grado'])
    const [uno, dos, tres] = filas(tabla)
    expect(uno).toHaveTextContent('Nada con grado')
    expect(uno).toHaveTextContent('iPhone 15 Pro256 GBTitanio natural')
    expect(uno).toHaveTextContent('1+1 con técnico')
    expect(dos).toHaveTextContent('iPhone 12 Pro')
    expect(dos).toHaveClass('text-texto-suave')
    expect(tres).toHaveTextContent('Solo 1 A')
    expect(within(tres).getByTitle('1 A+')).toHaveTextContent('1A+')
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

  it('«Copiar lista» copia lo pendiente con el texto de MENSAJES y lo avisa', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(within(tarjeta('Revisar sin grado')).getByRole('button', { name: 'Copiar lista (2)' }))
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(
      '🔍 REVISAR PRIORITARIO\niPhone 15 Pro 256 GB Titanio natural\nSin grado: 1 · Nada con grado\n\n'
      + '🔍 REVISAR PRIORITARIO\niPhone 13 128 GB Azul\nSin grado: 1 · Solo 1 A'))
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent('Copiada la lista: 2 modelos-color')
    expect(screen.getByRole('button', { name: 'Revisar sin grado' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('«Subir B a A»: su tabla, el paso de cada móvil y su «Copiar lista»', async () => {
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
    await user.click(within(tarjeta('Subir B a A')).getByRole('button', { name: 'Copiar lista (1)' }))
    await waitFor(async () => expect(await navigator.clipboard.readText())
      .toBe('⬆️ SUBIR DE GRADO\niPhone 11 64 GB Negro\nB → A: 1 · B100 → A100: 1'))
    expect(await screen.findByTestId('aviso-breve')).toHaveTextContent('Copiada la lista: 1 modelo-color')
  })

  it('sin nada que revisar, el texto de vacío y los botones apagados', async () => {
    const user = userEvent.setup()
    pintar([visto({ grado: 'A' })])
    expect(screen.getByText('Nada que revisar: todos los modelos-color con móviles sin grado tienen 2 A o más.')).toBeInTheDocument()
    const copiar = within(tarjeta('Revisar sin grado')).getByRole('button', { name: 'Copiar lista' })
    expect(copiar).toBeDisabled()
    expect(copiar).toHaveAttribute('title', 'No hay nada pendiente')
    await user.click(screen.getByRole('button', { name: 'Subir B a A' }))
    expect(screen.getByText('Ningún B que subir.')).toBeInTheDocument()
  })

  it('con solo un modelo-color que tiene el técnico, la fila sale en gris y la tarjeta en 0', () => {
    pintar([STOCK[2]])
    expect(tarjeta('Revisar sin grado')).toHaveTextContent('0 modelos-color · 0 móviles')
    expect(within(tarjeta('Revisar sin grado')).getByRole('button', { name: 'Copiar lista' })).toBeDisabled()
    expect(filas(screen.getByRole('table', { name: 'Revisar sin grado' }))[0]).toHaveClass('text-texto-suave')
  })

  it('cargando y sin poder cargar', () => {
    pintar([], { cargando: true })
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('sin poder cargar lo dice y no afirma que no haya nada', () => {
    pintar([], { error: true })
    expect(screen.getByText('No se pudo cargar el stock de teléfonos.')).toBeInTheDocument()
    expect(screen.queryByText(/^Nada que revisar/)).not.toBeInTheDocument()
  })
})
