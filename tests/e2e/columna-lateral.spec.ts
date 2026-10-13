import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// columna-lateral.spec.ts (0.9.10, spec «Columna lateral plegable»): plegar, recargar, navegar por los iconos y desplegar.
// Solo LEE: no crea ni cambia datos, y la preferencia vive en el localStorage del contexto del navegador, que Playwright
// descarta al terminar. Aun así, como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

test('la columna lateral se pliega, se recuerda al recargar y se despliega', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
  // El supertécnico entra en Asignaciones (InicioReparaciones).
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)
  const columna = page.getByRole('navigation', { name: 'Sub-navegación' })
  await expect(columna).toHaveCSS('width', '200px')

  await page.getByRole('button', { name: 'Ocultar menú lateral' }).click()
  await expect(columna).toHaveCSS('width', '56px')
  await expect(columna.getByText('Historial', { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(columna).toHaveCSS('width', '56px')
  const historial = columna.getByRole('link', { name: 'Historial' })
  await historial.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Historial')
  await historial.click()
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await expect(columna).toHaveCSS('width', '56px')

  await page.getByRole('button', { name: 'Mostrar menú lateral' }).click()
  await expect(columna).toHaveCSS('width', '200px')
  await expect(columna.getByRole('link', { name: 'Historial' })).toHaveText('Historial')
})
