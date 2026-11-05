import { expect, test } from '@playwright/test'
import { credenciales } from './credenciales.ts'
import { leerXlsx } from './xlsx.ts'

// que-revisar.spec.ts (0.9.25, spec 2026-11-04-v0925-que-revisar-design.md §3, §10 y §10.10): el supertécnico abre Stock de
// teléfonos → «Qué revisar», ve las dos tarjetas con su cifra y las columnas de «Revisar sin grado» (como «Solo n/a» de la hoja),
// descarga el Excel y, si hay algún modelo-color, lo elige y ve un IMEI en el panel de la derecha (§10.14). Solo LEE: el Excel
// no toca la base, se guarda en una «Guardar como» falsa (en la memoria de la página) y no se apunta ningún IMEI en el código.
// Como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
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

test('«Qué revisar» enseña sus tarjetas y las columnas de «Revisar sin grado», descarga el Excel y enseña un modelo-color en el panel', async ({ page }) => {
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
  // Dos bloques (spec §10.13): al menos una fila de título, la de «3 o más» o la de «Menos de 3».
  await expect(tabla.getByRole('row').filter({ hasText: /^(3 o más|Menos de 3) sin revisar ·/ }).first()).toBeVisible()

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
    expect(typeof xlsx.celda('D2').valor, 'Sin grado como número (§10.15)').toBe('number')
    expect(Number(xlsx.celda('D2').valor), 'una fila por modelo-color, con sus móviles sin grado').toBeGreaterThanOrEqual(1)
    expect(xlsx.filasConDatos(2, 'A'), 'una fila por modelo-color').toHaveLength(n)
  }

  // El panel de la derecha (spec §10.14): sin elegir, cómo elegir; al pulsar la primera fila de modelo-color (en la fila, no en su
  // botón), su título empieza por la descripción y enseña al menos un IMEI. Nada se despliega dentro de la tabla.
  const panel = page.getByRole('region', { name: 'Móviles del modelo-color' })
  await expect(panel).toHaveText('Pulsa un modelo-color para ver sus móviles.')
  const fila = tabla.getByRole('row').filter({ has: page.getByRole('button', { name: /^Ver los móviles de / }) }).first()
  const boton = fila.getByRole('button', { name: /^Ver los móviles de / })
  const descripcion = ((await boton.getAttribute('aria-label')) ?? '').replace(/^Ver los móviles de /, '')
  expect(descripcion, 'la descripción del primer modelo-color').not.toBe('')
  await expect(boton).not.toHaveAttribute('aria-current')
  const filasAntes = await tabla.getByRole('row').count()
  await fila.getByRole('cell').nth(2).click() // el color
  await expect(boton).toHaveAttribute('aria-current', 'true')
  const titulo = panel.getByRole('heading')
  await expect(titulo).toHaveText(/ · \d+ sin grado/)
  expect((await titulo.textContent())?.startsWith(`${descripcion} · `), `el título empieza por «${descripcion}»`).toBe(true)
  await expect(panel.getByRole('table', { name: `Móviles de ${descripcion}` }).getByRole('button', { name: /^Abrir / }).first()).toBeVisible()
  expect(await tabla.getByRole('row').count(), 'la tabla no se despliega').toBe(filasAntes)
})
