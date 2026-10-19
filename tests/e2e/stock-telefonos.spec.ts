import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// stock-telefonos.spec.ts (0.9.17, spec «Pieza 1 del módulo de teléfonos»): el técnico no tiene «Teléfonos» (ni en la
// columna, ni por URL, ni por la API); el supertécnico y el admin ven el stock de teléfonos, abren un móvil, su ficha y su
// rastro, y el modelo por IMEI sale del espejo de NSYS. Solo LEE: los datos son los que la importación trae de NSYS y no
// se apunta ningún IMEI en el código (se usa el primero de la tabla). Como todas las E2E, solo contra PREPRODUCCIÓN: se
// niega a seguir sin el letrero. Desde la 0.9.18, además: «Quién lo tiene», el filtro Técnico y la tabla color × grado,
// un SKU de la propia tabla, el diálogo de varios IMEIs y la lista de importaciones de la píldora.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

type Lectura<T> = { estado: number; cuerpo: T | null }

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** GET con el token de la sesión de la página (misma origin que la app; patrón de roles-stock.spec.ts). */
async function leer<T>(page: Page, ruta: string): Promise<Lectura<T>> {
  return page.evaluate(async (r) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(r, { headers: { Authorization: `Bearer ${sesion.token}` } })
    return { estado: res.status, cuerpo: res.ok ? await res.json() : null }
  }, ruta) as Promise<Lectura<T>>
}

test('el técnico no tiene Teléfonos: ni en la columna, ni por URL, ni por la API', async ({ page }) => {
  // 0.9.18: ni la barra superior (indicador «NSYS sin datos») ni la pantalla preguntan por NSYS para el técnico.
  const peticionesNsys: string[] = []
  page.on('request', (r) => { if (r.url().includes('/api/stock-telefonos')) peticionesNsys.push(r.url()) })
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna.getByRole('link', { name: 'Stock actual', exact: true })).toBeVisible()
  await expect(columna.getByRole('link', { name: 'Stock de teléfonos', exact: true })).toHaveCount(0)
  await expect(columna.getByRole('button', { name: /^Teléfonos/ })).toHaveCount(0)
  await page.goto('/telefonos/stock')
  await expect(page.getByRole('dialog', { name: 'Error' })).toContainText('No tienes permisos para realizar esta acción.')
  await expect(page).toHaveURL(/\/reparaciones/)
  await expect(page.getByRole('link', { name: 'NSYS sin datos' })).toHaveCount(0)
  expect(peticionesNsys, 'el técnico no pregunta por NSYS').toEqual([])
  expect((await leer(page, '/api/stock-telefonos/estado')).estado).toBe(403)
})

for (const [rol, varUsuario, varClave] of [['supertécnico', 'E2E_USER', 'E2E_PASS'], ['admin', 'ADMIN_USER', 'ADMIN_PASS']] as const) {
  test(`el ${rol} ve el stock de teléfonos, abre un móvil y su rastro`, async ({ page }) => {
    const { usuario, clave } = credenciales(varUsuario, varClave)
    await entrar(page, usuario, clave)
    const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
    await columna.getByRole('link', { name: 'Stock de teléfonos', exact: true }).click()
    await expect(page).toHaveURL(/\/telefonos\/stock$/)
    await expect(page.getByRole('heading', { name: 'Stock de teléfonos', exact: true })).toBeVisible()
    await expect(page.getByText(/^\d+ móviles? en stock$/)).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^NSYS: / })).toBeVisible()
    const estado = await leer<{ ultimaExportacion: string | null }>(page, '/api/stock-telefonos/estado')
    expect(estado.estado).toBe(200)
    expect(estado.cuerpo?.ultimaExportacion, 'la importación de preprod ya ha traído una exportación').toBeTruthy()

    // El primer modelo de la lista y el primer móvil de su tabla.
    const modelos = page.getByRole('navigation', { name: 'Modelos' }).getByRole('button')
    await modelos.first().click()
    await expect(modelos.first()).toHaveAttribute('aria-pressed', 'true')
    const boton = page.getByRole('button', { name: /^Abrir / }).first()
    const imei = ((await boton.getAttribute('aria-label')) ?? '').replace('Abrir ', '')
    await boton.click()
    await page.waitForURL(/\/reparaciones\/imeis\//)
    expect(new URL(page.url()).pathname).toBe(`/reparaciones/imeis/${encodeURIComponent(imei)}`)

    // Ficha de NSYS y rastro en el panel lateral; Escape lo cierra.
    await expect(page.getByRole('region', { name: 'Ficha de NSYS' })).toContainText(imei)
    await page.getByRole('button', { name: /^Ver rastro \(\d+\)$/ }).click()
    const panel = page.getByRole('dialog', { name: 'Rastro' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('listitem').first()).toBeVisible()
    // El detalle sigue cargando los historiales del taller: mientras se ve la capa de carga, la app bloquea las teclas a
    // propósito (CapaCarga). Se espera a que se quite antes de pulsar Escape.
    await expect(page.getByTestId('capa-carga')).toHaveCount(0, { timeout: 30_000 })
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  })
}

