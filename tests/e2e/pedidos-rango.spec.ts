import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// pedidos-rango.spec.ts (0.9.38, spec 2026-11-23 «rango estricto»): con «Rango…», la tabla de Pedidos enseña solo las filas de esas
// fechas; los pendientes de otras fechas (que el servidor sigue mandando) salen en el aviso y «Ver» los enseña solos. SOLO LEE: usa
// las filas que haya en preprod y calcula lo esperado desde /api/pedidos/filas. Solo contra PREPRODUCCIÓN (se niega sin el letrero).
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

type Fila = { idFila: number; fecha: string; estado: string; marca: string | null; faltaEnviarEn: string | null }

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

async function filasApi(page: Page, desde: string, hasta: string): Promise<Fila[]> {
  return page.evaluate(async ([d, h]) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(`/api/pedidos/filas?desde=${d}&hasta=${h}`, { headers: { Authorization: `Bearer ${sesion.token}` } })
    return ((await res.json()) as { filas: Fila[] }).filas
  }, [desde, hasta] as const)
}

/** Lo que la web cuenta como pendiente (`esPendiente`): pendiente en el servidor o envío parcial, nunca cancelada. */
const esPendiente = (f: Fila) =>
  f.marca !== 'CANCELADO' && (f.estado === 'PENDIENTE' || (f.estado === 'ENVIADA' && !!f.faltaEnviarEn) || !['ENVIADA', 'NO_PENDIENTE', 'HISTORICO'].includes(f.estado))

/** Día de Madrid de hoy menos `n` días (yyyy-mm-dd). */
const diaMadrid = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

test('«Rango…» enseña solo esas fechas; el aviso cuenta los pendientes de fuera y «Ver» los enseña', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  await page.goto('/telefonos/pedidos')
  await expect(page.getByRole('group', { name: 'Contadores' })).toBeVisible()

  // Los dos últimos días: lo normal es que queden pendientes más antiguos fuera.
  const desde = diaMadrid(1), hasta = diaMadrid(0)
  const recibidas = await filasApi(page, desde, hasta)
  const dentro = recibidas.filter((f) => f.fecha.slice(0, 10) >= desde && f.fecha.slice(0, 10) <= hasta)
  const fuera = recibidas.filter((f) => !(f.fecha.slice(0, 10) >= desde && f.fecha.slice(0, 10) <= hasta) && esPendiente(f))
  console.log(`rango ${desde}..${hasta}: recibidas ${recibidas.length}, del periodo ${dentro.length}, pendientes de fuera ${fuera.length}`)

  await page.getByLabel('Periodo:').selectOption('Rango…')
  await page.getByLabel('Desde:').fill(desde)
  await page.getByLabel('Hasta:').fill(hasta)
  const contadores = page.getByRole('group', { name: 'Contadores' })
  await expect(contadores.getByRole('button', { name: `${dentro.length} filas` })).toBeVisible()

  const aviso = page.getByRole('status', { name: 'Pendientes fuera del periodo' })
  if (fuera.length === 0) {
    await expect(aviso).toHaveCount(0)
    test.info().annotations.push({ type: 'aviso', description: 'Sin pendientes fuera del rango en preprod: no se ha podido probar «Ver»' })
    return
  }
  await expect(aviso).toContainText(`Hay ${fuera.length} ${fuera.length === 1 ? 'pendiente' : 'pendientes'}`)
  await aviso.getByRole('button', { name: 'Ver' }).click()
  await expect(contadores.getByRole('button', { name: `${fuera.length} filas` })).toBeVisible()
  await expect(contadores.getByRole('button', { name: `${fuera.length} pendientes` })).toBeVisible()
  await expect(aviso).toHaveCount(0)
  await page.getByRole('button', { name: 'Quitar filtro Pendientes fuera del periodo' }).click()
  await expect(contadores.getByRole('button', { name: `${dentro.length} filas` })).toBeVisible()
  await expect(aviso).toBeVisible()

  // Deja el periodo como estaba por defecto para la sesión (el estado vive en memoria; no hace falta, pero no molesta).
  await page.getByLabel('Periodo:').selectOption('Último mes')
})
