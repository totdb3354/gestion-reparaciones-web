import { expect, test, type Page } from '@playwright/test'

/** Filas de datos de la tabla: DataTable les pone aria-selected cuando la tabla es seleccionable; la cabecera y la fila
 *  del texto vacío no lo llevan, así que "hay al menos una fila" no se cumple con la tabla vacía. */
const filasDeDatos = (page: Page) => page.getByRole('table').locator('tr[aria-selected]')

/** Recorrido del técnico por el taller: Pendientes con filas → Historial → IMEIs → detalle → volver. Solo lectura. */
test('técnico: pendientes, historial, IMEIs y detalle', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(process.env.TEC_USER!)
  await page.getByPlaceholder('Contraseña').fill(process.env.TEC_PASS!)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()

  // Entrada del técnico: Pendientes, con el toggle Reparaciones activo y al menos una fila de datos
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  await expect(page.getByRole('heading', { name: 'Mis asignaciones pendientes' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Reparaciones \(/ })).toHaveAttribute('aria-current', 'page')
  await expect(filasDeDatos(page).first()).toBeVisible()

  await page.getByRole('link', { name: 'Historial' }).click()
  await expect(page.getByRole('heading', { name: 'Mis reparaciones' })).toBeVisible()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

  await page.getByRole('link', { name: 'IMEIs' }).click()
  await expect(page.getByRole('heading', { name: 'Agrupado por IMEI' })).toBeVisible()
  const primera = filasDeDatos(page).first()
  await expect(primera).toBeVisible()
  const imei = (await primera.getByRole('cell').first().innerText()).trim().split(/\s/)[0]
  // El maestro se reordena cuando llegan las consultas de glass y pulidos: el botón se busca por su nombre en toda la
  // página, no dentro de esa fila, que para entonces puede haber dejado de ser la primera.
  await page.getByRole('button', { name: `Ver trabajos de ${imei}` }).click()
  await expect(page).toHaveURL(new RegExp(`/reparaciones/imeis/${imei}$`))
  await expect(page.getByText(`IMEI: ${imei}`)).toBeVisible()

  await page.getByRole('button', { name: '← Volver' }).click()
  await expect(page.getByRole('heading', { name: 'Agrupado por IMEI' })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(imei) })).toHaveAttribute('aria-selected', 'true')
})

/** El supertécnico entra por Historial y ve el filtro de técnico. */
test('supertécnico: entra en Historial de reparaciones con filtro de técnico', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(process.env.E2E_USER!)
  await page.getByPlaceholder('Contraseña').fill(process.env.E2E_PASS!)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  // exact: las celdas de texto libre (observaciones, incidencias) también son botones y podrían contener "Técnico"
  await expect(page.getByRole('button', { name: 'Técnico', exact: true })).toBeVisible()
})
