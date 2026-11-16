import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// pedidos-marcas.spec.ts (0.9.35): lo que la hoja de Pedidos hace con un lector de códigos que se equivoca (cifra suelta, cifra de control), las marcas
// de la fila (En espera de stock, Cancelado, filtro «Con marca», historial) y las filas de Amazon sin asociar con la píldora de los libros.
// Solo contra PREPRODUCCIÓN (se niega a seguir sin el letrero). Preprod tiene datos reales, así que la prueba:
//   - elige al empezar, por la API, tres filas PENDIENTES de ShippyPro sin IMEI y sin marca (no Amazon, consecutivas entre las que el lector
//     saltaría), y apunta sus ids y su estado inicial;
//   - al terminar (`afterAll`, también si una comprobación falla a mitad) las deja como estaban por la API: quita el IMEI con
//     `PUT /imei {imei:null, imeiAnterior}` y la marca con `PUT /marca {marca:null, marcaAnterior}`, con su Idempotency-Key, y comprueba
//     que responde 2xx y que la fila vuelve a no tener IMEI ni marca (los apuntes del historial no se pueden borrar).
// Los IMEI son sintéticos (0099…, con cifra de control válida): saldrán en naranja «no está en NSYS», que es lo esperado.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

type Fila = { idFila: number; canal: string | null; pedido: string | null; imei: string | null; marca: string | null; marcaNota: string | null; estado: string; editable: boolean }
type Elegida = { id: number; pedido: string; orden: number }

