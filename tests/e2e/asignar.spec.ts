import { expect, test } from '@playwright/test'
import { credenciales } from './credenciales.ts'

test('el supertécnico asigna un trabajo desde el modal y lo borra', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  const imei = process.env.E2E_IMEI_PRUEBA
  const tecnico = process.env.E2E_TEC_PRUEBA
  test.skip(!imei || !tecnico, 'Faltan E2E_IMEI_PRUEBA / E2E_TEC_PRUEBA')

  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await page.goto('/reparaciones/asignaciones')

  await page.getByRole('button', { name: 'Asignar' }).click()
  const modal = page.getByRole('dialog', { name: 'Asignar trabajos' })
  await modal.getByPlaceholder('Escanea o escribe el IMEI (15 dígitos)...').fill(imei!)
  await expect(modal.getByTestId('imei-en-curso')).toHaveText(imei!)
  await expect(modal.getByRole('combobox', { name: 'Modelo de iPhone' })).not.toHaveValue('')
  await modal.getByRole('checkbox', { name: new RegExp(tecnico!) }).click()
  await modal.getByRole('button', { name: 'Asignar →' }).click()
  await modal.getByRole('button', { name: 'Guardar (1)' }).click()
  await expect(modal).toBeHidden()

  // Limpieza: la fila recién creada, por IMEI y técnico
  try {
    await page.getByPlaceholder('Filtrar por IMEI').fill(imei!)
    const fila = page.getByRole('row').filter({ hasText: imei! }).filter({ hasText: tecnico! }).first()
    await expect(fila).toBeVisible()
  } finally {
    const fila = page.getByRole('row').filter({ hasText: imei! }).filter({ hasText: tecnico! }).first()
    if (await fila.isVisible()) {
      // BotonPapelera.tsx: aria-label por defecto "Borrar asignación" (mismo texto que el botón de confirmación,
      // por eso el confirm se busca dentro de su diálogo: AsignacionesPage.tsx titula "Borrar asignación <idRep>").
      await fila.getByRole('button', { name: 'Borrar asignación' }).click()
      const confirmar = page.getByRole('dialog', { name: /^Borrar asignación/ })
      await confirmar.getByRole('button', { name: 'Borrar asignación' }).click()
      await expect(fila).toBeHidden()
    }
  }
})
