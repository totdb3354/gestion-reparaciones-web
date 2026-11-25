import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// La celda del IMEI en línea (spec 2026-11-25 «el IMEI se pica en la celda») en Chromium real, con la API falsa por `page.route`
// (datos inventados). Solo local: `npx playwright test -c playwright.local.config.ts pedidos-imei-celda`.
// Las capturas van a la carpeta de la variable CAPTURAS (fuera del repo); sin ella, no se hacen.
const CAPTURAS = process.env.CAPTURAS
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true })
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`

/** Cifra de control de Luhn de 14 cifras. */
function control(base: string): number {
  let suma = 0
  for (let i = 0; i < base.length; i++) {
    let d = Number(base[base.length - 1 - i])
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return (10 - (suma % 10)) % 10
}
/** IMEI sintético con la cifra de control válida. No es de ningún móvil real. */
const imeiValido = (n: number) => { const base = `3500${String(n).padStart(10, '0')}`; return base + control(base) }
/** El mismo, con la cifra de control equivocada. */
const imeiMalo = (n: number) => { const v = imeiValido(n); return v.slice(0, 14) + String((Number(v[14]) + 1) % 10) }

/** API falsa con 8 filas sin IMEI y «Pedidos» abierto con el periodo «Todo». Los PUT tardan 150 ms. */
async function prepararPedidos(page: Page) {
  const filas = Array.from({ length: 8 }, (_, k) => ({
    idFila: k + 1, fecha: '2026-11-09', plataforma: 'Web', canal: null, sku: 'i14128NegroA', imei: null as string | null, pedido: pedido(k + 1),
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
      const cuerpo = route.request().postDataJSON() as { imei: string | null }
      puts.push({ id: m[1], imei: cuerpo.imei })
      await new Promise((r) => setTimeout(r, 150))
      const f = filas[Number(m[1]) - 1]
      f.imei = cuerpo.imei
      return route.fulfill({ json: f })
    }
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [{ imei: imeiValido(901), sku: null, caja: 'Caja A1', nivel: 1 }, { imei: imeiValido(902), sku: null, caja: 'Caja A2', nivel: 1 }] })
    if (ruta.endsWith('/cambios')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  await expect(page.getByRole('button', { name: pedido(8), exact: true })).toBeVisible()
  return { puts, filas }
}

const fila = (page: Page, i: number) => page.locator('tr[data-estado]', { has: page.getByRole('button', { name: pedido(i), exact: true }) })
const campo = (page: Page) => page.getByRole('textbox', { name: 'IMEI' })
const panel = (page: Page) => page.getByRole('region', { name: 'Detalle del pedido' })
const sinImei = (page: Page, n: number) => page.getByRole('button', { name: `${n} sin IMEI` })
const yDe = async (page: Page, i: number) => (await page.getByRole('button', { name: pedido(i), exact: true }).boundingBox())!.y

test('con «sin IMEI» puesto, picar 3 filas seguidas (una con Luhn malo): las filas no se mueven y el campo acaba en la siguiente vacía', async ({ page }) => {
  const { puts } = await prepararPedidos(page)
  await sinImei(page, 8).click()
  await expect(sinImei(page, 8)).toHaveAttribute('aria-pressed', 'true')
  const [a, malo, c] = [imeiValido(11), imeiMalo(22), imeiValido(33)]
  await fila(page, 1).getByRole('button', { name: 'pulsa para poner el IMEI…' }).click()
  await expect(campo(page)).toBeFocused()

  const y0 = await yDe(page, 6)
  // Cada lectura espera a que el campo esté en la fila siguiente (con `fill` + Enter, sin teclas sueltas que Chromium pueda perder).
  await campo(page).fill(a)
  await campo(page).press('Enter')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(2))
  await expect(campo(page)).toBeFocused()
  expect(await yDe(page, 6), 'tras la 1.ª, la fila 6 no se mueve').toBeCloseTo(y0, 0)

  await campo(page).fill(malo)
  await campo(page).press('Enter')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(3))
  await expect(campo(page)).toBeFocused()
  // La lectura mala saca el aviso no modal en la barra del buscador (spec §2): no mueve la tabla, la línea base sigue siendo y0.
  await expect(page.getByRole('alert')).toContainText('IMEI no válido')
  expect(await yDe(page, 6), 'al salir el aviso, la fila 6 no se mueve').toBeCloseTo(y0, 0)
  const y1 = y0
  if (CAPTURAS) { try { await page.getByRole('alert').locator('..').screenshot({ path: `${CAPTURAS}/c-aviso-barra.png` }) } catch { /* la captura no rompe la prueba */ } }

  await campo(page).fill(c)
  await campo(page).press('Enter')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(4))
  await expect(campo(page)).toBeFocused()
  await expect(campo(page)).toHaveValue('')
  expect(await yDe(page, 6), 'tras la 3.ª, la fila 6 no se mueve').toBeCloseTo(y1, 0)
  // Y al cerrar el aviso tampoco.
  await page.getByRole('button', { name: 'Cerrar el aviso' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await yDe(page, 6), 'al cerrar el aviso, la fila 6 no se mueve').toBeCloseTo(y0, 0)

  // Las 3 siguen en la tabla (vista fija): la buena con su IMEI, la mala en rojo y sin guardar.
  await expect(fila(page, 1).getByText(a)).toBeVisible()
  await expect(fila(page, 3).getByText(c)).toBeVisible()
  await expect(fila(page, 2).getByText(`IMEI no válido · …${malo.slice(-4)}`)).toBeVisible()
  await expect.poll(() => puts).toEqual([{ id: '1', imei: a }, { id: '3', imei: c }])
  // El contador baja, pero las filas picadas siguen donde estaban.
  await expect(sinImei(page, 6)).toBeVisible()
  if (CAPTURAS) { try { await page.screenshot({ path: `${CAPTURAS}/a-tras-picar.png` }) } catch { /* la captura no rompe la prueba */ } }
})

test('el ▾ abre «Recomendados» sin sacar el foco del campo; un Escape cierra solo la lista y el segundo cierra la celda', async ({ page }) => {
  await prepararPedidos(page)
  await fila(page, 1).getByRole('button', { name: 'pulsa para poner el IMEI…' }).click()
  await expect(campo(page)).toBeFocused()
  await page.getByRole('button', { name: 'Ver recomendados' }).click()
  const lista = page.getByRole('dialog', { name: 'Recomendados' })
  await expect(lista).toBeVisible()
  await expect(lista).toContainText('Caja A1')
  await expect(campo(page)).toBeFocused()
  if (CAPTURAS) { try { await page.screenshot({ path: `${CAPTURAS}/b-lista-abierta.png` }) } catch { /* la captura no rompe la prueba */ } }

  await page.keyboard.press('Escape')
  await expect(lista).toHaveCount(0)
  await expect(campo(page)).toBeVisible()
  await expect(campo(page)).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(campo(page)).toHaveCount(0)
  await expect(fila(page, 1).getByRole('button', { name: 'pulsa para poner el IMEI…' })).toBeVisible()
})

test('con el panel abierto y una celda abierta: el primer Escape cierra solo la celda y el segundo el panel', async ({ page }) => {
  await prepararPedidos(page)
  await page.getByRole('button', { name: pedido(2), exact: true }).click()
  await expect(panel(page)).toBeVisible()
  await fila(page, 3).getByRole('button', { name: 'pulsa para poner el IMEI…' }).click()
  await expect(campo(page)).toBeFocused()
  await expect(panel(page)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(campo(page)).toHaveCount(0)
  await expect(panel(page)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(panel(page)).toHaveCount(0)
})

test('el campo en línea cabe dentro de su celda y no mueve las filas de debajo', async ({ page }) => {
  await prepararPedidos(page)
  const y0 = await yDe(page, 5)
  await fila(page, 2).getByRole('button', { name: 'pulsa para poner el IMEI…' }).click()
  await expect(campo(page)).toBeFocused()
  const celda = fila(page, 2).locator('td[data-imei]')
  const [c, td] = [await campo(page).boundingBox(), await celda.boundingBox()]
  expect(c!.x).toBeGreaterThanOrEqual(td!.x)
  expect(c!.y).toBeGreaterThanOrEqual(td!.y)
  expect(c!.x + c!.width).toBeLessThanOrEqual(td!.x + td!.width + 0.5)
  expect(c!.y + c!.height).toBeLessThanOrEqual(td!.y + td!.height + 0.5)
  // El campo es de la celda, no un panel flotante: nada de «dialog» y la fila de debajo no se mueve.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await yDe(page, 5)).toBeCloseTo(y0, 0)
  // El contador y el ▾ están dentro de la celda.
  const mas = await page.getByRole('button', { name: 'Ver recomendados' }).boundingBox()
  expect(mas!.x + mas!.width).toBeLessThanOrEqual(td!.x + td!.width + 0.5)
})

test('al recargar la página, la celda en rojo de una lectura no válida sigue en rojo (y la lectura de 16 cifras también)', async ({ page }) => {
  const { puts } = await prepararPedidos(page)
  const malo = imeiMalo(44)
  await fila(page, 1).getByRole('button', { name: 'pulsa para poner el IMEI…' }).click()
  await campo(page).fill(malo)
  await campo(page).press('Enter')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(2))
  await campo(page).fill(imeiValido(55) + '7')
  await campo(page).press('Enter')
  await expect(page.locator('tr[data-aqui]')).toContainText(pedido(3))
  await expect(fila(page, 1).getByText(`IMEI no válido · …${malo.slice(-4)}`)).toBeVisible()
  await expect(fila(page, 2).getByText('IMEI no válido · 16 cifras')).toBeVisible()
  expect(puts).toEqual([])

  await page.reload()
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  await expect(page.getByRole('button', { name: pedido(8), exact: true })).toBeVisible()
  await expect(fila(page, 1).getByText(`IMEI no válido · …${malo.slice(-4)}`)).toBeVisible()
  await expect(fila(page, 2).getByText('IMEI no válido · 16 cifras')).toBeVisible()

  // Reabrir la roja con la cifra de control mala ofrece «Guardar igual» (y la de 16 cifras, no).
  await fila(page, 1).getByRole('button', { name: /IMEI no válido/ }).click()
  await expect(campo(page)).toHaveValue(malo)
  await expect(page.getByRole('button', { name: 'Guardar igual' })).toBeVisible()
  await page.keyboard.press('Escape')
  await fila(page, 2).getByRole('button', { name: /IMEI no válido/ }).click()
  await expect(page.getByRole('button', { name: 'Guardar igual' })).toHaveCount(0)
})
