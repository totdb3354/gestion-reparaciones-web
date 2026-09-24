import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** La fila cuya primera celda es EXACTAMENTE `texto` (patrón de asignar.spec.ts:18-24): "lcd-x" no casa con "lcd-x-pro". */
function filaExacta(page: Page, texto: string) {
  const exacto = new RegExp(`^\\s*${escaparRegex(texto)}\\s*$`)
  return page.getByRole('row').filter({ has: page.getByRole('cell').first().filter({ hasText: exacto }) })
}

/** GET /api/proveedores?tipo=COMPONENTES con el token de la sesión de la página (misma origin que la app). */
async function proveedoresComponentes(page: Page): Promise<{ idProv: number; nombre: string }[]> {
  return page.evaluate(async () => {
    const sesion = JSON.parse(sessionStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const r = await fetch('/api/proveedores?tipo=COMPONENTES', { headers: { Authorization: `Bearer ${sesion.token}` } })
    if (!r.ok) throw new Error(`GET /api/proveedores: ${r.status}`)
    return (await r.json()) as { idProv: number; nombre: string }[]
  })
}

async function entrar(page: Page) {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

/** ESCRIBE: edita el stock del SKU de prueba (y lo deja como estaba) y crea y borra un proveedor de prueba. */
test('supertécnico: stock actual, editar stock y devolverlo; proveedor de prueba creado y borrado', async ({ page }) => {
  const sku = process.env.E2E_SKU_PRUEBA
  test.skip(!sku, 'Falta E2E_SKU_PRUEBA')
  await entrar(page)

  await page.getByRole('link', { name: 'Stock' }).click()
  await expect(page).toHaveURL(/\/stock$/)
  await expect(page.getByRole('heading', { name: 'Stock actual' })).toBeVisible()
  await expect(page.getByText('Estado del stock')).toBeVisible()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

  // Localizar el SKU de prueba con el buscador y leer su stock
  await page.getByPlaceholder('Buscar componente…').fill(sku!)
  const fila = filaExacta(page, sku!)
  await expect(fila).toHaveCount(1)
  const stockInicial = Number((await fila.getByRole('cell').nth(1).textContent())?.trim())
  expect(Number.isInteger(stockInicial)).toBe(true)

  // Editar stock: +1 y comprobar; después devolverlo
  async function editar(nuevo: number) {
    await fila.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Editar stock' }).click()
    const dlg = page.getByRole('dialog', { name: 'Editar stock' })
    await dlg.getByLabel('Nueva cantidad').fill(String(nuevo))
    await dlg.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dlg).toBeHidden()
    await expect(fila.getByRole('cell').nth(1)).toHaveText(String(nuevo))
  }
  try {
    await editar(stockInicial + 1)
  } finally {
    await editar(stockInicial)
  }

  // Proveedor de prueba: alta, id por el nombre exacto, ver en la tabla y borrar SOLO ese id
  const nombre = `E2E ${Date.now()}`
  await page.getByRole('link', { name: 'Proveedores' }).click()
  await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
  await page.getByRole('dialog', { name: 'Nuevo proveedor' }).getByLabel('Nombre del proveedor:').fill(nombre)
  await page.getByRole('dialog', { name: 'Nuevo proveedor' }).getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('dialog', { name: 'Nuevo proveedor' })).toBeHidden()
  // El alta responde 201 sin cuerpo: el id sale del listado, con el nombre exacto y único. Si no aparece exactamente
  // uno, el test falla aquí sin limpiar nada.
  const creados = (await proveedoresComponentes(page)).filter((p) => p.nombre === nombre)
  expect(creados).toHaveLength(1)
  const idProv = creados[0].idProv
  const filaProv = filaExacta(page, nombre)
  await expect(filaProv).toHaveCount(1)
  try {
    await expect(filaProv.getByText('Activo', { exact: true })).toBeVisible()
  } finally {
    // Solo pasa el DELETE de ese id: si la fila o el menú apuntaran a otro proveedor, la petición se aborta.
    await page.route('**/api/proveedores/*', (route) => {
      const req = route.request()
      if (req.method() === 'DELETE' && new URL(req.url()).pathname !== `/api/proveedores/${idProv}`) return route.abort()
      return route.continue()
    })
    const borrado = page.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/api/proveedores/${idProv}`)
    await filaProv.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Borrar' }).click()
    await page.getByRole('dialog', { name: 'Borrar proveedor' }).getByRole('button', { name: 'Borrar' }).click()
    expect((await borrado).status()).toBe(204)
    await expect(filaProv).toHaveCount(0)
  }
})
