import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// pedidos-salida.spec.ts (0.9.37, spec 2026-11-18 «buscar y salida»): la fecha de salida en «Enviado», el contador «salen hoy», los tres
// Excel de «Descargar para buscar» y el IMEI duplicado, contra la base real de PREPRODUCCIÓN (lo que los tests unitarios solo vieron por el
// texto del SQL). Solo contra PREPRODUCCIÓN (se niega a seguir sin el letrero). No crea filas: usa las que hay.
//   - Lo que escribe: poner en una fila pendiente sin IMEI ni marca el IMEI de una fila ENVIADA (o del histórico, o de una viva cancelada),
//     que el servidor debe aceptar; `afterAll` lo quita con `PUT /imei {imei:null, imeiAnterior}` y comprueba que la fila queda sin IMEI.
//   - Los intentos que deben dar 409 no escriben nada (se comprueba que la fila sigue sin IMEI).
//   - Los tres Excel y lo que debería salir en ellos (calculado aquí desde /api/pedidos/filas) se guardan en E2E_SALIDA_DIR (por defecto
//     test-results/pedidos-salida) para compararlos fuera con openpyxl.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const DIR = process.env.E2E_SALIDA_DIR ?? join('test-results', 'pedidos-salida')

type Fila = {
  idFila: number; canal: string | null; pedido: string | null; imei: string | null; marca: string | null; estado: string; editable: boolean
  fechaSalida: string | null; pais: string | null; sku: string | null; faltaEnviarEn: string | null; origen?: string
}

test.describe.configure({ mode: 'serial' })

let contexto: BrowserContext
let page: Page
let token = ''
let rutaFilas = ''
let lista: Fila[] = []
let filas: Locator
let hoy = ''
let destino: Fila | null = null // fila pendiente sin IMEI ni marca donde se prueban los IMEI ajenos
let tocada = false

