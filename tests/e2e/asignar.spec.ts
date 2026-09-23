import { expect, test, type Locator, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Prefijos de asignaciones (columnas.tsx:57 pinta `idRep` tal cual en la celda "Id Asignación"; tipoTrabajo.ts:13-14
 *  distingue Glass/Pulido por "AG"/"AP" delante de todo). Solo una Reparación puede llevar el prefijo "A" sin que le
 *  siga "G" o "P": es el único tipo que este test crea, así que basta para identificar la fila nueva sin duplicar
 *  `tipoDe` aquí (el e2e no importa código de la app). */
function esIdReparacion(idRep: string): boolean {
  return idRep.startsWith('A') && !idRep.startsWith('AG') && !idRep.startsWith('AP')
}

/** Filas con celda de id (DataTable.tsx:342 pone `data-columna="id"` en el `<td>`; la cabecera usa `<th>` y no
 *  matchea, así que no hace falta excluirla aparte), con su identificador ya leído. */
async function filasConId(page: Page): Promise<{ id: string; fila: Locator }[]> {
  const filas = await page.getByRole('row').all()
  const resultado: { id: string; fila: Locator }[] = []
  for (const fila of filas) {
    const celdaId = fila.locator('td[data-columna="id"]')
    if ((await celdaId.count()) === 0) continue
    const id = (await celdaId.textContent())?.trim() ?? ''
    if (id) resultado.push({ id, fila })
  }
  return resultado
}

/**
 * La(s) fila(s) de Reparación, del técnico dado, que NO estaban en `idsPrevios`. El guardado del modal solo bloquea
 * duplicados por técnico+IMEI+categoría (spec del modal de asignación), así que una Glass o un Pulido preexistentes
 * del mismo IMEI y técnico no bloquean la Reparación nueva: identificar la fila por texto (IMEI+técnico, como antes)
 * podía coincidir con esa fila preexistente y, con `.first()`, borrarla en producción. Filtrar por "no estaba antes"
 * + "es una Reparación" + "es de este técnico" la distingue sin ambigüedad.
 */
async function filasNuevasDeReparacion(page: Page, tecnico: string, idsPrevios: Set<string>): Promise<Locator[]> {
  const candidatas: Locator[] = []
  for (const { id, fila } of await filasConId(page)) {
    if (idsPrevios.has(id) || !esIdReparacion(id)) continue
    if ((await fila.filter({ hasText: tecnico }).count()) > 0) candidatas.push(fila)
  }
  return candidatas
}

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

  // Antes de tocar nada: filtra por el IMEI y guarda los ids que ya hubiera (de cualquier técnico o categoría). La
  // limpieza de más abajo solo podrá borrar un id que NO esté en este conjunto.
  await page.getByPlaceholder('Filtrar por IMEI').fill(imei!)
  const idsPrevios = new Set((await filasConId(page)).map((f) => f.id))

  await page.getByRole('button', { name: 'Asignar' }).click()
  const modal = page.getByRole('dialog', { name: 'Asignar trabajos' })
  await modal.getByPlaceholder('Escanea o escribe el IMEI (15 dígitos)...').fill(imei!)
  await expect(modal.getByTestId('imei-en-curso')).toHaveText(imei!)
  await expect(modal.getByRole('combobox', { name: 'Modelo de iPhone' })).not.toHaveValue('')
  await modal.getByRole('checkbox', { name: new RegExp(tecnico!) }).click()
  await modal.getByRole('button', { name: 'Asignar →' }).click()
  await modal.getByRole('button', { name: 'Guardar (1)' }).click()
  await expect(modal).toBeHidden()

  // Limpieza: solo la fila que ha creado ESTE test. El filtro de IMEI sigue puesto (BarraFiltros vive en la página,
  // el modal no lo toca), así que basta con volver a mirar qué id de Reparación es nuevo. Si no hay exactamente una
  // fila nueva identificada así, no se borra nada (mejor dejar basura de test que borrar una fila ajena).
  try {
    const nuevas = await filasNuevasDeReparacion(page, tecnico!, idsPrevios)
    expect(nuevas, `Se esperaba exactamente 1 fila nueva de Reparación para IMEI ${imei} / técnico ${tecnico}; hay ${nuevas.length}`).toHaveLength(1)
    await expect(nuevas[0]).toBeVisible()
  } finally {
    const nuevas = await filasNuevasDeReparacion(page, tecnico!, idsPrevios)
    if (nuevas.length === 1) {
      const fila = nuevas[0]
      // BotonPapelera.tsx: aria-label por defecto "Borrar asignación" (mismo texto que el botón de confirmación,
      // por eso el confirm se busca dentro de su diálogo: AsignacionesPage.tsx titula "Borrar asignación <idRep>").
      await fila.getByRole('button', { name: 'Borrar asignación' }).click()
      const confirmar = page.getByRole('dialog', { name: /^Borrar asignación/ })
      await confirmar.getByRole('button', { name: 'Borrar asignación' }).click()
      await expect(fila).toBeHidden()
    }
  }
})
