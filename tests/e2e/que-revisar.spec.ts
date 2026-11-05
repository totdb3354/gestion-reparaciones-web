import { expect, test } from '@playwright/test'
import { credenciales } from './credenciales.ts'
import { leerXlsx } from './xlsx.ts'

// que-revisar.spec.ts (0.9.25, spec 2026-11-04-v0925-que-revisar-design.md §3 y §10): el supertécnico abre Stock de teléfonos →
// «Qué revisar», ve las dos tarjetas con su cifra, la columna «Pedidos 15 d»
// (y mide lo que tarda GET …/vendidos con el histórico entero), descarga el Excel y, si hay algún modelo-color, lo despliega
// y ve un IMEI. Solo LEE: los vendidos y el Excel no tocan la base, el Excel se guarda en una «Guardar como» falsa (en la memoria
// de la página) y no se apunta ningún IMEI en el código. Como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el
// letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const COLUMNAS_EXCEL = ['Modelo', 'Capacidad', 'Color', 'IMEI', 'Ubicación', 'Días en stock', 'Pedidos 15 d', 'Revisado']

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

test('«Qué revisar» enseña sus tarjetas, «Pedidos 15 d», descarga el Excel y despliega un modelo-color', async ({ page }) => {
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
  const vendidos = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/stock-telefonos/vendidos')
  const antes = Date.now()
  await pestana.click()
  const respuesta = await vendidos
  await respuesta.finished()
  const ms = Date.now() - antes
  console.log(`GET /api/stock-telefonos/vendidos: ${ms} ms`)
  expect(respuesta.status(), 'los vendidos (servidor 0.9.25)').toBe(200)
  expect(ms, 'los vendidos, por debajo del límite de 15 s').toBeLessThan(15_000)
  await expect(pestana).toHaveAttribute('aria-pressed', 'true')
  for (const nombre of ['Revisar sin grado', 'Subir B a A'])
    await expect(page.getByRole('article', { name: nombre })).toContainText(/\d+ modelos?-color · \d+ móvil(es)?/)

  const excel = page.getByRole('button', { name: /^⬇ Descargar Excel/ })
  await expect(excel).toBeVisible()
  const tabla = page.getByRole('table', { name: 'Revisar sin grado' })
  if (await tabla.count() === 0) {
    await expect(page.getByText('Nada que revisar: ningún móvil sin grado en stock.')).toBeVisible()
    return
  }
  await expect(tabla.getByRole('columnheader', { name: 'Pedidos 15 d', exact: true })).toBeVisible()

  const n = Number(/\((\d+)\)$/.exec((await excel.textContent()) ?? '')?.[1] ?? '0')
  if (n > 0) {
    const pedida = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/stock-telefonos/que-revisar/excel')
    await excel.click()
    expect((await pedida).status(), 'el Excel (servidor 0.9.25)').toBe(200)
    await expect(page.getByTestId('aviso-breve')).toContainText(`Descargado: ${n} móvil`)
    const guardado = await page.evaluate(() => (Reflect.get(globalThis, 'guardadosE2E') as Guardado[]).at(-1))
    expect(guardado?.nombre).toMatch(/^Que_revisar_sin_grado_\d{4}-\d{2}-\d{2}\.xlsx$/)
    const xlsx = leerXlsx(Buffer.from(guardado!.bytes))
    COLUMNAS_EXCEL.forEach((c, i) => expect(xlsx.celda(`${'ABCDEFGH'[i]}1`).valor, `cabecera ${c}`).toBe(c))
    expect(xlsx.filasConDatos(2, 'D'), 'una fila por móvil, con su IMEI').toHaveLength(n)
  }

  const desplegar = page.getByRole('button', { name: /^Ver los móviles de / })
  await desplegar.first().click()
  await expect(desplegar.first()).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('table', { name: /^Móviles de / }).getByRole('button', { name: /^Abrir / }).first()).toBeVisible()
})
