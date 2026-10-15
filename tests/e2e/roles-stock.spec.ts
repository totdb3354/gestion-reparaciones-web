import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// roles-stock.spec.ts (0.9.16, spec «El técnico sin Pedidos ni Proveedores»): el técnico no tiene Pedidos ni Proveedores
// (ni en la columna, ni por URL, ni por la API) y el supertécnico y el admin sí. Solo LEE: no crea ni cambia datos. Aun así,
// como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const LECTURAS = ['/api/compras', '/api/compras-otros', '/api/proveedores?tipo=COMPONENTES']

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Estado HTTP de cada lectura con el token de la sesión de la página (misma origin que la app; patrón de gestion.spec.ts). */
async function estados(page: Page): Promise<number[]> {
  return page.evaluate(async (rutas) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    return Promise.all(rutas.map(async (r) => (await fetch(r, { headers: { Authorization: `Bearer ${sesion.token}` } })).status))
  }, LECTURAS)
}

test('el técnico no tiene Pedidos ni Proveedores: ni en la columna, ni por URL, ni por la API', async ({ page }) => {
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna.getByRole('link', { name: 'Stock actual', exact: true })).toBeVisible()
  await expect(columna.getByRole('link', { name: 'Pedidos', exact: true })).toHaveCount(0)
  await expect(columna.getByRole('link', { name: 'Proveedores', exact: true })).toHaveCount(0)
  for (const ruta of ['/stock/pedidos', '/stock/proveedores']) {
    await page.goto(ruta)
    await expect(page.getByRole('dialog', { name: 'Error' })).toContainText('No tienes permisos para realizar esta acción.')
    await expect(page).toHaveURL(/\/stock$/)
  }
  expect(await estados(page)).toEqual([403, 403, 403])
})

for (const [rol, varUsuario, varClave] of [['supertécnico', 'E2E_USER', 'E2E_PASS'], ['admin', 'ADMIN_USER', 'ADMIN_PASS']] as const) {
  test(`el ${rol} sigue con Pedidos y Proveedores`, async ({ page }) => {
    const { usuario, clave } = credenciales(varUsuario, varClave)
    await entrar(page, usuario, clave)
    const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
    await columna.getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expect(page).toHaveURL(/\/stock\/pedidos$/)
    await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible()
    await columna.getByRole('link', { name: 'Proveedores', exact: true }).click()
    await expect(page).toHaveURL(/\/stock\/proveedores$/)
    await expect(page.getByRole('heading', { name: 'Proveedores', exact: true })).toBeVisible()
    expect(await estados(page)).toEqual([200, 200, 200])
  })
}
