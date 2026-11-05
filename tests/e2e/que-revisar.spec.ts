import { expect, test } from '@playwright/test'
import { credenciales } from './credenciales.ts'
import { leerXlsx } from './xlsx.ts'

// que-revisar.spec.ts (0.9.25, spec 2026-11-04-v0925-que-revisar-design.md §3, §10 y §10.10): el supertécnico abre Stock de
// teléfonos → «Qué revisar», ve las dos tarjetas con su cifra y las columnas de «Revisar sin grado» (como «Solo n/a» de la hoja),
// descarga el Excel y, si hay algún modelo-color, lo despliega y ve un IMEI. Solo LEE: el Excel no toca la base, se guarda en una
// «Guardar como» falsa (en la memoria de la página) y no se apunta ningún IMEI en el código. Como todas las E2E, solo contra
// PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const COLUMNAS_TABLA = ['Modelo', 'Cap.', 'Color', 'Sin grado']
const COLUMNAS_EXCEL = ['Modelo', 'Capacidad', 'Color', 'Sin grado', 'Revisado']

type Guardado = { nombre: string; bytes: number[] }

/** «Guardar como» falsa, como en plantillas-nsys.spec.ts (Chromium sin cabeza no abre la de verdad): da un fichero con el nombre
 *  propuesto y apunta en `guardadosE2E` lo que la web escribe en él. Va como script de la página: sin nada de fuera. */
function guardarComoFalso() {
  const guardados: { nombre: string; bytes: number[] }[] = []
  Reflect.set(globalThis, 'guardadosE2E', guardados)
  Reflect.set(globalThis, 'showSaveFilePicker', async (opciones?: { suggestedName?: string }) => {
    const nombre = opciones?.suggestedName ?? 'sin-nombre'
    const partes: Blob[] = []
    return {
      name: nombre,
      createWritable: async () => ({
        write: async (b: Blob) => { partes.push(b) },
        close: async () => { guardados.push({ nombre, bytes: Array.from(new Uint8Array(await new Blob(partes).arrayBuffer())) }) },
        abort: async () => {},
      }),
    }
  })
}

test('«Qué revisar» enseña sus tarjetas y las columnas de «Revisar sin grado», descarga el Excel y despliega un modelo-color', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.addInitScript(guardarComoFalso)
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

  const excel = page.getByRole('button', { name: /^⬇ Descargar Excel/ })
  await expect(excel).toBeVisible()
  const tabla = page.getByRole('table', { name: 'Revisar sin grado' })
  if (await tabla.count() === 0) {
    await expect(page.getByText('Nada que revisar: ningún modelo-color con todo sin grado en stock.')).toBeVisible()
    return
  }
  await expect(tabla.getByRole('columnheader')).toHaveText(COLUMNAS_TABLA)

  const n = Number(/\((\d+)\)$/.exec((await excel.textContent()) ?? '')?.[1] ?? '0')
  if (n > 0) {
    const pedida = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/stock-telefonos/que-revisar/excel')
    await excel.click()
    expect((await pedida).status(), 'el Excel (servidor 0.9.25)').toBe(200)
    await expect(page.getByTestId('aviso-breve')).toContainText(`Descargado: ${n} modelo`)
    const guardado = await page.evaluate(() => (Reflect.get(globalThis, 'guardadosE2E') as Guardado[]).at(-1))
    expect(guardado?.nombre).toMatch(/^Que_revisar_sin_grado_\d{4}-\d{2}-\d{2}\.xlsx$/)
    const xlsx = leerXlsx(Buffer.from(guardado!.bytes))
    COLUMNAS_EXCEL.forEach((c, i) => expect(xlsx.celda(`${'ABCDE'[i]}1`).valor, `cabecera ${c}`).toBe(c))
    expect(xlsx.celda('F1').valor, 'cinco columnas: nada detrás de «Revisado»').toBeNull()
    expect(Number(xlsx.celda('D2').valor), 'una fila por modelo-color, con sus móviles sin grado').toBeGreaterThanOrEqual(1)
    expect(xlsx.filasConDatos(2, 'A'), 'una fila por modelo-color').toHaveLength(n)
  }

  const desplegar = page.getByRole('button', { name: /^Ver los móviles de / })
  await desplegar.first().click()
  await expect(desplegar.first()).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('table', { name: /^Móviles de / }).getByRole('button', { name: /^Abrir / }).first()).toBeVisible()
})
