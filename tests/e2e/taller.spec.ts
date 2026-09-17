import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Filas de datos de la tabla: DataTable les pone aria-selected cuando la tabla es seleccionable; la cabecera y la fila
 *  del texto vacío no lo llevan, así que "hay al menos una fila" no se cumple con la tabla vacía. */
const filasDeDatos = (page: Page) => page.getByRole('table').locator('tr[aria-selected]')

/** Recorrido del técnico por el taller: Pendientes con filas → Historial → IMEIs → detalle → volver. Solo lectura. */
test('técnico: pendientes, historial, IMEIs y detalle', async ({ page }) => {
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
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

  // El maestro une los tres historiales y se reordena cada vez que llega uno: antes de leer la primera fila se esperan las
  // respuestas de glass y pulidos (el de reparaciones ya se pidió en el Historial) y a que el contador deje de cambiar.
  const esHistorial = (ruta: string) => page.waitForResponse((r) => new URL(r.url()).pathname === ruta && r.ok())
  const historialesCargados = Promise.all([esHistorial('/api/glass/historial'), esHistorial('/api/pulidos/historial')])
  await page.getByRole('link', { name: 'IMEIs' }).click()
  await expect(page.getByRole('heading', { name: 'Agrupado por IMEI' })).toBeVisible()
  await historialesCargados
  const contador = page.getByText(/^[0-9]+ IMEIs?$/)
  let contadorAnterior = ''
  await expect(async () => {
    const actual = (await contador.textContent()) ?? ''
    const estable = actual === contadorAnterior
    contadorAnterior = actual
    expect(estable).toBe(true)
  }).toPass({ intervals: [500] })
  const primera = filasDeDatos(page).first()
  await expect(primera).toBeVisible()
  const imei = (await primera.getByRole('cell').first().innerText()).trim().split(/\s/)[0]
  // Aun así, el botón se busca por su nombre en toda la página y no dentro de esa fila (un sondeo podría reordenarla).
  await page.getByRole('button', { name: `Ver trabajos de ${imei}` }).click()
  await expect(page).toHaveURL(new RegExp(`/reparaciones/imeis/${imei}$`))
  await expect(page.getByText(`IMEI: ${imei}`)).toBeVisible()

  await page.getByRole('button', { name: '← Volver' }).click()
  // El título "Agrupado por IMEI" también se ve en el detalle: la vuelta al maestro se comprueba por la URL.
  await expect(page).toHaveURL(/\/reparaciones\/imeis$/)
  await expect(page.getByRole('heading', { name: 'Agrupado por IMEI' })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(imei) })).toHaveAttribute('aria-selected', 'true')
})

/** El supertécnico entra por Historial y ve el filtro de técnico. */
test('supertécnico: entra en Historial de reparaciones con filtro de técnico', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  // exact: las celdas de texto libre (observaciones, incidencias) también son botones y podrían contener "Técnico"
  await expect(page.getByRole('button', { name: 'Técnico', exact: true })).toBeVisible()
})
