import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Maqueta de Pedidos en Chromium real (la hoja, el panel de la fila y el dialogo de la etiqueta), con la API falsa por `page.route`.
// Solo local: `npx playwright test -c playwright.local.config.ts pedidos-layout`. Datos inventados; no toca ningun servidor.
// Las capturas van a la carpeta de la variable CAPTURAS (fuera del repo); sin ella, no se hacen.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`
const NOMBRE_LARGO = 'Cliente Web A con un nombre larguisimo que no cabe en ninguna columna ni en el panel de ningun modo posible SL'
const SEGUIMIENTO_LARGO = 'TRK00000000000000000000000000000000000000000000000012345'

function filas(n: number) {
  const lista = Array.from({ length: n }, (_, k) => {
    const i = k + 1
    const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(k / 80) * 86_400_000).toISOString().slice(0, 10)
    return {
      idFila: i, fecha: d, plataforma: i % 2 ? 'Web' : 'Amazon', canal: i % 2 ? null : 'AMAZON', sku: 'i14128NegroA',
      imei: i % 6 === 0 ? null : `3500000${String(i).padStart(8, '0')}`, pedido: pedido(i), fechaCompra: d,
      estado: i % 6 === 0 ? 'PENDIENTE' : 'ENVIADA', editable: true, envioFecha: i % 6 === 0 ? null : `${d}T10:00:00Z`,
      impresaEn: i % 6 === 0 || i % 2 ? null : `${d}T12:00:00Z`, tieneEtiqueta: i % 6 !== 0,
      transportista: i % 6 === 0 ? null : 'Transportista A', seguimiento: i % 6 === 0 ? null : `SEG${i}`, nivel: null as string | null, motivo: null as string | null, skuMovil: null as string | null, caja: null as string | null,
    }
  })
  // Los de abajo (los ultimos, que son los que se ven al abrir): un historico con un nombre larguisimo (en la plataforma, que es el
  // texto libre de la fila) y una enviada con un seguimiento larguisimo y la etiqueta impresa.
  const h = lista[n - 2], e = lista[n - 3]
  Object.assign(h, { estado: 'HISTORICO', editable: false, plataforma: NOMBRE_LARGO, sku: 'i14128NegroAConUnSkuMuyLargoParaProbar', imei: null, envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null, seguimiento: null })
  Object.assign(e, { estado: 'ENVIADA', editable: true, imei: '350000099999999', transportista: 'UPSv2', seguimiento: SEGUIMIENTO_LARGO, envioFecha: `${e.fecha}T10:00:00Z`, impresaEn: `${e.fecha}T12:00:00Z`, tieneEtiqueta: true, motivo: 'MODELO' })
  return { lista, historica: h.idFila, larga: e.idFila }
}

// Un PDF minimo valido.
const PDF = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n')

async function preparar(page: Page, n: number, panelCarga: 'cerrado' | 'abierto' = 'cerrado') {
  const datos = filas(n)
  await page.addInitScript((estado) => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
    localStorage.setItem('panelCarga', JSON.stringify({ estado }))
  }, panelCarga)
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas: datos.lista, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [{ fuente: 'SHIPPYPRO', ultimaOk: new Date().toISOString(), ultimoIntento: new Date().toISOString(), ultimoError: null, ok: true }] })
    if (/\/api\/pedidos\/filas\/\d+\/etiqueta$/.test(ruta)) return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF })
    if (/\/api\/pedidos\/filas\/\d+\/cambios$/.test(ruta)) return route.fulfill({ json: [] })
    if (ruta === '/api/reparaciones/carga-tecnicos') return route.fulfill({ json: { pedidos: [], total: [] } })
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  return datos
}

const panel = (page: Page) => page.getByRole('region', { name: 'Detalle del pedido' })