/** IMEI sintético con la cifra de control de Luhn buena y un prefijo que no existe en la realidad (0099). Calculado aquí, sin el código de producción. */
function imeiSintetico(): string {
  const base = '0099' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0')
  let suma = 0
  for (let i = 0; i < base.length; i++) {
    let d = Number(base[base.length - 1 - i])
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return base + String((10 - (suma % 10)) % 10)
}
/** El mismo IMEI con la última cifra cambiada: la cifra de control no cuadra. */
const conLuhnMalo = (imei: string) => imei.slice(0, 14) + String((Number(imei[14]) + 1) % 10)
const escapar = (c: string) => c.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&')
const clave = () => `e2e-marcas-${Date.now()}-${Math.random().toString(36).slice(2)}`

test.describe.configure({ mode: 'serial' })

let contexto: BrowserContext
let page: Page
let token = ''
let rutaFilas = ''
let filas: Locator
// P (prev, tambien para los errores de lectura) → M (marcada, el lector la salta) → N (next, que tambien es la que se cancela).
let P: Elegida, M: Elegida, N: Elegida, C: Elegida
let imeiTest1 = ''
let tocadas: Elegida[] = []

async function api(metodo: 'GET' | 'PUT', ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown }> {
  return page.evaluate(async ([m, r, c, t, k]) => {
    const cab: Record<string, string> = { Authorization: `Bearer ${t}` }
    if (c) { cab['Content-Type'] = 'application/json'; cab['Idempotency-Key'] = k as string }
    const res = await fetch(r as string, { method: m as string, headers: cab, body: (c as string | undefined) ?? undefined })
    return { status: res.status, json: await res.json().catch(() => null) }
  }, [metodo, ruta, cuerpo === undefined ? undefined : JSON.stringify(cuerpo), token, clave()] as const)
}
async function filaPorApi(id: number): Promise<Fila> {
  const r = await api('GET', rutaFilas)
  const f = ((r.json as { filas: Fila[] }).filas).find((x) => x.idFila === id)
  expect(f, `la fila ${id} sigue en la lista`).toBeTruthy()
  return f as Fila
}
const celdaDe = (e: Elegida) => filas.filter({ has: page.locator('td:nth-child(5)', { hasText: new RegExp('^\\s*' + escapar(e.pedido) + '\\s*$') }) }).nth(e.orden)
const celdaImei = (e: Elegida) => celdaDe(e).getByRole('cell').nth(3)
const celdaEnvio = (e: Elegida) => celdaDe(e).getByRole('cell').nth(5)
const desplegable = () => page.getByRole('dialog', { name: 'Poner el IMEI' })
const pendientes = async () => Number(/^(\d+)/.exec(((await page.getByRole('group', { name: 'Contadores' }).getByRole('button', { name: /pendientes$/ }).textContent()) ?? '').trim())?.[1])

async function abrirCelda(e: Elegida) {
  await celdaImei(e).getByRole('button').click()
  await expect(desplegable()).toBeVisible()
}
async function cerrarDesplegable() {
  if (await desplegable().isVisible()) await page.keyboard.press('Escape')
  await expect(desplegable()).toBeHidden()
}
/** Pone una marca desde el desplegable de la celda del IMEI (sin tocar el campo del IMEI). */
async function ponerMarca(e: Elegida, marca: string, nota?: string) {
  await abrirCelda(e)
  await desplegable().getByRole('combobox', { name: 'Marca' }).selectOption(marca)
  if (nota) await desplegable().getByRole('textbox', { name: 'Nota de la marca' }).fill(nota)
  await desplegable().getByRole('button', { name: 'Guardar marca' }).click()
  await expect(desplegable()).toBeHidden()
}
async function quitarMarca(e: Elegida) {
  await abrirCelda(e)
  await desplegable().getByRole('button', { name: 'Quitar la marca' }).click()
  await expect(desplegable()).toBeHidden()
}
async function sinFiltros() {
  const quitar = page.getByRole('button', { name: 'Quitar filtros', exact: true })
  if (await quitar.isVisible()) await quitar.click()
  await expect(quitar).toBeHidden()
}

test.beforeAll(async ({ browser }, info) => {
  test.setTimeout(120_000)
  const { usuario, clave: pass } = credenciales('E2E_USER', 'E2E_PASS')
  const base = info.project.use.baseURL as string
  contexto = await browser.newContext({
    baseURL: base,
    storageState: { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [{ name: 'panelCarga', value: JSON.stringify({ estado: 'cerrado' }) }] }] },
    viewport: { width: 1600, height: 900 },
  })
  page = await contexto.newPage()
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(pass)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
  token = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }).token ?? '')
  expect(token, 'hay sesión').not.toBe('')

  // La lista exacta que enseña la hoja (la misma petición y el mismo orden), para elegir las filas por la API.
  const respuesta = page.waitForResponse((r) => /\/api\/pedidos\/filas\?/.test(r.url()) && r.request().method() === 'GET')
  await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Pedidos', exact: true }).click()
  const r = await respuesta
  const url = new URL(r.url())
  rutaFilas = url.pathname + url.search
  const lista = ((await r.json()) as { filas: Fila[] }).filas
  filas = page.getByRole('region', { name: 'Tabla de pedidos' }).locator('tbody tr')
  await expect(filas.first()).toBeVisible()

  // Candidatas: pendientes, editables, sin IMEI ni marca, de una web o ShippyPro que no sea Amazon, con pedido. El lector salta a la
  // siguiente fila «saltable» (lo mismo sin IMEI ni marca), así que se buscan tres seguidas entre las saltables, las más recientes primero.
  const saltable = (f: Fila) => f.editable && f.estado === 'PENDIENTE' && !f.imei && !f.marca
  const saltables = lista.filter(saltable)
  const noAmazon = (f: Fila) => !!f.pedido && !(f.canal ?? '').startsWith('AMAZON')
  let corrida: Fila[] | null = null
  for (let i = saltables.length - 3; i >= 0; i--) {
    const t = saltables.slice(i, i + 3)
    if (t.every(noAmazon)) { corrida = t; break }
  }
  test.skip(!corrida, 'no hay tres filas pendientes seguidas sin IMEI ni marca fuera de Amazon: no se puede probar')
  const elegidas = (corrida as Fila[]).map((f): Elegida => ({ id: f.idFila, pedido: f.pedido as string, orden: lista.filter((x) => x.pedido === f.pedido).findIndex((x) => x.idFila === f.idFila) }))
  ;[P, M, N] = elegidas
  C = N
  tocadas = elegidas
  // `orden` se cuenta entre las filas de la lista con ese mismo texto de pedido (las de Amazon sin asociar no lo enseñan, pero no son estas).
  console.log(`filas de la prueba: ${elegidas.map((e) => e.id).join(', ')}`)
})

test.afterAll(async () => {
  test.setTimeout(120_000)
  if (!page || !token) return
  const fallos: string[] = []
  for (const e of tocadas) {
    try {
      let f = await filaPorApi(e.id)
      if (f.imei) {
        const r = await api('PUT', `/api/pedidos/filas/${e.id}/imei`, { imei: null, imeiAnterior: f.imei })
        if (r.status >= 300) fallos.push(`fila ${e.id}: no se pudo quitar el IMEI (HTTP ${r.status})`)
        f = await filaPorApi(e.id)
      }
      if (f.marca) {
        const r = await api('PUT', `/api/pedidos/filas/${e.id}/marca`, { marca: null, nota: null, marcaAnterior: f.marca })
        if (r.status >= 300) fallos.push(`fila ${e.id}: no se pudo quitar la marca (HTTP ${r.status})`)
        f = await filaPorApi(e.id)
      }
      if (f.imei || f.marca) fallos.push(`fila ${e.id}: quedó con imei=${f.imei} marca=${f.marca}`)
    } catch (err) { fallos.push(`fila ${e.id}: ${String(err)}`) }
  }
  await contexto?.close()
  if (fallos.length) throw new Error(`HAY QUE LIMPIAR A MANO: ${fallos.join(' | ')}`)
})

