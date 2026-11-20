import { expect, test, type Page } from '@playwright/test'

// Los botones «↓ Al final» y «Fila seleccionada» en Chromium real (maquetación de verdad), con la API falsa por `page.route` (datos
// inventados). Normal (200 filas) y en modo ventana (6.000, por encima de UMBRAL_VENTANA). Solo local:
// `npx playwright test -c playwright.local.config.ts pedidos-volver`.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`

async function abrirPedidos(page: Page, n: number) {
  const filas = Array.from({ length: n }, (_, k) => ({
    idFila: k + 1, fecha: '2026-11-09', plataforma: 'Web', canal: null, sku: 'i14128NegroA', imei: null, pedido: pedido(k + 1),
    fechaCompra: '2026-11-09', estado: 'PENDIENTE', editable: true, envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null,
    seguimiento: null, nivel: null, motivo: null, skuMovil: null, caja: null,
  }))
  await page.addInitScript(() => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
  })
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [{ fuente: 'SHIPPYPRO', ultimaOk: new Date().toISOString(), ultimoIntento: new Date().toISOString(), ultimoError: null, ok: true }] })
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.setViewportSize({ width: 1400, height: 860 })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  await expect(page.getByRole('button', { name: pedido(n), exact: true })).toBeVisible()
}

const tabla = (page: Page) => page.getByRole('region', { name: 'Tabla de pedidos' })
const enFinal = (page: Page) => tabla(page).evaluate((c) => c.scrollHeight - c.scrollTop - c.clientHeight < 8)
const fila = (page: Page, i: number) => page.locator('tr', { has: page.getByRole('button', { name: pedido(i), exact: true }) })

for (const [modo, n, elegida] of [['normal', 200, 120], ['ventana', 6000, 3000]] as const) {
  test(`${modo}: abre al final, «↓ Al final» y «Fila seleccionada» llevan a su sitio`, async ({ page }, info) => {
    await abrirPedidos(page, n)
    expect(await enFinal(page)).toBe(true)
    await expect(page.getByRole('button', { name: /Al final|Fila seleccionada/ })).toHaveCount(0)

    // Elegir una fila lejos del final: subir hasta ella y abrir su detalle (la deja seleccionada).
    const alto = await page.locator('tr[data-estado]').first().evaluate((e) => (e as HTMLElement).offsetHeight)
    await tabla(page).evaluate((c, y) => { c.scrollTop = y }, (elegida - 5) * alto)
    await fila(page, elegida).getByRole('button', { name: pedido(elegida), exact: true }).click()
    await expect(fila(page, elegida)).toHaveAttribute('data-aqui', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '↓ Al final' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Fila seleccionada/ })).toHaveCount(0)

    // Al final con el botón: el de la fila seleccionada sale con la flecha hacia arriba.
    await page.getByRole('button', { name: '↓ Al final' }).click()
    await expect.poll(() => enFinal(page)).toBe(true)
    await expect(page.getByRole('button', { name: '↓ Al final' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '↑ Fila seleccionada' })).toBeVisible()
    await page.screenshot({ path: info.outputPath(`${modo}-final.png`) })

    // Arriba del todo: la flecha cambia hacia abajo; un clic la deja a la vista y el botón se va.
    await tabla(page).evaluate((c) => { c.scrollTop = 0 })
    await expect(page.getByRole('button', { name: '↓ Fila seleccionada' })).toBeVisible()
    await page.getByRole('button', { name: '↓ Fila seleccionada' }).click()
    await expect(fila(page, elegida)).toBeInViewport()
    await expect(page.getByRole('button', { name: /Fila seleccionada/ })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`${modo}-seleccionada.png`) })
  })
}