const clave = () => `e2e-salida-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
async function excel(plataforma: string): Promise<Buffer> {
  const b64 = await page.evaluate(async ([p, t]) => {
    const res = await fetch(`/api/pedidos/buscar?plataforma=${p}`, { headers: { Authorization: `Bearer ${t}` } })
    if (!res.ok) return `ERROR ${res.status}`
    const bytes = new Uint8Array(await res.arrayBuffer())
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
  }, [plataforma, token] as const)
  expect(b64.startsWith('ERROR'), `el Excel de ${plataforma} se descarga (${b64.slice(0, 12)})`).toBe(false)
  return Buffer.from(b64, 'base64')
}
/** Pendiente (o «falta por enviar»), sin IMEI y sin «Cancelado»: lo que cuenta el Excel. */
const cuentaEnExcel = (f: Fila) => !f.imei && f.marca !== 'CANCELADO' && (f.estado === 'PENDIENTE' || (f.estado === 'ENVIADA' && !!f.faltaEnviarEn))
const CANALES: Record<string, string[]> = { AMZ: ['AMAZON'], FNSK: ['AMAZON_STOCKROOM'], WEBS: ['DISTRIBUIDORES', 'PARTICULARES', 'BACKIPHONE'] }

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
  const respuesta = page.waitForResponse((r) => /\/api\/pedidos\/filas\?/.test(r.url()) && r.request().method() === 'GET')
  await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Pedidos', exact: true }).click()
  const r = await respuesta
  const url = new URL(r.url())
  rutaFilas = url.pathname + url.search
  lista = ((await r.json()) as { filas: Fila[] }).filas
  filas = page.getByRole('region', { name: 'Tabla de pedidos' }).locator('tbody tr')
  await expect(filas.first()).toBeVisible()
  hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const candidatas = lista.filter((f) => f.editable && f.estado === 'PENDIENTE' && !f.imei && !f.marca && !!f.pedido)
  destino = candidatas[candidatas.length - 1] ?? null
  console.log(`hoy ${hoy} · filas ${lista.length} · fila destino ${destino?.idFila ?? 'ninguna'}`)
})

test.afterAll(async () => {
  test.setTimeout(60_000)
  if (!page || !token) return
  const fallos: string[] = []
  if (destino && tocada) {
    try {
      const f = await filaPorApi(destino.idFila)
      if (f.imei) {
        const r = await api('PUT', `/api/pedidos/filas/${destino.idFila}/imei`, { imei: null, imeiAnterior: f.imei })
        if (r.status >= 300) fallos.push(`fila ${destino.idFila}: no se pudo quitar el IMEI (HTTP ${r.status})`)
      }
      if ((await filaPorApi(destino.idFila)).imei) fallos.push(`fila ${destino.idFila}: quedó con IMEI`)
    } catch (err) { fallos.push(String(err)) }
  }
  await contexto?.close()
  if (fallos.length) throw new Error(`HAY QUE LIMPIAR A MANO: ${fallos.join(' | ')}`)
})

test('1. todas las pendientes tienen fecha de salida y el contador «salen hoy» cuadra con ellas', async () => {
  const vivas = lista.filter((f) => f.estado === 'PENDIENTE' && f.marca !== 'CANCELADO')
  const sinFecha = vivas.filter((f) => !f.fechaSalida)
  console.log(`pendientes ${vivas.length} · sin fecha ${sinFecha.length} · sin país ${vivas.filter((f) => !f.pais).length}`)
  expect(sinFecha.map((f) => f.idFila), 'pendientes de ShippyPro sin fecha de salida').toEqual([])
  const deHoy = lista.filter((f) => (f.estado === 'PENDIENTE' || (f.estado === 'ENVIADA' && !!f.faltaEnviarEn)) && f.marca !== 'CANCELADO' && f.fechaSalida === hoy).length
  const boton = page.getByRole('group', { name: 'Contadores' }).getByRole('button', { name: /salen hoy$/ })
  await expect(boton).toHaveText(`${deHoy} salen hoy`)
})

test('2. la columna Enviado enseña «Sale hoy» en una pendiente de hoy y la fecha en una posterior', async () => {
  const unaDeHoy = lista.find((f) => f.estado === 'PENDIENTE' && f.marca == null && f.fechaSalida === hoy)
  // Una de web (su número de pedido se ve siempre; en Amazon puede salir «sin asociar»), para buscarla por el pedido.
  const posterior = lista.find((f) => f.estado === 'PENDIENTE' && f.marca == null && !!f.fechaSalida && f.fechaSalida > hoy && !(f.canal ?? '').startsWith('AMAZON') && !!f.pedido)
  test.skip(!unaDeHoy && !posterior, 'no hay pendientes con fecha para mirar')
  const boton = page.getByRole('group', { name: 'Contadores' }).getByRole('button', { name: /salen hoy$/ })
  if (unaDeHoy) {
    await boton.click()
    await expect(filas.first()).toContainText('Sale hoy')
    await page.getByRole('button', { name: 'Quitar filtro Sale hoy' }).click()
    await expect(boton).toHaveAttribute('aria-pressed', 'false')
  }
  if (posterior) {
    const buscador = page.getByPlaceholder(/Buscar en todo el historial/)
    await buscador.fill(posterior.pedido as string)
    const fila = filas.filter({ hasText: posterior.pedido as string }).first()
    await expect(fila).toContainText(/Sale (mañana|[a-zé]{3} \d\d\/\d\d)/)
    console.log(`fila ${posterior.idFila} (${posterior.fechaSalida}): ${(await fila.innerText()).replace(/\s+/g, ' ').slice(0, 160)}`)
    await buscador.fill('')
  }
})

test('3. el botón «Descargar para buscar» ofrece AMZ, FNSK y Webs, y los tres Excel bajan (se guardan con lo esperado)', async () => {
  await page.getByRole('button', { name: 'Descargar para buscar' }).click()
  const menu = page.getByRole('dialog', { name: 'Plataforma que buscar' })
  await expect(menu).toBeVisible()
  for (const t of ['AMZ', 'FNSK', 'Webs']) await expect(menu.getByRole('button', { name: t, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  mkdirSync(DIR, { recursive: true })
  const esperado: Record<string, { sku: string | null; pais: string | null; fechaSalida: string | null }[]> = {}
  for (const p of Object.keys(CANALES)) {
    writeFileSync(join(DIR, `Buscar ${p}.xlsx`), await excel(p))
    esperado[p] = lista.filter((f) => f.canal != null && CANALES[p].includes(f.canal) && cuentaEnExcel(f)).map((f) => ({ sku: f.sku, pais: f.pais, fechaSalida: f.fechaSalida }))
  }
  writeFileSync(join(DIR, 'esperado.json'), JSON.stringify({ hoy, esperado }, null, 2))
  console.log(`Excel y esperado en ${DIR}: ${Object.entries(esperado).map(([p, v]) => `${p} ${v.length}`).join(' · ')}`)
})

test('4. un IMEI que ya está en otra fila pendiente da 409 «Este IMEI ya está…» y no se guarda (en la pantalla y por la API)', async () => {
  test.skip(!destino, 'no hay fila pendiente sin IMEI ni marca')
  const otra = lista.find((f) => f.estado === 'PENDIENTE' && !!f.imei && /^\d{15}$/.test(f.imei) && f.marca !== 'CANCELADO' && f.idFila !== destino!.idFila)
  test.skip(!otra, 'no hay otra fila pendiente con IMEI')
  const r = await api('PUT', `/api/pedidos/filas/${destino!.idFila}/imei`, { imei: otra!.imei, imeiAnterior: '' })
  expect(r.status).toBe(409)
  expect(JSON.stringify(r.json)).toContain('Este IMEI ya está')
  console.log(`409: ${JSON.stringify(r.json).slice(0, 160)}`)
  expect((await filaPorApi(destino!.idFila)).imei).toBeNull()
})

test('5. el IMEI de una fila con «falta por enviar» también da 409', async () => {
  test.skip(!destino, 'no hay fila destino')
  const falta = lista.find((f) => f.estado === 'ENVIADA' && !!f.faltaEnviarEn && !!f.imei && /^\d{15}$/.test(f.imei))
  test.skip(!falta, 'no hay filas con «falta por enviar» e IMEI en la lista')
  const r = await api('PUT', `/api/pedidos/filas/${destino!.idFila}/imei`, { imei: falta!.imei, imeiAnterior: '' })
  expect(r.status).toBe(409)
  expect((await filaPorApi(destino!.idFila)).imei).toBeNull()
})

test('6. el IMEI de una fila ya enviada (sin falta) SÍ se pone (un móvil devuelto se vuelve a vender) y se quita después', async () => {
  test.skip(!destino, 'no hay fila destino')
  const ocupados = new Set(lista.filter((f) => f.imei && (f.estado === 'PENDIENTE' || (f.estado === 'ENVIADA' && f.faltaEnviarEn)) && f.marca !== 'CANCELADO').map((f) => f.imei))
  const enviada = lista.find((f) => f.estado === 'ENVIADA' && !f.faltaEnviarEn && !!f.imei && /^\d{15}$/.test(f.imei) && !ocupados.has(f.imei))
  test.skip(!enviada, 'no hay una enviada con un IMEI libre')
  const r = await api('PUT', `/api/pedidos/filas/${destino!.idFila}/imei`, { imei: enviada!.imei, imeiAnterior: '' })
  tocada = true
  expect(r.status, JSON.stringify(r.json)).toBe(200)
  expect((await filaPorApi(destino!.idFila)).imei).toBe(enviada!.imei)
  const q = await api('PUT', `/api/pedidos/filas/${destino!.idFila}/imei`, { imei: null, imeiAnterior: enviada!.imei })
  expect(q.status).toBe(200)
  expect((await filaPorApi(destino!.idFila)).imei).toBeNull()
})

test('7. el IMEI de una fila pendiente CANCELADA no bloquea (se pone y se quita)', async () => {
  test.skip(!destino, 'no hay fila destino')
  const ocupados = new Set(lista.filter((f) => f.imei && f.marca !== 'CANCELADO' && (f.estado === 'PENDIENTE' || (f.estado === 'ENVIADA' && f.faltaEnviarEn))).map((f) => f.imei))
  const cancelada = lista.find((f) => f.estado === 'PENDIENTE' && f.marca === 'CANCELADO' && !!f.imei && /^\d{15}$/.test(f.imei) && !ocupados.has(f.imei))
  test.skip(!cancelada, 'no hay una pendiente cancelada con IMEI')
  const r = await api('PUT', `/api/pedidos/filas/${destino!.idFila}/imei`, { imei: cancelada!.imei, imeiAnterior: '' })
  tocada = true
  expect(r.status, JSON.stringify(r.json)).toBe(200)
  const q = await api('PUT', `/api/pedidos/filas/${destino!.idFila}/imei`, { imei: null, imeiAnterior: cancelada!.imei })
  expect(q.status).toBe(200)
  expect((await filaPorApi(destino!.idFila)).imei).toBeNull()
})