test('1. una cifra suelta delante del IMEI da «Hay más de 15 cifras», no se guarda, y una lectura nueva la sustituye', async () => {
  test.setTimeout(90_000)
  const imei = imeiSintetico()
  await abrirCelda(P)
  await page.keyboard.type('5' + imei + '\n', { delay: 0 })
  await expect(desplegable().getByRole('alert')).toContainText('Hay más de 15 cifras')
  await page.waitForTimeout(1_000)
  expect((await filaPorApi(P.id)).imei, 'con la cifra suelta no se guarda').toBeNull()
  // Una lectura nueva tras una pausa (>= 400 ms) sustituye a la mala y se guarda.
  await page.waitForTimeout(400)
  await page.keyboard.type(imei + '\n', { delay: 0 })
  await expect.poll(async () => (await filaPorApi(P.id)).imei, { timeout: 15_000 }).toBe(imei)
  imeiTest1 = imei
  await expect(celdaImei(P)).toContainText(imei)
  await cerrarDesplegable()
})

test('2. con la cifra de control mala no se guarda, Enter no fuerza y sale «Guardar igualmente» (sin pulsarlo)', async () => {
  test.setTimeout(90_000)
  // En P, que ya tiene el IMEI de la prueba 1: esta prueba no puede cambiarlo.
  const malo = conLuhnMalo(imeiSintetico())
  await abrirCelda(P)
  await page.keyboard.type(malo + '\n', { delay: 0 })
  await expect(desplegable().getByRole('alert')).toContainText('La cifra de control no cuadra')
  await page.waitForTimeout(800)
  await page.keyboard.press('Enter')
  await expect(desplegable().getByRole('alert')).toContainText('La cifra de control no cuadra')
  await expect(desplegable().getByRole('button', { name: 'Guardar igualmente' })).toBeVisible()
  await page.waitForTimeout(800)
  expect((await filaPorApi(P.id)).imei, 'Enter no fuerza el IMEI con la cifra de control mala').toBe(imeiTest1)
  await cerrarDesplegable()
  expect((await filaPorApi(P.id)).imei).toBe(imeiTest1)
})

test('3. «En espera de stock» con nota: se ve en la celda, el lector la salta y al poner el IMEI la marca se quita sola', async () => {
  test.setTimeout(120_000)
  const nota = 'prueba E2E ' + Date.now()
  await ponerMarca(M, 'ESPERA_STOCK', nota)
  await expect(celdaImei(M).locator('[data-marca="ESPERA_STOCK"]')).toHaveText('En espera de stock')
  await expect(celdaImei(M).getByRole('button')).toHaveAttribute('title', new RegExp(`En espera de stock — ${escapar(nota)}`))
  const f = await filaPorApi(M.id)
  expect(f.marca).toBe('ESPERA_STOCK')
  expect(f.marcaNota).toBe(nota)

  // El lector escribe en P (la fila anterior): el salto se salta a M y abre N.
  const imeiP = imeiSintetico()
  await abrirCelda(P)
  await page.keyboard.type(imeiP + '\n', { delay: 0 })
  await expect.poll(async () => (await filaPorApi(P.id)).imei, { timeout: 15_000 }).toBe(imeiP)
  await expect(celdaImei(N).getByRole('button')).toHaveAttribute('data-state', 'open')
  await expect(celdaImei(M).getByRole('button')).toHaveAttribute('data-state', 'closed')
  await cerrarDesplegable()

  // Al poner un IMEI en M, la marca se quita sola.
  const imeiM = imeiSintetico()
  await abrirCelda(M)
  await page.keyboard.type(imeiM + '\n', { delay: 0 })
  await expect.poll(async () => (await filaPorApi(M.id)).imei, { timeout: 15_000 }).toBe(imeiM)
  expect((await filaPorApi(M.id)).marca, 'al poner el IMEI la marca se quita sola').toBeNull()
  await expect(celdaImei(M).locator('[data-marca]')).toHaveCount(0)
  await cerrarDesplegable()
})

