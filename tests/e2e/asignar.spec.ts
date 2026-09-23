import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Forma de la respuesta de POST /api/asignaciones/lote (schema.d.ts: LoteAsignacionesRespuesta). Se repite aquí a
 *  mano porque el e2e no importa código de la app. */
type RespuestaLote = {
  creadas: { idRep: string; imei: string; idTec: number; categoria: string }[]
  conflictos: unknown[]
}

/** Ids de las filas pintadas (DataTable.tsx pone `data-columna="id"` en el `<td>`; la cabecera usa `<th>`). */
async function idsPintados(page: Page): Promise<string[]> {
  const celdas = await page.locator('td[data-columna="id"]').allTextContents()
  return celdas.map((t) => t.trim()).filter(Boolean)
}

/** La fila cuya celda de id es EXACTAMENTE `idRep` (columnas.tsx pinta `idRep` tal cual en "Id Asignación"). */
function filaDeId(page: Page, idRep: string) {
  const exacto = new RegExp(`^\\s*${idRep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`)
  return page.getByRole('row').filter({ has: page.locator('td[data-columna="id"]', { hasText: exacto }) })
}

/**
 * ESCRIBE en el entorno de destino: crea UNA asignación de Reparación (IMEI de prueba + técnico de prueba) y la borra.
 * La fila a borrar se identifica por el `idRep` que devuelve el propio POST del lote, nunca por texto ni por diferencia
 * de la tabla: si el guardado no crea exactamente esa única Reparación (conflicto porque ya existía, o cualquier otra
 * cosa), el test falla SIN limpiar nada — mejor dejar basura de test que borrar una fila ajena.
 */
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

  // La tabla tiene que estar CARGADA antes de mirar qué ids hay: "Actualizado HH:mm" solo aparece con datos
  // (EtiquetaActualizado pinta '' mientras dataUpdatedAt es 0). Con la tabla aún vacía, el conjunto de ids previos
  // saldría vacío y no serviría como salvaguarda.
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()
  await page.getByPlaceholder('Filtrar por IMEI').fill(imei!)
  const idsPrevios = new Set(await idsPintados(page))

  await page.getByRole('button', { name: 'Asignar' }).click()
  const modal = page.getByRole('dialog', { name: 'Asignar trabajos' })
  await modal.getByPlaceholder('Escanea o escribe el IMEI (15 dígitos)...').fill(imei!)
  await expect(modal.getByTestId('imei-en-curso')).toHaveText(imei!)
  await expect(modal.getByRole('combobox', { name: 'Modelo de iPhone' })).not.toHaveValue('')
  await modal.getByRole('checkbox', { name: new RegExp(tecnico!) }).click()
  await modal.getByRole('button', { name: 'Asignar →' }).click()

  // Ambas esperas se registran ANTES del click: `waitForResponse` solo atrapa respuestas posteriores al registro.
  // - el POST del lote, para saber qué ha creado el servidor (y solo eso se borra);
  // - el refetch de /api/reparaciones/asignaciones que dispara la invalidación tras el éxito (modal/api.ts).
  const respuestaLote = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/asignaciones/lote' && r.request().method() === 'POST',
  )
  const recargaAsignaciones = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/reparaciones/asignaciones' && r.ok())
  await modal.getByRole('button', { name: 'Guardar (1)' }).click()

  const respuesta = await respuestaLote
  expect(respuesta.ok(), `POST /api/asignaciones/lote respondió ${respuesta.status()}`).toBe(true)
  const lote = (await respuesta.json()) as RespuestaLote
  const creadas = lote.creadas ?? []
  // Sin creada (conflicto: ya existía esa Reparación de este IMEI y técnico) o con algo distinto de UNA Reparación de
  // este IMEI → fallo inmediato y SIN limpieza. Los ids van en el mensaje por si hay que revisarlos a mano.
  if (creadas.length !== 1 || creadas[0].imei !== imei || creadas[0].categoria !== 'R' || idsPrevios.has(creadas[0].idRep)) {
    throw new Error(
      `El lote no creó exactamente una Reparación nueva para el IMEI de prueba; no se limpia nada. ` +
        `creadas=${JSON.stringify(creadas)} conflictos=${JSON.stringify(lote.conflictos ?? [])}`,
    )
  }
  const idCreado = creadas[0].idRep

  try {
    await expect(modal).toBeHidden()
    await recargaAsignaciones
    await expect(filaDeId(page, idCreado)).toHaveCount(1)
    await expect(filaDeId(page, idCreado)).toContainText(tecnico!)
  } finally {
    // Limpieza: SOLO la fila cuyo id es el que devolvió el servidor. Si tras el plazo no está pintada exactamente
    // una vez, no se borra nada (el fallo de arriba ya lo habrá señalado).
    const fila = filaDeId(page, idCreado)
    let pintada: boolean
    try {
      await expect(fila).toHaveCount(1, { timeout: 10_000 })
      pintada = true
    } catch {
      pintada = false
    }
    if (pintada) {
      // BotonPapelera.tsx: aria-label por defecto "Borrar asignación" (mismo texto que el botón de confirmación,
      // por eso el confirm se busca dentro de su diálogo: AsignacionesPage.tsx titula "Borrar asignación <idRep>").
      await fila.getByRole('button', { name: 'Borrar asignación' }).click()
      const confirmar = page.getByRole('dialog', { name: `Borrar asignación ${idCreado}` })
      await confirmar.getByRole('button', { name: 'Borrar asignación' }).click()
      await expect(fila).toHaveCount(0)
    }
  }
})
