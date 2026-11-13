import { expect, test, type Page } from '@playwright/test'

// El salto de foco al leer IMEI con la pistola: en Chromium real, con la API falsa por `page.route` (datos inventados).
// Solo local: `npx playwright test -c playwright.local.config.ts pedidos-salto`.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`

/** IMEI sintético con la cifra de control de Luhn válida (14 cifras + dígito de control). No es de ningún móvil real. */
function imeiValido(n: number): string {
  const base = `3500${String(n).padStart(10, '0')}`
  let suma = 0
  for (let i = 0; i < base.length; i++) {
    let d = Number(base[base.length - 1 - i])
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return base + String((10 - (suma % 10)) % 10)
}

/** Monta la API falsa con 6 filas (la 3 ya con IMEI) y abre «Pedidos» con el periodo «Todo». Los PUT tardan 700 ms: la siguiente
 *  lectura llega antes de que el servidor conteste. */
async function prepararPedidos(page: Page) {
  const filas = Array.from({ length: 6 }, (_, k) => ({
    idFila: k + 1, fecha: '2026-11-09', plataforma: 'Web', canal: null, sku: 'i14128NegroA', imei: k === 2 ? '350000000000333' : null, pedido: pedido(k + 1),
    fechaCompra: '2026-11-09', estado: 'PENDIENTE', editable: true, envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null,
    seguimiento: null, nivel: null, motivo: null, skuMovil: null, caja: null,
  }))
  const puts: { id: string; imei: string | null; imeiAnterior: string | null | undefined }[] = []
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
      const cuerpo = route.request().postDataJSON() as { imei: string | null; imeiAnterior?: string | null }
      puts.push({ id: m[1], imei: cuerpo.imei, imeiAnterior: cuerpo.imeiAnterior })
      await new Promise((r) => setTimeout(r, 700))
      const f = filas[Number(m[1]) - 1]
      f.imei = cuerpo.imei
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
  return { puts, campo }
}

test('dos lecturas seguidas con el teclado (como una pistola) caen cada una en su fila, sin perder cifras', async ({ page }) => {
  const { puts, campo } = await prepararPedidos(page)
  const [a, b, c] = [imeiValido(11), imeiValido(22), imeiValido(44)]
  // Sin plegar en medio ni tocar el raton: lectura, Enter, lectura, Enter, lectura (la fila 3 ya tiene IMEI y se salta). La ultima
  // se guarda sola, sin Enter, tras el momento quieto de 120 ms.
  await page.keyboard.type(a, { delay: 0 })
  await page.keyboard.press('Enter')
  await page.keyboard.type(b, { delay: 0 })
  await page.keyboard.press('Enter')
  await page.keyboard.type(c, { delay: 0 })
  await expect.poll(() => puts.length).toBe(3)
  expect(puts).toEqual([
    { id: '1', imei: a, imeiAnterior: '' }, { id: '2', imei: b, imeiAnterior: '' }, { id: '4', imei: c, imeiAnterior: '' },
  ])
  await expect(campo).toBeFocused()
  await expect(campo).toHaveValue('')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(5))
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('una cifra suelta y luego dos lecturas: nada cae en la fila siguiente y la 2.ª lectura sustituye a la errónea', async ({ page }) => {
  const { puts, campo } = await prepararPedidos(page)
  const [a, b] = [imeiValido(11), imeiValido(22)]
  await page.keyboard.type('9', { delay: 0 })
  // La cifra suelta + la 1.ª lectura (y su Enter): más de 15 cifras, error y nada guardado.
  await page.keyboard.type(a, { delay: 0 })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Hay más de 15 cifras')
  await page.waitForTimeout(500)
  expect(puts).toEqual([])
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(1))
  // La 2.ª lectura llega tras una pausa: sustituye y se guarda en la fila 1.
  await page.keyboard.type(b, { delay: 0 })
  await page.keyboard.press('Enter')
  await expect.poll(() => puts.length).toBe(1)
  expect(puts).toEqual([{ id: '1', imei: b, imeiAnterior: '' }])
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(2))
  await expect(campo).toHaveValue('')
})

test('un código 2D con dos IMEI (A B y Enter) no reparte uno en cada fila', async ({ page }) => {
  const { puts, campo } = await prepararPedidos(page)
  const [a, b] = [imeiValido(11), imeiValido(22)]
  await page.keyboard.type(`${a} ${b}`, { delay: 0 })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Hay más de 15 cifras: lee un solo IMEI')
  await page.waitForTimeout(500)
  expect(puts).toEqual([])
  await expect(campo).toHaveValue(`${a}${b}`)
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(1))
})
