import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// stock-telefonos.spec.ts (0.9.17, spec «Pieza 1 del módulo de teléfonos»): el técnico no tiene «Teléfonos» (ni en la
// columna, ni por URL, ni por la API); el supertécnico y el admin ven el stock de teléfonos, abren un móvil, su ficha y su
// rastro, y el modelo por IMEI sale del espejo de NSYS. Solo LEE: los datos son los que la importación trae de NSYS y no
// se apunta ningún IMEI en el código (se usa el primero de la tabla). Como todas las E2E, solo contra PREPRODUCCIÓN: se
// niega a seguir sin el letrero.
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
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna.getByRole('link', { name: 'Stock actual', exact: true })).toBeVisible()
  await expect(columna.getByRole('link', { name: 'Stock de teléfonos', exact: true })).toHaveCount(0)
  await expect(columna.getByRole('button', { name: /^Teléfonos/ })).toHaveCount(0)
  await page.goto('/telefonos/stock')
  await expect(page.getByRole('dialog', { name: 'Error' })).toContainText('No tienes permisos para realizar esta acción.')
  await expect(page).toHaveURL(/\/reparaciones/)
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
