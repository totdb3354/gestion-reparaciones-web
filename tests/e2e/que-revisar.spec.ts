import { expect, test } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// que-revisar.spec.ts (0.9.25, spec 2026-11-04-v0925-que-revisar-design.md): el supertécnico abre Stock de teléfonos → «Qué
// revisar», ve las dos tarjetas con su cifra y, si hay algún modelo-color, lo despliega y ve un IMEI. Solo LEE: los datos son los
// del espejo de preprod y no se apunta ningún IMEI en el código. Como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir
// sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

test('«Qué revisar» enseña sus dos tarjetas y despliega un modelo-color', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)

  await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Stock de teléfonos', exact: true }).click()
  await expect(page.getByText(/^\d+ móviles? en stock$/)).toBeVisible()
  const pestana = page.getByRole('button', { name: /^Qué revisar \(\d+\)$/ })
  await pestana.click()
  await expect(pestana).toHaveAttribute('aria-pressed', 'true')
  for (const nombre of ['Revisar sin grado', 'Subir B a A'])
    await expect(page.getByRole('article', { name: nombre })).toContainText(/\d+ modelos?-color · \d+ móvil(es)?/)

  const desplegar = page.getByRole('button', { name: /^Ver los móviles de / })
  if (await desplegar.count() === 0) {
    await expect(page.getByText(/^Nada que revisar/)).toBeVisible()
    return
  }
  await desplegar.first().click()
  await expect(desplegar.first()).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('table', { name: /^Móviles de / }).getByRole('button', { name: /^Abrir / }).first()).toBeVisible()
})