/** Las medidas de la maqueta, todas en una pasada. */
const medidas = (page: Page) => page.evaluate(() => {
  const r = (el: Element | null) => { const b = el?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height } : null }
  const de = document.documentElement
  const tabla = document.querySelector('[role="region"][aria-label="Tabla de pedidos"]')
  const panel = document.querySelector('[aria-label="Detalle del pedido"]')
  const cerrar = panel ? [...panel.querySelectorAll('button')].find((b) => b.textContent === 'Cerrar') ?? null : null
  const fecha = [...document.querySelectorAll('thead th')].find((t) => t.textContent?.startsWith('Fecha') && !t.textContent.startsWith('Fecha compra')) ?? null
  const ayuda = document.querySelector('button[aria-label="Ayuda de Pedidos"]')
  const barra = document.querySelector('header')
  return {
    ancho: de.clientWidth, scrollW: de.scrollWidth, scrollX: window.scrollX, altoDoc: de.scrollHeight, altoVentana: de.clientHeight,
    barra: r(barra), titulo: r(document.querySelector('h1')), fecha: r(fecha), ayuda: r(ayuda), tabla: r(tabla), panel: r(panel), cerrar: r(cerrar),
    tablaScrollW: tabla ? tabla.scrollWidth : 0, tablaClientW: tabla ? tabla.clientWidth : 0,
    cols: [...document.querySelectorAll('thead th')].map((t) => { const b = t.getBoundingClientRect(); return `${t.textContent?.slice(0, 6)}:${Math.round(b.x)}-${Math.round(b.right)}` }),
  }
})

const CAPTURAS = process.env.CAPTURAS
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true })

for (const [n, nombre] of [[2_000, 'normal'], [26_700, 'ventana']] as const) {
  test(`maqueta de Pedidos sin desbordar la pagina (${nombre}, ${n} filas)`, async ({ page }) => {
    const datos = await preparar(page, n)
    const cifras: Record<string, unknown> = {}
    for (const ancho of [1280, 1366, 1600, 1920]) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await page.goto('/telefonos/pedidos')
      await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
      await expect(page.getByRole('button', { name: pedido(n), exact: true })).toBeVisible()
      await page.waitForTimeout(400)
      // Se abre y se cierra una celda de IMEI del final: la fila queda marcada («Última fila abierta», texto oculto). Ese texto
      // llego a alargar el documento tanto como la tabla; las medidas de abajo lo vigilan.
      await page.locator('[aria-label="Tabla de pedidos"] td[data-imei] button').last().click()
      await expect(page.getByRole('dialog', { name: 'Poner el IMEI' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'Poner el IMEI' })).toBeHidden()

      for (const abierto of [false, true]) {
        if (abierto) {
          // Una fila con la etiqueta, el seguimiento largo y el estado en «Enviado»: se abre pulsando fuera de la celda del IMEI.
          await page.getByRole('button', { name: pedido(datos.larga), exact: true }).click()
          await expect(panel(page)).toBeVisible()
          await page.waitForTimeout(200)
        }
        const m = await medidas(page)
        cifras[`${ancho}${abierto ? ' con panel' : ' sin panel'}`] = { scrollW: m.scrollW, ancho: m.ancho, tabla: m.tabla && Math.round(m.tabla.w), tablaScroll: `${m.tablaScrollW}/${m.tablaClientW}`, panel: m.panel && Math.round(m.panel.w), barraR: m.barra && Math.round(m.barra.r) }
        const donde = `${nombre} ${ancho} ${abierto ? 'con' : 'sin'} panel`
        expect(m.scrollW, `${donde}: la pagina desborda, sobran ${m.scrollW - m.ancho} px`).toBeLessThanOrEqual(m.ancho)
        expect(m.scrollX, donde).toBe(0)
        expect(m.altoDoc, `${donde}: la pagina se desplaza hacia abajo, sobran ${m.altoDoc - m.altoVentana} px`).toBeLessThanOrEqual(m.altoVentana + 1)
        expect(m.barra!.x, donde).toBeGreaterThanOrEqual(0)
        expect(m.barra!.r, `${donde}: la barra superior no llega al borde derecho`).toBeGreaterThanOrEqual(m.ancho - 1)
        expect(m.titulo!.x, `${donde}: titulo fuera`).toBeGreaterThanOrEqual(0)
        expect(m.fecha!.x, `${donde}: columna Fecha fuera`).toBeGreaterThanOrEqual(0)
        expect(m.fecha!.r, donde).toBeLessThanOrEqual(m.ancho)
        expect(m.ayuda!.x, donde).toBeGreaterThanOrEqual(0)
        expect(m.ayuda!.r, `${donde}: el boton de ayuda se sale`).toBeLessThanOrEqual(m.ancho)
        expect(m.tabla!.r, donde).toBeLessThanOrEqual(m.ancho)
        if (abierto) {
          expect(m.panel!.r, `${donde}: panel fuera`).toBeLessThanOrEqual(m.ancho)
          expect(m.cerrar!.x, donde).toBeGreaterThanOrEqual(m.panel!.x)
          expect(m.cerrar!.r, `${donde}: Cerrar cortado, se sale ${Math.round(m.cerrar!.r - m.ancho)} px`).toBeLessThanOrEqual(m.ancho)
          expect(m.panel!.r, `${donde}: panel solapa la tabla`).toBeLessThanOrEqual(m.ancho)
          expect(m.tabla!.r, `${donde}: la tabla pisa el panel`).toBeLessThanOrEqual(m.panel!.x + 0.5)
          expect(m.panel!.w, donde).toBeLessThanOrEqual(400.5)
          // Mismo arriba y abajo que la tabla.
          expect(Math.abs(m.panel!.y - m.tabla!.y), donde).toBeLessThanOrEqual(1)
          expect(Math.abs(m.panel!.b - m.tabla!.b), donde).toBeLessThanOrEqual(1)
          // Lo largo se parte dentro del panel.
          const sobra = await panel(page).evaluate((p) => p.scrollWidth - p.clientWidth)
          expect(sobra, `${donde}: algo se sale del panel por los lados`).toBeLessThanOrEqual(0)
          if (ancho >= 1600) expect(m.tablaScrollW, `${donde}: la tabla necesita scroll horizontal`).toBeLessThanOrEqual(m.tablaClientW)
          if (CAPTURAS && (ancho === 1366 || ancho === 1920)) await page.screenshot({ path: `${CAPTURAS}/${nombre}-${ancho}-panel.png` })
          // Cierra el panel para la vuelta siguiente.
          await panel(page).getByRole('button', { name: 'Cerrar' }).click()
          await expect(panel(page)).toHaveCount(0)
        } else if (CAPTURAS && (ancho === 1366 || ancho === 1920)) await page.screenshot({ path: `${CAPTURAS}/${nombre}-${ancho}-sin-panel.png` })
      }
    }
    console.log(`CIFRAS ${nombre} ` + JSON.stringify(cifras))
  })
}

