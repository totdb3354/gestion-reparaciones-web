import { expect, test } from '@playwright/test'

// El salto de foco al leer IMEI con la pistola: en Chromium real, con la API falsa por `page.route` (datos inventados).
// Solo local: `npx playwright test -c playwright.local.config.ts pedidos-salto`.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`

test('dos lecturas seguidas con el teclado (como una pistola) caen cada una en su fila, sin perder cifras', async ({ page }) => {
  const filas = Array.from({ length: 6 }, (_, k) => ({
    idFila: k + 1, fecha: '2026-11-09', plataforma: 'Web', canal: null, sku: 'i14128NegroA', imei: k === 2 ? '350000000000333' : null, pedido: pedido(k + 1),
    fechaCompra: '2026-11-09', estado: 'PENDIENTE', editable: true, envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null,
    seguimiento: null, nivel: null, motivo: null, skuMovil: null, caja: null,
  }))
  const puts: { id: string; imei: string | null }[] = []
  await page.addInitScript(() => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
  })
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [{ fuente: 'SHIPPYPRO', ultimaOk: new Date().toISOString(), ultimoIntento: new Date().toISOString(), ultimoError: null, ok: true }] })
    const m = /\/api\/pedidos\/filas\/(\d+)\/imei$/.exec(ruta)
    if (m && route.request().method() === 'PUT') {
      const imei = (route.request().postDataJSON() as { imei: string | null }).imei
      puts.push({ id: m[1], imei })
      // El servidor tarda: la siguiente lectura llega antes de que conteste.
      await new Promise((r) => setTimeout(r, 700))
      const f = filas[Number(m[1]) - 1]
      f.imei = imei
      return route.fulfill({ json: f })
    }
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  await expect(page.getByRole('button', { name: pedido(6), exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'pulsa para poner el IMEI…' }).first().click()
  // Un desplegable que se cierra sigue un instante en pantalla (animacion de salida): el activo es el abierto.
  const campo = page.locator('[data-state="open"] input[aria-label="IMEI"]')
  await expect(campo).toBeFocused()
  // Sin plegar en medio ni tocar el raton: lectura, Enter, lectura, Enter, lectura (la fila 3 ya tiene IMEI y se salta).
  await page.keyboard.type('350000000000011')
  await page.keyboard.press('Enter')
  await page.keyboard.type('350000000000022')
  await page.keyboard.press('Enter')
  await page.keyboard.type('350000000000044')
  await page.keyboard.press('Enter')
  await expect.poll(() => puts.length).toBe(3)
  expect(puts).toEqual([
    { id: '1', imei: '350000000000011' }, { id: '2', imei: '350000000000022' }, { id: '4', imei: '350000000000044' },
  ])
  await expect(campo).toBeFocused()
  await expect(campo).toHaveValue('')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(5))
  await expect(page.getByRole('alert')).toHaveCount(0)
})