test('el modelo por IMEI sale del espejo de NSYS (adiós IMEIcheck)', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  const stock = await leer<{ imeiSn: string; modelo: string | null }[]>(page, '/api/stock-telefonos')
  expect(stock.estado).toBe(200)
  // Un móvil con modelo que no haya pasado por el taller: así su modelo solo puede salir del espejo, no de Telefono.
  const candidatos = (stock.cuerpo ?? []).filter((m) => m.modelo && /^\d{15}$/.test(m.imeiSn)).slice(0, 10)
  let elegido: { imeiSn: string; modelo: string | null } | undefined
  for (const m of candidatos) {
    const rastro = await leer<{ fuente: string }[]>(page, `/api/stock-telefonos/${m.imeiSn}/rastro`)
    if (rastro.cuerpo && !rastro.cuerpo.some((e) => e.fuente === 'ERP')) {
      elegido = m
      break
    }
  }
  expect(elegido, 'entre los 10 primeros móviles con modelo hay alguno sin trabajos del taller').toBeDefined()
  const modelo = await leer<{ value: string | null }>(page, `/api/telefonos/${elegido!.imeiSn}/modelo`)
  expect(modelo.estado).toBe(200)
  expect(modelo.cuerpo?.value).toBe(elegido!.modelo)
})

test.describe('0.9.18: Quién lo tiene, SKU, varios IMEIs e importaciones', () => {
  test.describe.configure({ mode: 'serial' })
  // Una sola sesión para los cuatro: el entorno limita los inicios de sesión por minuto.
  let pagina: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
  })

  test.afterAll(async () => {
    await pagina?.close()
  })

  test.beforeEach(async () => {
    await pagina.goto('/telefonos/stock')
    await expect(pagina.getByRole('heading', { name: 'Stock de teléfonos', exact: true })).toBeVisible()
    await expect(pagina.getByTestId('capa-carga')).toHaveCount(0, { timeout: 30_000 })
    await pagina.getByRole('navigation', { name: 'Modelos' }).getByRole('button', { name: / en stock$/ }).first().click()
  })

  test('el supertécnico ve «Quién lo tiene», el filtro Técnico y la tabla color × grado', async () => {
    const tabla = pagina.getByRole('region', { name: 'Tabla de móviles' })
    await expect(tabla.getByRole('columnheader', { name: 'Quién lo tiene' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Técnico', exact: true })).toBeVisible()
    await expect(pagina.getByRole('table', { name: 'Color y grado' })).toBeVisible()
  })

  test('busca un SKU de la propia tabla y sale su pastilla', async () => {
    const celdas = pagina.getByRole('region', { name: 'Tabla de móviles' }).locator('td[data-columna="sku"]')
    const skus = (await celdas.allTextContents()).map((t) => t.trim()).filter((t) => t && t !== '—')
    expect(skus.length, 'alguna fila del primer modelo tiene SKU').toBeGreaterThan(0)
    const buscador = pagina.getByRole('textbox', { name: 'Buscar modelo o SKU' })
    await buscador.fill(skus[0])
    await buscador.press('Enter')
    await expect(pagina.getByTestId('pastilla-sku')).toContainText(skus[0])
    await expect(celdas.first()).toContainText(skus[0])
  })

  test('el diálogo de varios IMEIs marca dos de la tabla y un número que no está en NSYS', async () => {
    const stock = await leer<{ imeiSn: string; estado: string }[]>(pagina, '/api/stock-telefonos')
    const imeis = (stock.cuerpo ?? []).filter((m) => m.estado === 'STOCK' && /^\d{15}$/.test(m.imeiSn)).slice(0, 2).map((m) => m.imeiSn)
    expect(imeis, 'hay al menos dos móviles en stock con IMEI').toHaveLength(2)
    await pagina.getByRole('button', { name: 'Pegar varios IMEIs' }).click()
    const dialogo = pagina.getByRole('dialog', { name: 'Comprobar una lista de IMEIs' })
    // 350000000000001 no cumple el dígito de control (Luhn) de un IMEI: no puede estar en NSYS.
    await dialogo.getByRole('textbox', { name: 'IMEIs' }).fill(`${imeis[0]}\n${imeis[1]}\n350000000000001`)
    await dialogo.getByRole('button', { name: 'Comprobar' }).click()
    const filas = dialogo.getByRole('table', { name: 'Resultado' }).getByRole('row')
    await expect(filas).toHaveCount(4)
    await expect(filas.nth(1)).toContainText('Libre')
    await expect(filas.nth(2)).toContainText('Libre')
    await expect(filas.nth(3)).toContainText('No está en NSYS')
    await pagina.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
  })

  test('la píldora de NSYS abre la lista de importaciones y se cierra con Escape', async () => {
    await pagina.getByRole('button', { name: /^NSYS: / }).click()
    const lista = pagina.getByRole('dialog', { name: 'Importaciones de NSYS' })
    await expect(lista.getByRole('list', { name: 'Importaciones' }).getByRole('listitem').first()).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(lista).toHaveCount(0)
  })
})
