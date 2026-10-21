import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// sku-taller.spec.ts (0.9.21, spec «SKU del taller», pieza 1): el supertécnico corrige a mano el grado de un móvil de prueba
// desde su ficha, lo ve en la ficha, en el rastro y en la pestaña «Por pasar a NSYS», y «Volver a lo de NSYS» lo saca de la
// lista. Solo contra PREPRODUCCIÓN (se niega a seguir sin el letrero) y con un móvil SINTÉTICO que el guion de preprod mete
// en el espejo (por defecto 350000000009921, grado B sin batería nueva; otro con E2E_IMEI_TALLER): nunca un móvil real.
// Deja el móvil como estaba al empezar y al acabar («Volver a lo de NSYS» por la API).
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_TALLER ?? '350000000009921'
const SIN_NADA = 'Este móvil no tiene nada del taller'
const MOTIVO = 'E2E 0.9.21: prueba del SKU del taller'

type Respuesta = { estado: number; cuerpo: unknown }

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Una petición a la API con el token de la sesión de la página (misma origin que la app; patrón de stock-telefonos.spec.ts). */
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

/** Vuelve a lo de NSYS si quedó algo del taller (una pasada anterior cortada): 204, o el 400 «Este móvil no tiene nada del
 *  taller» si no había nada (cualquier otro 400 es un fallo de verdad). El servidor manda el texto en el JSON {message}. */
async function limpiar(page: Page, motivo: string) {
  const r = await pedir(page, 'DELETE', `/api/stock-telefonos/${IMEI}/taller`, { motivo })
  const detalle = `limpieza del móvil de prueba: ${r.estado} ${JSON.stringify(r.cuerpo)}`
  expect([204, 400], detalle).toContain(r.estado)
  if (r.estado === 400) expect(JSON.stringify(r.cuerpo), `${detalle} (se esperaba «${SIN_NADA}»)`).toContain(SIN_NADA)
}

test.describe('0.9.21: SKU del taller', () => {
  test.describe.configure({ mode: 'serial' })
  // Una sola sesión para los dos: el entorno limita los inicios de sesión por minuto.
  let pagina: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `falta el móvil sintético ${IMEI} en el espejo de preprod (lo mete el guion)`).toBe(200)
    await limpiar(pagina, 'E2E: limpieza previa')
    const ficha = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).cuerpo as { grado: string; bateriaNueva: boolean; porPasar: boolean }
    expect(ficha, 'el móvil de prueba empieza en B sin batería nueva y sin nada del taller').toMatchObject({ grado: 'B', bateriaNueva: false, porPasar: false })
  })

  test.afterAll(async () => {
    if (pagina) await limpiar(pagina, 'E2E: limpieza')
    await pagina?.close()
  })

  test('corregir el grado lo pone en la ficha, en el rastro y en «Por pasar a NSYS»', async () => {
    await pagina.goto(`/reparaciones/imeis/${IMEI}`)
    const ficha = pagina.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toBeVisible({ timeout: 30_000 })
    await ficha.getByRole('button', { name: 'Corregir color, grado o batería…' }).click()
    const dialogo = pagina.getByRole('dialog', { name: `Corregir ${IMEI}` })
    await dialogo.getByLabel('Grado').selectOption('A')
    await dialogo.getByRole('checkbox', { name: 'Batería nueva (100)' }).check()
    await expect(dialogo.getByRole('region', { name: 'Vista previa' })).toContainText('Grado: B → A100')
    await dialogo.getByRole('textbox', { name: 'Motivo' }).fill(MOTIVO)
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(ficha).toContainText('Por pasar a NSYS:')
    await expect(ficha).toContainText('NSYS: B')
    await ficha.getByRole('button', { name: /^Ver rastro/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Rastro' })).toContainText(`Taller: grado B → A100 (a mano · `)
    await pagina.keyboard.press('Escape')
    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS \(\d+\)$/ }).click()
    await expect(pagina.getByRole('table', { name: 'Móviles por pasar a NSYS' }).getByRole('row', { name: new RegExp(IMEI) })).toBeVisible()
  })

  test('«Volver a lo de NSYS» lo saca de la lista y queda en el rastro', async () => {
    await pagina.goto(`/reparaciones/imeis/${IMEI}`)
    const ficha = pagina.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toContainText('Por pasar a NSYS:', { timeout: 30_000 })
    await ficha.getByRole('button', { name: 'Corregir color, grado o batería…' }).click()
    const dialogo = pagina.getByRole('dialog', { name: `Corregir ${IMEI}` })
    await dialogo.getByRole('button', { name: 'Volver a lo de NSYS' }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(ficha).not.toContainText('Por pasar a NSYS:')
    await ficha.getByRole('button', { name: /^Ver rastro/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Rastro' })).toContainText('Vuelve a lo de NSYS: grado A100 → B')
    await pagina.keyboard.press('Escape')
    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS \(\d+\)$/ }).click()
    const tabla = pagina.getByRole('table', { name: 'Móviles por pasar a NSYS' })
    await expect(tabla).toBeVisible()
    // Sin esperar a que acabe la carga, «0 filas» se cumpliría con la lista aún vacía.
    await expect(tabla.getByText('Cargando…')).toHaveCount(0)
    await expect(tabla.getByRole('row', { name: new RegExp(IMEI) })).toHaveCount(0)
  })
})