test('la fila del historico con un nombre larguisimo y el panel no se salen', async ({ page }) => {
  const datos = await preparar(page, 2_000)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  await expect(page.getByRole('button', { name: pedido(2_000), exact: true })).toBeVisible()
  await page.getByRole('button', { name: pedido(1_999), exact: true }).click()
  await expect(panel(page)).toBeVisible()
  expect(datos.historica).toBe(1_999)
  const m = await medidas(page)
  expect(m.scrollW).toBeLessThanOrEqual(m.ancho)
  expect(await panel(page).evaluate((p) => p.scrollWidth - p.clientWidth)).toBeLessThanOrEqual(0)
})

test('en Pedidos no se pinta el panel flotante de carga (aunque este abierto) y la previsualizacion se puede cerrar', async ({ page }) => {
  const datos = await preparar(page, 2_000, 'abierto')
  for (const ancho of [1280, 1366]) {
    await page.setViewportSize({ width: ancho, height: 900 })
    await page.goto('/telefonos/pedidos')
    await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
    await expect(page.getByRole('button', { name: pedido(2_000), exact: true })).toBeVisible()
    await expect(page.getByTestId('panel-carga')).toHaveCount(0)
    // Lo recordado no se toca: sigue «abierto» para cuando se vuelva a otra pantalla.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('panelCarga') ?? 'null').estado)).toBe('abierto')
    await page.getByRole('button', { name: pedido(datos.larga), exact: true }).click()
    await page.getByRole('button', { name: 'Previsualizar etiqueta' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Previsualización de la etiqueta' })
    await expect(dialogo).toBeVisible()
    await page.waitForTimeout(300)
    const cubierto = await page.evaluate(() => {
      const d = document.querySelector('[data-slot="dialog-content"]')!
      const x = d.querySelector('[data-slot="dialog-close"]')!.getBoundingClientRect()
      const el = document.elementFromPoint(x.x + x.width / 2, x.y + x.height / 2)
      return !el || !d.contains(el)
    })
    expect(cubierto, `${ancho}: el boton de cerrar del dialogo esta tapado`).toBe(false)
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/dialogo-${ancho}.png` })
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
  }
})
