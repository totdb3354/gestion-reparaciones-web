import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// fuera-de-su-caja.spec.ts (0.9.31, spec «Fuera de su caja»): con los datos de preprod (la copia de producción), el supertécnico
// abre «Stock de teléfonos» → «Por pasar a NSYS» y comprueba la quinta tarjeta contra lo que da la API (`cajas` de las tarjetas): el
// número de móviles, la lista agrupada por la caja que toca («Llevar a «CF021»») y «Copiar IMEIs» de la primera caja (el portapapeles
// lleva los IMEIs de ese grupo, uno por línea, y sale el aviso). Solo LEE: no escribe nada, así que no deja nada que limpiar. Solo
// contra PREPRODUCCIÓN (se niega sin el letrero). Necesita el servidor de esta versión: con uno anterior `cajas` no existe y la
// prueba solo comprueba la tarjeta a 0.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

type FilaCaja = { imeiSn: string; cajaQueToca: string }
type Tarjetas = { cajas?: FilaCaja[] }

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

async function pedir(page: Page, metodo: string, ruta: string, cuerpo?: unknown): Promise<{ estado: number; cuerpo: unknown }> {
  return page.evaluate(async ({ metodo, ruta, cuerpo }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(ruta, {
      method: metodo, headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const texto = await res.text()
    return { estado: res.status, cuerpo: texto ? (JSON.parse(texto) as unknown) : null }
  }, { metodo, ruta, cuerpo })
}

test.describe('«Fuera de su caja» en preprod', () => {
  test('la tarjeta, la lista por caja y «Copiar IMEIs» dan lo que da la API', async ({ page, context }) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    await entrar(page, usuario, clave)
    await page.goto('/telefonos/stock')
    await page.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
    const t = (await pedir(page, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')).cuerpo as Tarjetas
    const cajas = t.cajas ?? []

    await expect(page.getByRole('article', { name: 'Fuera de su caja' })).toContainText(`${cajas.length} ${cajas.length === 1 ? 'móvil' : 'móviles'}`)
    await page.getByRole('button', { name: 'Fuera de su caja' }).click()
    const tabla = page.getByRole('table', { name: 'Fuera de su caja' })
    await expect(tabla).toBeVisible()
    if (cajas.length === 0) {
      await expect(tabla).toContainText('No hay móviles F, FD o RMA fuera de su caja.')
      return
    }

    // Los grupos, en el orden en que aparece cada caja en la API.
    const grupos = new Map<string, string[]>()
    for (const f of cajas) grupos.set(f.cajaQueToca, [...(grupos.get(f.cajaQueToca) ?? []), f.imeiSn])
    for (const [caja, imeis] of grupos) {
      await expect(tabla).toContainText(`Llevar a «${caja}»`)
      await expect(page.getByRole('button', { name: `Copiar IMEIs para ${caja}` }), caja).toHaveText(`Copiar IMEIs (${imeis.length})`)
    }

    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const [caja, imeis] = [...grupos.entries()][0]
    await page.getByRole('button', { name: `Copiar IMEIs para ${caja}` }).click()
    const copiado = await page.evaluate(() => (navigator as Navigator & { clipboard: { readText(): Promise<string> } }).clipboard.readText())
    expect(copiado.split(/\r?\n/), 'los IMEIs del primer grupo, uno por línea, en el orden de la API').toEqual(imeis)
    await expect(page.getByTestId('aviso-breve')).toContainText(
      `Copiado: ${imeis.length} ${imeis.length === 1 ? 'IMEI' : 'IMEIs'} para «${caja}». Búscalos en NSYS y cámbiales la «Location»`)
  })
})