test('4. «Cancelado»: la celda de envío lo dice, «N pendientes» baja en uno, y al quitarla vuelve', async () => {
  test.setTimeout(120_000)
  const antes = await pendientes()
  expect(antes).toBeGreaterThan(0)
  await ponerMarca(C, 'CANCELADO')
  await expect(celdaEnvio(C)).toContainText('Cancelado')
  await expect.poll(pendientes).toBe(antes - 1)
  expect((await filaPorApi(C.id)).marca).toBe('CANCELADO')
  await quitarMarca(C)
  await expect(celdaEnvio(C)).toContainText('Pendiente')
  await expect.poll(pendientes).toBe(antes)
  expect((await filaPorApi(C.id)).marca).toBeNull()
})

test('5. el filtro «Con marca» deja solo las filas marcadas', async () => {
  test.setTimeout(120_000)
  await ponerMarca(C, 'EN_REVISION', 'prueba E2E filtro')
  await page.getByRole('button', { name: /^Filtrar IMEI/ }).click()
  const grupo = page.getByRole('group', { name: 'Con marca' })
  await grupo.getByRole('checkbox', { name: /^En revisión/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Quitar filtro Con marca: En revisión' })).toBeVisible()
  const n = await filas.count()
  expect(n, 'sale al menos la fila marcada').toBeGreaterThan(0)
  await expect(filas.locator('[data-marca]')).toHaveCount(n)
  await expect(filas.locator('[data-marca]:not([data-marca="EN_REVISION"])')).toHaveCount(0)
  // Con el filtro puesto el orden entre las filas del mismo pedido cambia: se busca por el pedido y la marca.
  await expect(filas.filter({ has: page.locator('td:nth-child(5)', { hasText: new RegExp('^\\s*' + escapar(C.pedido) + '\\s*$') }) }).first()).toBeVisible()
  await sinFiltros()
  expect(await filas.count(), 'sin el filtro vuelven las demás filas').toBeGreaterThan(n)
  await quitarMarca(C)
  expect((await filaPorApi(C.id)).marca).toBeNull()
})

test('6. el panel de una fila tocada enseña en el Historial los apuntes de la prueba', async () => {
  test.setTimeout(90_000)
  // M: marca puesta, IMEI puesto y marca quitada sola. P: su IMEI.
  const imeiP = (await filaPorApi(P.id)).imei as string
  await celdaDe(M).getByRole('cell').nth(4).click()
  const panel = page.getByRole('region', { name: 'Detalle del pedido' })
  await expect(panel).toBeVisible()
  const historial = panel.getByRole('list', { name: 'Historial de la fila' })
  await expect(historial).toContainText('Marca: En espera de stock')
  await expect(historial).toContainText('Marca quitada')
  await expect(historial).toContainText('puso ' + ((await filaPorApi(M.id)).imei as string))
  await panel.getByRole('button', { name: 'Cerrar' }).click()
  await expect(panel).toBeHidden()
  await celdaDe(P).getByRole('cell').nth(4).click()
  await expect(panel.getByRole('list', { name: 'Historial de la fila' })).toContainText(imeiP)
  await panel.getByRole('button', { name: 'Cerrar' }).click()
  await expect(panel).toBeHidden()
})

test('7. Amazon: filas «sin asociar» y la píldora de los libros con su lista «para revisar»', async () => {
  test.setTimeout(90_000)
  await sinFiltros()
  await page.getByRole('button', { name: /^Filtrar Plataforma/ }).click()
  await page.getByRole('checkbox', { name: /^AMZ/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Quitar filtro Plataforma: AMZ' })).toBeVisible()
  await expect(filas.filter({ has: page.locator('td:nth-child(5)', { hasText: /^\s*sin asociar\s*$/ }) }).first(), 'alguna fila de AMZ dice «sin asociar»').toBeVisible()
  await sinFiltros()

  const pildora = page.getByRole('button', { name: /^(Asociación Amazon:|Libros de Amazon:)/ })
  await expect(pildora).toBeVisible()
  const texto = (await pildora.textContent()) ?? ''
  await pildora.click()
  const lista = page.getByRole('dialog', { name: 'Asociación de Amazon' })
  await expect(lista).toBeVisible()
  await expect(lista.getByRole('heading', { name: 'Asociación de Amazon' })).toBeVisible()
  const paraRevisar = /(\d+) para revisar/.exec(texto)
  if (paraRevisar && Number(paraRevisar[1]) > 0) await expect(lista.getByRole('list', { name: /^Para revisar:/ }).first()).toBeVisible()
  else await expect(lista).toContainText(/Nada para revisar|con errores|No se pudo leer/)
  await page.keyboard.press('Escape')
  await expect(lista).toBeHidden()
})
