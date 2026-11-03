import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// aviso-no-nsys.spec.ts (0.9.23, spec 2026-11-03-v0923-aviso-no-esta-en-nsys-design.md): al picar un IMEI en «Asignar
// trabajos», el modal dice «no está en NSYS» si NSYS no lo conoce, y nada si lo conoce. Solo LEE: pica un IMEI inventado y uno
// real del espejo (el primero del stock), mira las marcas y cierra el modal con «Descartar»; no se guarda nada. Como todas las
// E2E, solo contra PREPRODUCCIÓN: se niega a seguir sin el letrero.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

/** Petición con el token de la sesión de la página (patrón de stock-telefonos.spec.ts y revisar-a-mano.spec.ts). */
async function pedir<T>(page: Page, metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
  return page.evaluate(async ({ metodo, ruta, cuerpo }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    if (!res.ok) throw new Error(`${metodo} ${ruta} respondió ${res.status}`)
    return res.json()
  }, { metodo, ruta, cuerpo }) as Promise<T>
}

test('el modal de asignación avisa de un IMEI que NSYS no conoce y no de uno que sí', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)

  // Uno real: el primero del stock con un IMEI de 15 cifras (el campo de escaneo solo admite cifras).
  const stock = await pedir<{ imeiSn: string }[]>(page, 'GET', '/api/stock-telefonos')
  const real = stock.map((m) => m.imeiSn).find((i) => /^\d{15}$/.test(i))
  test.skip(!real, 'El stock de preprod no tiene ningún IMEI de 15 cifras')
  // Uno inventado, distinto en cada pasada; se comprueba antes que NSYS no lo conoce.
  const inventado = '99' + String(Date.now()).slice(-13)
  const [comprobado] = await pedir<{ imei: string; encontrado: boolean }[]>(page, 'POST', '/api/stock-telefonos/comprobar', { imeis: [inventado] })
  expect(comprobado.encontrado, `el IMEI inventado ${inventado} no debería estar en NSYS`).toBe(false)

  await page.getByRole('button', { name: 'Asignar' }).click()
  const modal = page.getByRole('dialog', { name: 'Asignar trabajos' })
  const campo = modal.getByPlaceholder('Escanea o escribe el IMEI (15 dígitos)...')

  await campo.fill(inventado)
  await expect(modal.getByTestId('imei-en-curso')).toHaveText(inventado)
  await expect(modal.getByText(/^No está en NSYS/)).toBeVisible()
  await expect(modal.getByText('no está en NSYS', { exact: true })).toHaveCount(1)

  // La respuesta de NSYS del real se espera antes de mirar que no hay marca (registrada ANTES de picarlo).
  const respuestaReal = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/stock-telefonos/comprobar'
    && (r.request().postData() ?? '').includes(real!))
  await campo.fill(real!)
  await expect(modal.getByTestId('imei-en-curso')).toHaveText(real!)
  expect((await respuestaReal).ok()).toBe(true)
  await expect(modal.getByText(/^No está en NSYS/)).toHaveCount(0)
  await expect(modal.getByText('no está en NSYS', { exact: true })).toHaveCount(1) // la del inventado, que sigue en la cola

  // Cerrar sin guardar: Escape pide confirmación y «Descartar» cierra el modal.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Descartar' }).click()
  await expect(modal).toBeHidden()
})
