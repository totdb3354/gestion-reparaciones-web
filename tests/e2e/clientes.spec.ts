import { expect, test } from '@playwright/test'
import { credenciales } from './credenciales.ts'

const nombre = `E2E ${Date.now()}`

test('login, crear, editar, desactivar y borrar un cliente', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()

  // Acotado a la barra superior (`<header>` = landmark banner): en /clientes la columna lateral pinta un
  // segundo enlace "Clientes" y sin acotar el localizador sería ambiguo.
  await page.getByRole('banner').getByRole('link', { name: 'Clientes' }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  await page.getByLabel('Nombre del cliente:').fill(nombre)
  await page.getByRole('button', { name: 'Aceptar' }).click()
  const fila = page.getByRole('row', { name: new RegExp(nombre) })
  await expect(fila).toBeVisible()

  await fila.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Editar' }).click()
  await page.getByLabel('Nombre:').fill(`${nombre} bis`)
  await page.getByRole('button', { name: 'Aceptar' }).click()
  const fila2 = page.getByRole('row', { name: new RegExp(`${nombre} bis`) })
  await expect(fila2).toBeVisible()

  await fila2.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Desactivar' }).click()
  await expect(fila2.getByText('Inactivo')).toBeVisible()

  await fila2.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  await expect(page.getByRole('dialog', { name: 'Borrar cliente' })).toBeVisible()
  await page.getByRole('button', { name: 'Borrar' }).click()
  await expect(fila2).toHaveCount(0)
})
