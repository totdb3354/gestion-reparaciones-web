import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'
import { leerXlsx } from './xlsx.ts'

// descartar-nsys.spec.ts (0.9.22 pieza 3, spec «descartar» §5): con un IMEI INVENTADO que NSYS no conoce (por defecto
// 350000000009923; otro con E2E_IMEI_ALTA), el supertécnico le crea por la API una asignación para que salga en «No está en NSYS»,
// lo descarta con motivo (sale de la lista y de la plantilla de altas, y está en «Ver descartados»), lo deshace, lo vuelve a
// descartar y, con un trabajo nuevo, sale otra vez con el aviso. Solo contra PREPRODUCCIÓN (se niega sin el letrero) y lo deja
// como estaba: sin asignaciones, sin teléfono y sin descarte (las líneas del registro de actividad las borra el guion de preprod).
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_ALTA ?? '350000000009923'
const MOTIVO = 'E2E 0.9.22: no es un móvil'

type Respuesta = { estado: number; cuerpo: unknown }
type Tarjetas = { altas: { imeiSn: string }[]; descartadas: { imeiSn: string; motivo: string }[] }

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Una petición a la API con el token de la sesión de la página (patrón de sku-taller-reparacion.spec.ts). */
async function pedir(page: Page, metodo: string, ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Promise<Respuesta> {
  return page.evaluate(async ({ metodo, ruta, cuerpo, cabeceras }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json', ...cabeceras },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const texto = await res.text()
    return { estado: res.status, cuerpo: texto ? (JSON.parse(texto) as unknown) : null }
  }, { metodo, ruta, cuerpo, cabeceras })
}

const tarjetasApi = async (page: Page) => (await pedir(page, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')).cuerpo as Tarjetas

/** Una asignación de reparación del propio supertécnico para el IMEI de prueba (crea el teléfono si no existe). */
async function asignar(page: Page) {
  const idTec = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
  expect(typeof idTec, 'idTec del supertécnico en la sesión').toBe('number')
  const lote = await pedir(page, 'POST', '/api/asignaciones/lote', {
    telefonos: [{ imei: IMEI, modelo: '14', idCli: null, clienteExplicito: false }],
    asignaciones: [{ imei: IMEI, categoria: 'R', idTec, comentario: MOTIVO, esChasis: false }],
  }, { 'Idempotency-Key': `e2e-descartar-${Date.now()}` })
  expect(lote.estado, 'POST /api/asignaciones/lote').toBe(200)
}

/** Fuera lo del IMEI de prueba: sus asignaciones y reparaciones (las R… antes), el teléfono y el descarte. */
async function limpiar(page: Page) {
  const r = await pedir(page, 'GET', `/api/reparaciones/imei/${IMEI}`)
  expect(r.estado, `GET /api/reparaciones/imei/${IMEI}`).toBe(200)
  const ids = (r.cuerpo as { idRep: string }[]).map((x) => x.idRep)
  for (const idRep of [...ids.filter((id) => id.startsWith('R')), ...ids.filter((id) => !id.startsWith('R'))]) {
    const b = await pedir(page, 'DELETE', `/api/reparaciones/${idRep}`, { motivo: 'E2E: limpieza' })
    expect.soft(b.estado, `limpieza DELETE /api/reparaciones/${idRep}`).toBe(204)
  }
  const t = await pedir(page, 'DELETE', `/api/telefonos/${IMEI}`)
  expect.soft([204, 404], `limpieza DELETE /api/telefonos/${IMEI}`).toContain(t.estado)
  const d = await pedir(page, 'DELETE', '/api/stock-telefonos/por-pasar/descarte', { imeiSn: IMEI })
  expect.soft(d.estado, 'limpieza del descarte').toBe(204)
}

/** Los IMEI de la columna A de la plantilla de altas (a partir de la fila 7), bajada con el token de la sesión. */
async function imeisDePlantilla(page: Page): Promise<string[]> {
  const token = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }).token)
  const plantilla = await page.request.get('/api/stock-telefonos/por-pasar/plantilla-altas', { headers: { Authorization: `Bearer ${token}` } })
  expect(plantilla.status()).toBe(200)
  const x = leerXlsx(await plantilla.body())
  return x.filasConDatos(7, 'A').map((n) => String(x.celda(`A${n}`).valor))
}

async function abrirNoEsta(page: Page) {
  await page.goto('/telefonos/stock')
  await page.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
  await page.getByRole('button', { name: 'No está en NSYS' }).click()
}

