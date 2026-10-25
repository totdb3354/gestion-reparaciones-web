import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// plantillas-nsys.spec.ts (0.9.22, spec «plantillas NSYS» §3 y §6): con el móvil SINTÉTICO del guion de preprod (por defecto
// 350000000009921; otro con E2E_IMEI_TALLER), el supertécnico le cambia el color y el grado por la API, lo ve en «Cambio de color» y
// en «Cambio de grado», descarga la plantilla de color y marca y deshace «Hecho». Mide de paso lo que tarda la lista de las tarjetas
// (el cruce de «No está en NSYS»). Solo contra PREPRODUCCIÓN (se niega sin el letrero) y deja el móvil como estaba: sin marcas y con
// «Volver a lo de NSYS».
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_TALLER ?? '350000000009921'
const SIN_NADA = 'Este móvil no tiene nada del taller'
const MOTIVO = 'E2E 0.9.22: prueba de las tarjetas de NSYS'

type Respuesta = { estado: number; cuerpo: unknown }
type Opcion = { color: string; producto: string | null }
type FilaConHecho = { imeiSn: string; hechoEn: string | null }

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Una petición a la API con el token de la sesión de la página (patrón de sku-taller.spec.ts). */
async function pedir(page: Page, metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta> {
  return page.evaluate(async ({ metodo, ruta, cuerpo }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const texto = await res.text()
    return { estado: res.status, cuerpo: texto ? (JSON.parse(texto) as unknown) : null }
  }, { metodo, ruta, cuerpo })
}

/** Sin marcas «Hecho» y sin nada del taller: 204 al quitar las marcas (aunque no hubiera) y 204, o el 400 «Este móvil no tiene
 *  nada del taller», al volver a lo de NSYS. */
async function limpiar(page: Page) {
  for (const tarjeta of ['COLOR', 'GRADO']) {
    const r = await pedir(page, 'DELETE', '/api/stock-telefonos/por-pasar/hecho', { tarjeta, imeiSn: IMEI })
    expect(r.estado, `quitar la marca ${tarjeta}: ${JSON.stringify(r.cuerpo)}`).toBe(204)
  }
  const r = await pedir(page, 'DELETE', `/api/stock-telefonos/${IMEI}/taller`, { motivo: MOTIVO })
  const detalle = `limpieza del móvil de prueba: ${r.estado} ${JSON.stringify(r.cuerpo)}`
  expect([204, 400], detalle).toContain(r.estado)
  if (r.estado === 400) expect(JSON.stringify(r.cuerpo), detalle).toContain(SIN_NADA)
}

test.describe('0.9.22: «Por pasar a NSYS» con cuatro tarjetas', () => {
  test.describe.configure({ mode: 'serial' })
  // Una sola sesión: el entorno limita los inicios de sesión por minuto.
  let pagina: Page
  // Solo true tras comprobar el letrero de preprod: sin eso la limpieza no corre.
  let enPreprod = false
  let colorNuevo = ''

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    enPreprod = true
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `el móvil de prueba ${IMEI} tiene que estar en el espejo (lo mete el guion de preprod)`).toBe(200)
    await limpiar(pagina)
  })

  test.afterAll(async () => {
    if (enPreprod) await limpiar(pagina)
    await pagina?.close()
  })

  test('un cambio de color y de grado salen en sus dos tarjetas y la plantilla de color se descarga', async () => {
    const ficha = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).cuerpo as { color: string | null }
    const opciones = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}/colores`)).cuerpo as { colores: Opcion[] }
    const otro = opciones.colores.find((o) => o.color !== ficha.color && o.producto)
    test.skip(!otro, 'el modelo del móvil de prueba no tiene otro color con producto')
    colorNuevo = otro!.color
    const puesto = await pedir(pagina, 'PUT', `/api/stock-telefonos/${IMEI}/taller`, { color: colorNuevo, grado: 'A100', motivo: MOTIVO })
    expect(puesto.estado, JSON.stringify(puesto.cuerpo)).toBe(204)

    const antes = Date.now()
    const tarjetas = await pedir(pagina, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')
    const ms = Date.now() - antes
    console.log(`GET /api/stock-telefonos/por-pasar/tarjetas: ${ms} ms`)
    expect(tarjetas.estado).toBe(200)
    expect(ms, 'el límite de 15 s por petición').toBeLessThan(15_000)

    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
    const fila = pagina.getByRole('table', { name: 'Cambio de color' }).getByRole('row').filter({ hasText: IMEI })
    await expect(fila).toContainText('también en «Cambio de grado» (después)')
    const descarga = pagina.waitForEvent('download')
    await pagina.getByRole('article', { name: 'Cambio de color' }).getByRole('button', { name: /^⬇ Descargar plantilla/ }).click()
    const fichero = await descarga
    expect(fichero.suggestedFilename()).toMatch(/^NSYS_color_\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect((await readFile(await fichero.path())).subarray(0, 2).toString(), 'un xlsx es un zip').toBe('PK')

    await pagina.getByRole('button', { name: 'Cambio de grado' }).click()
    await expect(pagina.getByRole('table', { name: 'Cambio de grado' }).getByRole('row').filter({ hasText: IMEI }))
      .toContainText('→ A100')
  })

  test('«Hecho» marca la fila y «deshacer» la devuelve', async () => {
    test.skip(!colorNuevo, 'sin cambio de color (ver la prueba anterior)')
    await pagina.getByRole('button', { name: 'Cambio de color' }).click()
    await pagina.getByRole('button', { name: `Hecho ${IMEI}` }).click()
    await expect(pagina.getByRole('button', { name: `Deshacer Hecho de ${IMEI}` })).toBeVisible()
    const tarjetas = (await pedir(pagina, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')).cuerpo as { color: FilaConHecho[] }
    expect(tarjetas.color.find((f) => f.imeiSn === IMEI)?.hechoEn, 'la marca está en el servidor').toBeTruthy()
    await pagina.getByRole('button', { name: `Deshacer Hecho de ${IMEI}` }).click()
    await expect(pagina.getByRole('button', { name: `Hecho ${IMEI}` })).toBeVisible()
  })
})
