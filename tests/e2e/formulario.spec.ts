import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// El test del supertécnico rechaza y recupera la solicitud que deja el del técnico: van en orden y en el mismo worker.
test.describe.configure({ mode: 'serial' })

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

const esBorrador = (metodo: string) => (r: { url(): string; request(): { method(): string }; ok(): boolean }) =>
  r.request().method() === metodo && new URL(r.url()).pathname.endsWith('/borrador') && r.ok()

/**
 * Guion del técnico (spec §11). ESCRIBE: guarda una fila (consume una unidad de stock de prueba), registra una solicitud
 * de pieza y termina. Datos necesarios, creados antes con el cliente de escritorio: una asignación de reparación pendiente
 * del técnico de TEC_USER sobre un IMEI de prueba, de un modelo con al menos un tipo con stock y otro tipo con el SKU a 0.
 */
test('técnico: borrador recuperado, guardar fila, solicitar pieza y terminar', async ({ page }) => {
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)

  // Abrir "Añadir reparación" de la primera asignación
  await page.getByRole('button', { name: 'Añadir reparación' }).first().click()
  await expect(page).toHaveURL(/\/reparaciones\/pendientes\/reparar\/[^/]+$/)
  const urlFormulario = page.url()
  const formulario = page.getByRole('dialog', { name: /^Nueva reparación — IMEI / })
  await expect(formulario).toBeVisible()

  // Elegir modelo (si el teléfono ya lo trae, el combo llega bloqueado y con valor)
  const modelo = formulario.getByRole('combobox', { name: 'Filtrar por modelo' })
  if (await modelo.isEnabled()) {
    await modelo.click()
    await page.getByRole('option').first().click()
  }

  // Activar la primera fila que tenga stock
  const fila = formulario
    .locator('[data-testid^="fila-"]')
    .filter({ has: page.getByRole('button', { name: /^Sumar /, disabled: false }) })
    .first()
  await expect(fila).toBeVisible()
  const prefijo = ((await fila.getAttribute('data-testid')) ?? '').replace('fila-', '')
  await fila.getByRole('button', { name: /^Sumar / }).click()
  await expect(formulario.getByTestId(`contador-${prefijo}`)).toHaveText('1')

  // Cerrar: no pregunta y vuelca el borrador en ese momento
  const volcado = page.waitForResponse(esBorrador('PUT'))
  await formulario.getByRole('button', { name: 'Cerrar formulario' }).click()
  await volcado
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)

  // Reabrir por URL (mismo camino que F5): el borrador se recupera
  await page.goto(urlFormulario)
  await expect(formulario).toBeVisible()
  await expect(formulario.getByTestId('banda-borrador')).toContainText('✓ Borrador recuperado')
  await expect(formulario.getByTestId(`contador-${prefijo}`)).toHaveText('1')

  // "✓ Guardar fila" en dos clics
  const botonDerecho = formulario.getByTestId(`boton-derecho-${prefijo}`)
  await expect(botonDerecho).toHaveText('✓ Guardar fila')
  await botonDerecho.click()
  await expect(botonDerecho).toHaveText('✓ Confirmar')
  await botonDerecho.click()
  await expect(botonDerecho).toHaveText(/^✓ Guardada [0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}$/)

  // Solicitar pieza (local) en la fila sin stock. Al confirmar, data-variante pasa a "confirmada": la sub-fila se vuelve a
  // localizar por su data-testid, porque un localizador que filtre por "sinStock" dejaría de encontrarla.
  const sinStock = formulario.locator('[data-testid^="subfila-"][data-variante="sinStock"]').first()
  await expect(sinStock).toBeVisible()
  const subfila = formulario.getByTestId((await sinStock.getAttribute('data-testid')) ?? '')
  await subfila.getByRole('button', { name: 'Solicitar pieza' }).click()
  const solicitar = page.getByRole('dialog', { name: /^Solicitar pieza — / })
  await solicitar.getByPlaceholder('Describe la pieza que necesitas (opcional)...').fill('Smoke e2e')
  await solicitar.getByRole('button', { name: 'Confirmar: solicitar pieza' }).click()
  await expect(subfila).toHaveAttribute('data-variante', 'confirmada')
  await expect(subfila).toContainText('✓  Solicitud de reposición pendiente — Smoke e2e')

  // "Terminar asignación" en dos clics y vuelta a la lista
  const terminar = formulario.getByTestId('zona-guardar').getByRole('button')
  await expect(terminar).toHaveText('Terminar asignación')
  await terminar.click()
  await expect(terminar).toHaveText('✓  Confirmar terminar')
  await terminar.click()
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  await expect(formulario).toBeHidden()
})

/** Guion del supertécnico (spec §11): campana con badge, "Rechazar", "Recuperar", "Editar" desde Historial y salir sin guardar. */
test('supertécnico: campana con badge, rechazar y recuperar, editar y salir sin guardar', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)

  // La solicitud que dejó el técnico enciende el badge
  await expect(page.getByTestId('campana-badge')).toHaveText(/^[1-9][0-9]*$/)
  await page.getByTestId('campana').click()
  const panel = page.getByTestId('panel-notificaciones')
  await expect(panel).toBeVisible()
  await panel.getByRole('tab', { name: 'Solicitudes' }).click()

  const pendiente = panel.locator('[data-testid^="tarjeta-solicitud-"][data-grupo="pendiente"]').first()
  await expect(pendiente).toBeVisible()
  const idTarjeta = (await pendiente.getAttribute('data-testid')) ?? ''
  const tarjeta = panel.getByTestId(idTarjeta)
  await tarjeta.getByRole('button', { name: 'Rechazar' }).click()
  await expect(tarjeta).toHaveAttribute('data-grupo', 'rechazada')
  await tarjeta.getByRole('button', { name: 'Recuperar' }).click()
  await expect(tarjeta).toHaveAttribute('data-grupo', 'pendiente')
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // "Editar" desde el Historial
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  const primeraFila = page.getByRole('table').locator('tr[aria-selected]').first()
  await expect(primeraFila).toBeVisible()
  await primeraFila.getByRole('cell').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Editar' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial\/editar\/[^/]+$/)
  const edicion = page.getByRole('dialog', { name: /^Editar reparación — / })
  await expect(edicion).toBeVisible()

  // Con una pieza editada se provoca un cambio y se sale sin guardar; una acción "otro" no tiene fila editada y cierra sin más.
  // El cambio es la observación, el único control de la fila editada que está siempre habilitado ("Reutilizado" va
  // deshabilitado con cantidad > 0 y "+" con el stock a 0) y que nunca deja el cambio como inválido.
  const editada = edicion.locator('[data-estado="editada"]')
  if ((await editada.count()) > 0) {
    const papelera = editada.getByRole('button', { name: /^Borrar observación de / })
    if ((await papelera.count()) > 0) {
      await papelera.click()
    } else {
      await editada.getByRole('button', { name: 'Añadir observación' }).click()
      const observacion = page.getByRole('dialog', { name: /^Observación para: / })
      await observacion.getByRole('textbox', { name: 'Observación' }).fill('Smoke e2e')
      await observacion.getByRole('button', { name: 'Guardar', exact: true }).click()
    }
    await expect(edicion.getByTestId('zona-guardar')).toBeVisible()
    await edicion.getByRole('button', { name: 'Cerrar formulario' }).click()
    await page.getByRole('button', { name: 'Salir sin guardar' }).click()
  } else {
    await edicion.getByRole('button', { name: 'Cerrar formulario' }).click()
  }
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await expect(edicion).toBeHidden()
})