test.describe('0.9.22 pieza 3: «descartar» en «No está en NSYS»', () => {
  test.describe.configure({ mode: 'serial' })
  // Una sola sesión: el entorno limita los inicios de sesión por minuto.
  let pagina: Page
  // Solo true tras comprobar el letrero de preprod: sin eso la limpieza no corre.
  let enPreprod = false

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    enPreprod = true
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `el IMEI de prueba ${IMEI} no puede estar en NSYS`).toBe(404)
    await limpiar(pagina)
    await asignar(pagina)
  })

  test.afterAll(async () => {
    try {
      if (pagina && enPreprod) await limpiar(pagina)
    } finally {
      await pagina?.close()
    }
  })

  test('sale en «No está en NSYS» y «descartar» lo quita con su motivo, también de la plantilla', async () => {
    await abrirNoEsta(pagina)
    const tabla = pagina.getByRole('table', { name: 'No está en NSYS' })
    await expect(tabla.getByRole('row').filter({ hasText: IMEI })).toHaveCount(1)
    expect(await imeisDePlantilla(pagina), 'antes de descartar, la plantilla de altas lo lleva').toContain(IMEI)
    await pagina.getByRole('button', { name: `Descartar ${IMEI}` }).click()
    const ventana = pagina.getByRole('dialog', { name: 'Descartar de «No está en NSYS»' })
    await expect(ventana.getByRole('button', { name: 'Descartar' })).toBeDisabled()
    await ventana.getByLabel('Motivo (obligatorio)').fill(MOTIVO)
    await ventana.getByRole('button', { name: 'Descartar' }).click()
    await expect(pagina.getByTestId('aviso-breve')).toContainText(`Descartado «${IMEI}»`)
    await expect(tabla.getByRole('row').filter({ hasText: IMEI })).toHaveCount(0)
    const t = await tarjetasApi(pagina)
    expect(t.altas.map((f) => f.imeiSn)).not.toContain(IMEI)
    expect(t.descartadas.find((f) => f.imeiSn === IMEI)?.motivo).toBe(MOTIVO)
    expect(await imeisDePlantilla(pagina), 'la plantilla de altas no lo lleva').not.toContain(IMEI)
  })

  test('«Ver descartados» lo enseña con su motivo y «deshacer» lo devuelve', async () => {
    await abrirNoEsta(pagina)
    await pagina.getByRole('button', { name: /^Ver descartados \(\d+\)$/ }).click()
    const descartados = pagina.getByRole('table', { name: 'Descartados' })
    await expect(descartados.getByRole('row').filter({ hasText: IMEI })).toContainText(`«${MOTIVO}»`)
    await pagina.getByRole('button', { name: `Deshacer descarte de ${IMEI}` }).click()
    await expect(pagina.getByTestId('aviso-breve')).toContainText(`«${IMEI}» vuelve a la lista`)
    await expect(pagina.getByRole('table', { name: 'No está en NSYS' }).getByRole('row').filter({ hasText: IMEI })).toHaveCount(1)
  })

  test('descartado otra vez, un trabajo nuevo lo saca con el aviso de quién lo descartó', async () => {
    const d = await pedir(pagina, 'PUT', '/api/stock-telefonos/por-pasar/descarte', { imeiSn: IMEI, motivo: MOTIVO })
    expect(d.estado, 'PUT descarte').toBe(204)
    // El trabajo nuevo tiene que ser posterior al descarte (las fechas van al segundo): fuera la asignación y el teléfono, y
    // otra asignación nueva (que vuelve a crear el teléfono).
    const r = await pedir(pagina, 'GET', `/api/reparaciones/imei/${IMEI}`)
    for (const { idRep } of r.cuerpo as { idRep: string }[]) {
      expect((await pedir(pagina, 'DELETE', `/api/reparaciones/${idRep}`, { motivo: 'E2E: trabajo nuevo' })).estado).toBe(204)
    }
    expect([204, 404]).toContain((await pedir(pagina, 'DELETE', `/api/telefonos/${IMEI}`)).estado)
    await pagina.waitForTimeout(1_100)
    await asignar(pagina)
    await abrirNoEsta(pagina)
    const fila = pagina.getByRole('table', { name: 'No está en NSYS' }).getByRole('row').filter({ hasText: IMEI })
    await expect(fila).toContainText('Salió otra vez: trabajo nuevo después de que')
    await expect(fila).toContainText(`(«${MOTIVO}»)`)
  })
})
