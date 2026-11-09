import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// ignorar-nsys.spec.ts (0.9.27, spec «ignorar» §6): con los móviles que han vuelto de los datos de preprod (la copia de
// producción), el supertécnico ignora uno desde la pantalla (sale de Color, Grado y Revisar, y de sus números, y está en «Ver
// ignorados»), lo deshace y vuelve. Si no hay ningún móvil que haya vuelto, se salta. Solo contra PREPRODUCCIÓN (se niega sin el
// letrero) y lo deja como estaba: sin ignorado, también si falla (las líneas del registro de actividad las borra el guion de
// preprod). El «trabajo nuevo» lo cubren las pruebas del servidor.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

type ConVuelta = { imeiSn: string; vueltoDesde: string | null; hechoEn?: string | null; hechoVolvio?: string | null; ignoradoAntesEn?: string | null }
type Tarjetas = { color: ConVuelta[]; grado: ConVuelta[]; revisar: ConVuelta[]; sinGrado: ConVuelta[]; ignorados?: { imeiSn: string; tarjetas: string[] }[] }

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

const tarjetasApi = async (page: Page) => (await pedir(page, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')).cuerpo as Tarjetas
const enAlguna = (t: Tarjetas, imei: string) => [t.color, t.grado, t.revisar, t.sinGrado].some((l) => l.some((f) => f.imeiSn === imei))

/** Un móvil que ha vuelto de Color o Grado sin marca «Hecho» (ahí está el enlace al lado de «Hecho»), con su tarjeta. */
function elegir(t: Tarjetas): { imei: string; tarjeta: 'Cambio de color' | 'Cambio de grado' } | null {
  const libre = (f: ConVuelta) => f.vueltoDesde && !f.ignoradoAntesEn && (!f.hechoEn || f.hechoVolvio)
  const color = t.color.find(libre)
  if (color) return { imei: color.imeiSn, tarjeta: 'Cambio de color' }
  const grado = t.grado.find(libre)
  return grado ? { imei: grado.imeiSn, tarjeta: 'Cambio de grado' } : null
}

test.describe('0.9.27: «ignorar» en los vendidos y de baja que salen en ámbar', () => {
  test('ignorar lo quita de las tres tarjetas y de sus números; «Ver ignorados» y «deshacer» lo devuelven', async ({ page }) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    await entrar(page, usuario, clave)
    await page.goto('/telefonos/stock')
    await page.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
    const antes = await tarjetasApi(page)
    const elegido = elegir(antes)
    test.skip(!elegido, 'preprod no tiene ningún móvil que haya vuelto en Color o Grado sin marca')
    const { imei, tarjeta } = elegido!
    try {
      await page.getByRole('button', { name: tarjeta, exact: true }).click()
      await page.getByRole('button', { name: `Ignorar ${imei}` }).click()
      await expect(page.getByTestId('aviso-breve')).toContainText(`Ignorado «${imei}»`)
      await expect(page.getByRole('button', { name: `Ignorar ${imei}` })).toHaveCount(0)
      const despues = await tarjetasApi(page)
      expect(enAlguna(despues, imei)).toBe(false)
      const fila = (despues.ignorados ?? []).find((f) => f.imeiSn === imei)
      expect(fila, 'sale en ignorados').toBeTruthy()
      await page.getByRole('button', { name: /^Ver ignorados \(\d+\)$/ }).click()
      await expect(page.getByRole('table', { name: 'Ignorados' })).toContainText(imei)
      await page.getByRole('button', { name: `Deshacer ignorar ${imei}` }).click()
      await expect(page.getByTestId('aviso-breve')).toContainText(`«${imei}» vuelve a las listas`)
      await expect(page.getByRole('button', { name: `Ignorar ${imei}` })).toBeVisible()
      expect(enAlguna(await tarjetasApi(page), imei)).toBe(true)
    } finally {
      await pedir(page, 'DELETE', '/api/stock-telefonos/por-pasar/ignorado', { imeiSn: imei })
    }
  })
})
