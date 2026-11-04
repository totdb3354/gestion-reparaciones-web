import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// pedidos-clientes.spec.ts (0.9.26, spec pieza 2): el técnico no tiene «Pedidos» de Teléfonos (ni en la columna, ni por URL,
// ni por la API); el supertécnico la ve con su píldora de fuentes, filtra y abre una unidad. Solo LEE: los datos son los que la
// lectura trae de ShippyPro, PEDIDOS 2026 y el Simulador; no se apunta ningún pedido ni IMEI en el código. Como todas las E2E,
// solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

async function estado(page: Page, ruta: string): Promise<number> {
  return page.evaluate(async (r) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    return (await fetch(r, { headers: { Authorization: `Bearer ${sesion.token}` } })).status
  }, ruta)
}

test('el técnico no tiene Pedidos de Teléfonos: ni en la columna, ni por URL, ni por la API', async ({ page }) => {
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna.getByRole('link', { name: 'Pedidos', exact: true })).toHaveCount(0)
  await page.goto('/telefonos/pedidos')
  await expect(page.getByRole('dialog', { name: 'Error' })).toContainText('No tienes permisos para realizar esta acción.')
  expect(await estado(page, '/api/pedidos')).toBe(403)
})

test('el supertécnico ve Pedidos con sus fuentes, filtra y abre una unidad', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna.getByRole('link', { name: 'Compras', exact: true })).toBeVisible()
  // La lista llega por /api/pedidos (no por /api/pedidos/fuentes): se espera esa respuesta antes de contar, para no saltar la
  // prueba en silencio con la lista aún sin cargar.
  const respuesta = page.waitForResponse((r) => {
    const url = new URL(r.url())
    return /^\/api\/pedidos$/.test(url.pathname) && r.request().method() === 'GET'
  })
  await columna.getByRole('link', { name: 'Pedidos', exact: true }).click()
  expect((await respuesta).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fuentes:/ })).toBeVisible()
  const pedidos = page.getByRole('region', { name: 'Lista de pedidos' }).getByRole('article')
  test.skip((await pedidos.count()) === 0, 'Preprod no tiene pedidos abiertos ahora mismo: no hay nada que abrir')
  const primera = pedidos.first().getByRole('button').first()
  await primera.click()
  await expect(page.getByRole('region', { name: 'Unidad elegida' }).getByText(/^Pide /)).toBeVisible()
  await page.getByRole('group', { name: 'Canal' }).getByRole('button').nth(1).click()
  await expect(pedidos.first()).toBeVisible()
  await page.setViewportSize({ width: 1366, height: 768 })
  expect(await page.locator('html').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true)
})
