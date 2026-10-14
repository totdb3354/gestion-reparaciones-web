import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// columna-lateral.spec.ts (0.9.10 y 0.9.12): navegación por grupos en la columna, plegar un grupo, plegar la columna,
// recargar, navegar por un icono y desplegar. Solo LEE: no crea ni cambia datos, y las preferencias viven en el
// localStorage del contexto del navegador, que Playwright descarta al terminar. Aun así, como todas las E2E, solo contra
// PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

test('navegación por grupos y columna lateral plegable', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
  // El supertécnico entra en Asignaciones (InicioReparaciones).
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna).toHaveCSS('width', '200px')

  // Un clic desde cualquier sitio: de Pedidos a Historial sin pasar por la barra superior.
  await columna.getByRole('link', { name: 'Pedidos', exact: true }).click()
  await expect(page).toHaveURL(/\/stock\/pedidos$/)
  await columna.getByRole('link', { name: 'Historial', exact: true }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)

  // La cabecera de Stock pliega su grupo y lo despliega.
  const stock = columna.getByRole('button', { name: /^Stock/ })
  await stock.click()
  await expect(stock).toHaveAttribute('aria-expanded', 'false')
  await expect(columna.getByRole('link', { name: 'Pedidos', exact: true })).toHaveCount(0)
  await stock.click()
  await expect(columna.getByRole('link', { name: 'Pedidos', exact: true })).toBeVisible()

  // Plegar la columna, recargar y navegar por un icono con su nombre «Grupo · Pestaña».
  await page.getByRole('button', { name: 'Ocultar menú lateral' }).click()
  await expect(columna).toHaveCSS('width', '56px')
  await expect(columna.getByText('Historial', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(columna).toHaveCSS('width', '56px')
  const asignaciones = columna.getByRole('link', { name: 'Reparaciones · Asignaciones' })
  await asignaciones.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Reparaciones · Asignaciones')
  await asignaciones.click()
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)
  await expect(columna).toHaveCSS('width', '56px')

  await page.getByRole('button', { name: 'Mostrar menú lateral' }).click()
  await expect(columna).toHaveCSS('width', '200px')
  await expect(columna.getByRole('link', { name: 'Historial', exact: true })).toHaveText('Historial')
})
