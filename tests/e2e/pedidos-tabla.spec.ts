import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// pedidos-tabla.spec.ts (0.9.32, spec «Pedidos como la hoja»): el técnico no tiene «Pedidos» en Teléfonos (ni en la columna, ni por
// URL, ni por la API) y el supertécnico ve la hoja con sus seis columnas y puede poner un IMEI recomendado en una fila viva sin IMEI.
// Esa prueba ESCRIBE un IMEI y lo QUITA al terminar (también si falla a mitad o se pasa de tiempo): la limpieza va por la API con
// el token de la sesión (sin depender de la página) y se comprueba que respondió 2xx. No apunta ningún IMEI,
// pedido ni cliente en el código: todo se lee de la pantalla.
// Como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const COLUMNAS = ['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Fecha compra']

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Llamada a la API con el token de la sesión de la página (misma origin que la app; patrón de roles-stock.spec.ts). */
async function llamar(page: Page, metodo: string, ruta: string, cuerpo?: unknown): Promise<number> {
  return page.evaluate(async ([m, r, c]) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const cabeceras: Record<string, string> = { Authorization: `Bearer ${sesion.token}` }
    if (c) cabeceras['Content-Type'] = 'application/json'
    return (await fetch(r as string, { method: m as string, headers: cabeceras, body: (c as string | undefined) ?? undefined })).status
  }, [metodo, ruta, cuerpo === undefined ? undefined : JSON.stringify(cuerpo)] as const)
}

test('el técnico no tiene Pedidos en Teléfonos: ni en la columna, ni por URL, ni por la API', async ({ page }) => {
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna.getByRole('link', { name: 'Pedidos', exact: true })).toHaveCount(0)
  await page.goto('/telefonos/pedidos')
  await expect(page.getByRole('dialog', { name: 'Error' })).toContainText('No tienes permisos para realizar esta acción.')
  await expect(page).not.toHaveURL(/\/telefonos\/pedidos/)
  expect(await llamar(page, 'GET', '/api/pedidos/filas')).toBe(403)
})

async function quitarPorApiCon(request: APIRequestContext, token: string, id: string) {
  const r = await request.put(`/api/pedidos/filas/${id}/imei`, { headers: { Authorization: `Bearer ${token}` }, data: { imei: null } })
  if (!r.ok()) throw new Error(`No se pudo quitar el IMEI de la fila ${id} (HTTP ${r.status()}): hay que limpiarla a mano`)
}

test('el supertécnico ve la hoja de Pedidos y pone y quita un IMEI recomendado (la fila queda como estaba)', async ({ page, request }) => {
  test.setTimeout(90_000)
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  // El token se lee ahora, con la página viva: la limpieza del `finally` ya no la necesita.
  const token = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }).token ?? '')
  expect(token, 'hay sesión').not.toBe('')
  const quitarPorApi = (id: string) => quitarPorApiCon(request, token, id)

  // Para dejarlo todo como estaba aunque falle una comprobación: la fila que se toca se lee de la petición PUT de la propia web.
  let idTocada: string | null = null
  page.on('request', (r) => {
    const m = r.method() === 'PUT' ? /\/api\/pedidos\/filas\/(\d+)\/imei$/.exec(r.url()) : null
    if (m) idTocada = m[1]
  })

  try {
    await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expect(page).toHaveURL(/\/telefonos\/pedidos$/)
    await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible()
    const hoja = page.getByRole('region', { name: 'Tabla de pedidos' })
    const sinPedidos = page.getByText('No hay pedidos en este periodo.')
    await expect(hoja.or(sinPedidos)).toBeVisible()
    test.skip(await sinPedidos.isVisible(), 'no hay pedidos en el periodo por defecto: no se puede probar la hoja')
    const cabeceras = hoja.getByRole('columnheader')
    await expect(cabeceras).toHaveCount(COLUMNAS.length)
    const textos = (await cabeceras.allTextContents()).map((t) => t.trim())
    COLUMNAS.forEach((c, i) => expect(textos[i], `cabecera ${i + 1}`).toBe(c))

    // La primera fila viva (celda de IMEI pulsable) sin IMEI.
    const filas = hoja.locator('tbody tr')
    const sinImei = filas.filter({ has: page.locator('button:not([disabled])', { hasText: 'pulsa para poner el IMEI…' }) })
    test.skip(await sinImei.count() === 0, 'no hay ninguna fila viva sin IMEI en Pedidos en el último mes: no se puede probar el IMEI recomendado')
    // La fila se recuerda por el texto de su «Pedido» (solo en una variable) y su orden entre las filas con ese mismo pedido, no por
    // su posición en la tabla: si llegan o se quitan filas, se vuelve a localizar igual.
    const [pedido, orden] = await sinImei.first().evaluate((tr) => {
      const t = tr as unknown as { cells: ArrayLike<{ textContent: string | null }>; parentElement: { children: ArrayLike<unknown> } }
      const texto = (x: unknown) => ((x as typeof t).cells[4]?.textContent ?? '').trim()
      const mismas = Array.from(t.parentElement.children).filter((x) => texto(x) === texto(tr))
      return [texto(tr), mismas.indexOf(tr)] as const
    })
    const escapar = (c: string) => c.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&')
    const celdaPedido = (c: string) => new RegExp('^\\s*' + escapar(c) + '\\s*$')
    const localizarCelda = () => filas.filter({ has: page.locator('td:nth-child(5)', { hasText: celdaPedido(pedido) }) }).nth(orden).getByRole('cell').nth(3)

    await localizarCelda().getByRole('button').click()
    const desplegable = page.getByRole('dialog', { name: 'Poner el IMEI' })
    await expect(desplegable).toBeVisible()
    const recomendado = desplegable.getByRole('button').filter({ hasText: /^\d{15}/ }).first()
    test.skip(!(await recomendado.waitFor({ timeout: 10_000 }).then(() => true, () => false)), 'la fila no tiene móviles recomendados en stock')
    const imei = (await recomendado.locator('span').first().textContent())?.trim() ?? ''
    expect(imei).toMatch(/^\d{15}$/)
    await recomendado.click()
    await expect(desplegable).toBeHidden()
    await expect(localizarCelda()).toContainText(imei)
    expect(idTocada, 'la web puso el IMEI con un PUT').not.toBeNull()

    // Lo quita desde la propia pantalla.
    await localizarCelda().getByRole('button').click()
    await page.getByRole('button', { name: 'Quitar el IMEI' }).click()
    await expect(localizarCelda()).toContainText('pulsa para poner el IMEI…')
    await expect(localizarCelda()).not.toContainText(imei)
    idTocada = null
  } finally {
    // Si algo falló con el IMEI ya puesto (o se acabó el tiempo), se quita por la API sin usar la página: la fila queda como estaba.
    if (idTocada) await quitarPorApi(idTocada)
  }
})
