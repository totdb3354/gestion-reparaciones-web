import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// esim-descripcion.spec.ts (0.9.24, spec 2026-11-03-v0924-esim-en-la-descripcion-design.md): la descripción del móvil dice
// «eSIM» detrás del modelo cuando NSYS lo dice, en IMEIs, en la barra del detalle del IMEI y en la ficha de NSYS, y no lo dice
// en un móvil con SIM física. Solo LEE: toma de la API un trabajo de un móvil eSIM y otro de uno sin eSIM (no se apunta ningún
// IMEI en el código) y mira las pantallas; no guarda nada ni limpia. Como todas las E2E, solo contra PREPRODUCCIÓN: se niega a
// seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

type Trabajo = { imei: string; modelo: string | null; capacidad: string | null; esEsim: boolean }

/** GET con el token de la sesión de la página (patrón de stock-telefonos.spec.ts). */
async function leer<T>(page: Page, ruta: string): Promise<T> {
  return page.evaluate(async (r) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(r, { headers: { Authorization: `Bearer ${sesion.token}` } })
    if (!res.ok) throw new Error(`GET ${r} respondió ${res.status}`)
    return res.json()
  }, ruta) as Promise<T>
}

/** Un texto tal cual dentro de una expresión regular. */
const literal = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('la descripción del móvil dice eSIM en IMEIs, en el detalle y en la ficha, y no en uno con SIM física', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)

  // Del historial del taller (todos los técnicos), un trabajo de un móvil eSIM y otro de uno sin eSIM, los dos con modelo del
  // taller, capacidad de NSYS y un IMEI de 15 cifras.
  const historial = await leer<Trabajo[]>(page, '/api/reparaciones/historial')
  const sirve = (t: Trabajo) => /^\d{15}$/.test(t.imei) && !!t.modelo && !!t.capacidad
  const esim = historial.find((t) => sirve(t) && t.esEsim)
  const sim = historial.find((t) => sirve(t) && !t.esEsim)
  test.skip(!esim || !sim, 'El historial de preprod no tiene un trabajo de un móvil eSIM y otro sin eSIM, con NSYS')

  for (const [t, esEsim] of [[esim!, true], [sim!, false]] as const) {
    const conEsim = new RegExp(`eSIM ${literal(t.capacidad!)}`)

    // IMEIs: la fila del grupo.
    await page.goto('/reparaciones/imeis')
    await page.getByPlaceholder('Filtrar por IMEI').fill(t.imei)
    const fila = page.getByRole('row').filter({ hasText: t.imei })
    await expect(fila).toHaveCount(1)
    await expect(fila).toContainText(t.capacidad!)
    if (esEsim) await expect(fila).toContainText(conEsim)
    else await expect(fila).not.toContainText(conEsim)

    // Detalle del IMEI: la barra «• descripción» y la ficha de NSYS.
    await page.goto(`/reparaciones/imeis/${encodeURIComponent(t.imei)}`)
    const barra = page.getByText(/^• iPhone /)
    await expect(barra).toContainText(t.capacidad!)
    const ficha = page.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toContainText(t.imei)
    if (esEsim) {
      await expect(barra).toContainText(conEsim)
      await expect(ficha).toContainText(conEsim)
    } else {
      await expect(barra).not.toContainText('eSIM')
      await expect(ficha).not.toContainText(conEsim)
    }
  }
})
