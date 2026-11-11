import { expect, test, type Page } from '@playwright/test'

// Pedidos con 26.700 filas sinteticas (0.9.32, spec Pedidos v2, seccion 5) en Chromium real, con la API falsa por `page.route`.
// Solo local: `npx playwright test -c playwright.local.config.ts`. Datos inventados; no toca ningun servidor.
const N = 26_700
const NOTA = 'Tabla grande: se pinta solo lo que se ve. Para buscar usa el buscador (Control+F).'
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`
const FILAS = Array.from({ length: N }, (_, k) => {
  const i = k + 1
  const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(k / 80) * 86_400_000).toISOString().slice(0, 10)
  return {
    idFila: i, fecha: d, plataforma: i % 2 ? 'Web' : 'Amazon', canal: i % 2 ? null : 'AMAZON', sku: 'i14128NegroA',
    imei: i % 6 === 0 ? null : `3500000${String(i).padStart(8, '0')}`, pedido: pedido(i), fechaCompra: d,
    estado: i % 6 === 0 ? 'PENDIENTE' : 'ENVIADA', editable: true, envioFecha: i % 6 === 0 ? null : `${d}T10:00:00Z`,
    transportista: i % 6 === 0 ? null : 'Transportista A', seguimiento: i % 6 === 0 ? null : `SEG${i}`, nivel: null, motivo: null, skuMovil: null, caja: null,
  }
})
const SIN_IMEI = FILAS.filter((f) => f.imei === null).length

async function preparar(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
    localStorage.setItem('panelCarga', JSON.stringify({ estado: 'cerrado' }))
  })
  const desconocidas: string[] = []
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas: FILAS, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [{ fuente: 'SHIPPYPRO', ultimaOk: new Date().toISOString(), ultimoIntento: new Date().toISOString(), ultimoError: null, ok: true }] })
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    if (ruta.endsWith('/imei')) return route.fulfill({ json: {} })
    desconocidas.push(ruta)
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  return desconocidas
}

/** Un contador de arriba, por CSS: con 4.450 filas en el DOM (modo normal) las consultas por rol de Playwright tardan segundos. */
const contador = (page: Page, texto: string) => page.locator('[role="group"][aria-label="Contadores"] button', { hasText: texto })
const region = (page: Page) => page.getByRole('region', { name: 'Tabla de pedidos' })
const trs = (page: Page) => page.locator('tbody tr[data-estado]').count()
const geom = (page: Page) => region(page).evaluate((c) => ({ top: c.scrollTop, h: c.clientHeight, sh: c.scrollHeight }))
/** Espera dos fotogramas pintados: lo que cuesta de verdad que el usuario vea el resultado. */
const pintado = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
async function medir(page: Page, accion: () => Promise<unknown>, hasta: () => Promise<unknown>) {
  const t0 = Date.now(); await accion(); await hasta(); await pintado(page); return Date.now() - t0
}

test('Pedidos con 26.700 filas en Chromium real', async ({ page }) => {
  const desconocidas = await preparar(page)
  const cifras: Record<string, unknown> = {}
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))

  // (g) pintado inicial: de ir a la pagina a tener la ultima fila a la vista.
  const t0 = Date.now()
  await page.goto('/telefonos/pedidos')
  await expect(contador(page, `${N} filas`)).toBeVisible()
  await expect(page.getByText(NOTA)).toBeVisible()
  await expect(page.getByRole('button', { name: pedido(N), exact: true })).toBeVisible()
  await pintado(page)
  cifras.pintadoInicialMs = Date.now() - t0
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  await expect(contador(page, `${N} filas`)).toBeVisible()

  // (a) abre exactamente al final y la ultima fila se ve entera.
  await page.waitForTimeout(500)
  let g = await geom(page)
  cifras.alFinal = { top: g.top, h: g.h, sh: g.sh, diferencia: g.sh - g.top - g.h }
  expect(Math.abs(g.sh - g.top - g.h)).toBeLessThanOrEqual(2)
  const ultima = page.getByRole('button', { name: pedido(N), exact: true })
  const [rr, rf, rc] = await Promise.all([ultima.boundingBox(), region(page).boundingBox(), page.locator('thead').boundingBox()])
  expect(rr!.y + rr!.height).toBeLessThanOrEqual(rf!.y + rf!.height + 1)
  expect(rr!.y).toBeGreaterThanOrEqual(rc!.y + rc!.height - 1)

  // (c) filas pintadas.
  cifras.trPintados = await trs(page)
  expect(await trs(page)).toBeLessThan(200)
  cifras.altos = await page.locator('tbody tr[data-estado]').evaluateAll((l) => [...new Set(l.map((x) => (x as HTMLElement).offsetHeight))])
  expect((cifras.altos as number[]).length).toBe(1)

  // (b) arriba / medio / abajo sin huecos en blanco: la ventana de pantalla esta cubierta por filas.
  const sinHuecos = async (etiqueta: string) => {
    await page.waitForTimeout(150)
    const r = await page.evaluate(() => {
      const c = document.querySelector('[role="region"][aria-label="Tabla de pedidos"]')!
      const cr = c.getBoundingClientRect()
      const cab = c.querySelector('thead')!.getBoundingClientRect().height
      const filas = [...c.querySelectorAll('tbody tr[data-estado]')].map((t) => t.getBoundingClientRect())
      const arriba = Math.min(...filas.map((f) => f.top)), abajo = Math.max(...filas.map((f) => f.bottom))
      return { cubreArriba: arriba <= cr.top + cab + 1, cubreAbajo: abajo >= cr.bottom - 20, n: filas.length }
    })
    expect(r.cubreArriba, `${etiqueta}: hueco arriba`).toBe(true)
    expect(r.cubreAbajo, `${etiqueta}: hueco abajo`).toBe(true)
  }
  for (const [nombre, frac] of [['arriba', 0], ['medio', 0.5], ['abajo', 1], ['medio2', 0.37]] as const) {
    await region(page).evaluate((c, f) => { c.scrollTop = f * (c.scrollHeight - c.clientHeight) }, frac)
    await sinHuecos(nombre)
  }
  await region(page).hover()
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -2500)
  await sinHuecos('rueda')

  await region(page).evaluate((c) => { c.scrollTop = c.scrollHeight })
  await expect(ultima).toBeVisible()

  // (d) celda de IMEI abierta, teclear, scroll lejos y volver: el texto sigue.
  await region(page).evaluate((c) => { c.scrollTop = c.scrollHeight * 0.5 })
  await page.waitForTimeout(150)
  await page.locator('tbody tr[data-estado="PENDIENTE"] td[data-imei] button').first().click()
  const campo = page.getByRole('textbox', { name: 'IMEI' })
  await campo.fill('35000')
  const antes = await geom(page)
  await region(page).evaluate((c) => { c.scrollTop += 5000 })
  await page.waitForTimeout(200)
  cifras.trConAbiertaLejos = await trs(page)
  await region(page).evaluate((c) => { c.scrollTop -= 5000 })
  await page.waitForTimeout(200)
  await expect(page.getByRole('textbox', { name: 'IMEI' })).toHaveValue('35000')
  cifras.scrollAntesDespues = [antes.top, (await geom(page)).top]

  // (e) Control+F: con el desplegable abierto no se intercepta; cerrado, enfoca el buscador.
  const prevenido = () => page.evaluate(() => new Promise<boolean>((r) => {
    const h = (ev: KeyboardEvent) => { window.removeEventListener('keydown', h); setTimeout(() => r(ev.defaultPrevented), 0) }
    window.addEventListener('keydown', h)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }))
  }))
  cifras.ctrlFConDesplegablePrevenido = await prevenido()
  expect(cifras.ctrlFConDesplegablePrevenido).toBe(false)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: 'IMEI' })).toHaveCount(0)
  await page.keyboard.press('Control+f')
  await expect(page.getByLabel('Buscar en todo el historial')).toBeFocused()
  cifras.ctrlFSinDesplegable = 'enfoca el buscador'
  await region(page).evaluate((c) => { c.scrollTop = c.scrollHeight })

  // (g) escribir en el buscador y marcar/quitar un filtro.
  const buscador = page.getByLabel('Buscar en todo el historial')
  await buscador.focus()
  const teclas: number[] = []
  for (const ch of 'abcd') teclas.push(await medir(page, () => page.keyboard.press(ch), async () => {}))
  cifras.tecleoBuscadorMs = teclas
  await buscador.fill('')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Filtrar Plataforma' }).click()
  cifras.marcarFiltroMs = await medir(page, () => page.getByRole('checkbox', { name: /^AMZ/ }).click(), () => expect(page.getByText(`${N / 2} a la vista`)).toBeVisible())
  cifras.quitarFiltroMs = await medir(page, () => page.getByRole('checkbox', { name: /^AMZ/ }).click(), () => expect(page.getByText(/a la vista/)).toHaveCount(0))
  await page.keyboard.press('Escape')

  // (f) cruzar el umbral con un filtro en los dos sentidos; la fila elegida sobrevive.
  await region(page).evaluate((c) => { c.scrollTop = c.scrollHeight })
  await page.getByRole('button', { name: pedido(N - 5), exact: true }).click()
  await expect(page.getByRole('button', { name: pedido(N - 5), exact: true })).toHaveAttribute('aria-pressed', 'true')
  cifras.aNormalMs = await medir(page, () => contador(page, `${SIN_IMEI} sin IMEI`).click(), () => expect(page.getByText(NOTA)).toHaveCount(0))
  cifras.trEnNormal = await trs(page)
  expect(await trs(page)).toBe(SIN_IMEI)
  g = await geom(page)
  cifras.normalAlFinal = g.sh - g.top - g.h
  expect(Math.abs(g.sh - g.top - g.h)).toBeLessThanOrEqual(2)
  cifras.aVentanaMs = await medir(page, () => contador(page, `${N} filas`).click(), () => expect(page.getByText(NOTA)).toBeVisible())
  await page.waitForTimeout(400)
  g = await geom(page)
  cifras.ventanaAlFinalTrasVolver = g.sh - g.top - g.h
  expect(Math.abs(g.sh - g.top - g.h)).toBeLessThanOrEqual(2)
  await expect(page.getByRole('button', { name: pedido(N - 5), exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await trs(page)).toBeLessThan(200)

  // Mismo cruce estando a mitad de la tabla: no salta a un sitio al azar.
  await region(page).evaluate((c) => { c.scrollTop = c.scrollHeight * 0.4 })
  await page.waitForTimeout(200)
  const mitad = (await geom(page)).top
  await contador(page, `${SIN_IMEI} sin IMEI`).click()
  await contador(page, `${N} filas`).click()
  await page.waitForTimeout(300)
  cifras.mitadAntesDespues = [mitad, (await geom(page)).top]

  cifras.apiNoSimulada = [...new Set(desconocidas)]
  cifras.erroresPagina = errores
  console.log('CIFRAS ' + JSON.stringify(cifras))
  expect(errores).toEqual([])
})
