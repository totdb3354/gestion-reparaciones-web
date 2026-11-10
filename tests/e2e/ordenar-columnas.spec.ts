import { expect, test, type Locator } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// ordenar-columnas.spec.ts (0.9.28, spec 2026-11-10-v0928-ordenar-columnas-design.md): el supertécnico abre Stock de teléfonos,
// ordena la tabla de móviles por «Días» (mayor a menor, menor a mayor y vuelta al orden de siempre) y, en «Qué revisar», la tabla
// «Subir B a A» por «B». Solo LEE: no escribe nada ni apunta ningún IMEI en el código.
// Como todas las E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

/** Los números de una columna, fila a fila; null donde la celda no empieza por un número («—» o vacía). */
async function numeros(tabla: Locator, columna: string): Promise<(number | null)[]> {
  const cabeceras = (await tabla.getByRole('columnheader').allTextContents()).map((c) => c.replace(/[▲▼]/, '').trim())
  const i = cabeceras.indexOf(columna)
  expect(i, `la columna «${columna}»`).toBeGreaterThanOrEqual(0)
  const filas = await tabla.getByRole('row').filter({ has: tabla.page().getByRole('cell') }).all()
  const valores: (number | null)[] = []
  for (const fila of filas) {
    const celdas = await fila.getByRole('cell').allTextContents()
    if (celdas.length <= i) continue // una fila de título de bloque
    const n = /^\d+/.exec(celdas[i].trim())
    valores.push(n ? Number(n[0]) : null)
  }
  return valores
}

/** Ordenados (de mayor a menor si `desc`), con los vacíos al final. */
function ordenados(valores: (number | null)[], desc: boolean): boolean {
  const primeroVacio = valores.indexOf(null)
  const conValor = (primeroVacio === -1 ? valores : valores.slice(0, primeroVacio)) as number[]
  if (primeroVacio !== -1 && valores.slice(primeroVacio).some((v) => v !== null)) return false
  return conValor.every((v, i) => i === 0 || (desc ? conValor[i - 1] >= v : conValor[i - 1] <= v))
}

test('Stock de teléfonos: la tabla de móviles se ordena por «Días» y «Subir B a A» por «B»', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)

  await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Stock de teléfonos', exact: true }).click()
  await expect(page.getByText(/^\d+ móviles? en stock$/)).toBeVisible()

  // Móviles: el modelo que sale abierto.
  const moviles = page.getByRole('region', { name: 'Tabla de móviles' })
  const dias = moviles.getByRole('columnheader', { name: 'Días' })
  await expect(dias).toBeVisible()
  await expect(dias).not.toHaveAttribute('aria-sort')
  const deSiempre = await numeros(moviles, 'Días')
  await moviles.getByRole('button', { name: 'Días' }).click()
  await expect(dias).toHaveAttribute('aria-sort', 'descending')
  await expect(dias).toContainText('▼')
  expect(ordenados(await numeros(moviles, 'Días'), true), 'Días de mayor a menor, sin días al final').toBe(true)
  await moviles.getByRole('button', { name: 'Días' }).click()
  await expect(dias).toHaveAttribute('aria-sort', 'ascending')
  await expect(dias).toContainText('▲')
  expect(ordenados(await numeros(moviles, 'Días'), false), 'Días de menor a mayor, sin días al final').toBe(true)
  await moviles.getByRole('button', { name: 'Días' }).click()
  await expect(dias).not.toHaveAttribute('aria-sort')
  expect(await numeros(moviles, 'Días'), 'el tercer clic vuelve al orden de siempre').toEqual(deSiempre)

  // «Qué revisar» → «Subir B a A», por «B». El orden puesto en Móviles se queda al volver.
  await moviles.getByRole('button', { name: 'Días' }).click()
  await page.getByRole('button', { name: /^Qué revisar \(\d+\)$/ }).click()
  await page.getByRole('article', { name: 'Subir B a A' }).click()
  const subir = page.getByRole('table', { name: 'Subir B a A' })
  if (await subir.count() > 0) {
    const b = subir.getByRole('columnheader', { name: 'B', exact: true })
    await subir.getByRole('button', { name: 'B', exact: true }).click()
    await expect(b).toHaveAttribute('aria-sort', 'descending')
    expect(ordenados(await numeros(subir, 'B'), true), 'B de mayor a menor').toBe(true)
    await subir.getByRole('button', { name: 'B', exact: true }).click()
    await expect(b).toHaveAttribute('aria-sort', 'ascending')
    expect(ordenados(await numeros(subir, 'B'), false), 'B de menor a mayor').toBe(true)
    await subir.getByRole('button', { name: 'B', exact: true }).click()
    await expect(b).not.toHaveAttribute('aria-sort')
  }
  await page.getByRole('button', { name: 'Móviles', exact: true }).click()
  await expect(moviles.getByRole('columnheader', { name: 'Días' })).toHaveAttribute('aria-sort', 'descending')
})
