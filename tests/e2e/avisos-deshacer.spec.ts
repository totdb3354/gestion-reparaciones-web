import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// avisos-deshacer.spec.ts (0.9.22 pieza 3): el aviso con «Deshacer» de Asignaciones lleva la barra que se consume y una × que lo
// cierra SIN deshacer. Solo contra PREPRODUCCIÓN (se niega sin el letrero) y con el móvil SINTÉTICO del guion de preprod (el de
// sku-taller.spec.ts: por defecto 350000000009921; otro con E2E_IMEI_TALLER): nunca uno real. Crea una asignación del propio
// supertécnico (E2E_USER), la marca urgente desde el menú de su fila, cierra el aviso con la × y comprueba que sigue urgente; al
// acabar borra todo lo del taller de ese IMEI.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_TALLER ?? '350000000009921'
const SIN_NADA = 'Este móvil no tiene nada del taller'
const MOTIVO = 'E2E 0.9.22 pieza 3: aviso con Deshacer'

type Respuesta = { estado: number; cuerpo: unknown }

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Una petición a la API con el token de la sesión de la página (patrón de sku-taller.spec.ts). */
async function pedir(page: Page, metodo: string, ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Promise<Respuesta> {
  return page.evaluate(async ({ metodo, ruta, cuerpo, cabeceras }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json', ...cabeceras },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const texto = await res.text()
    return { estado: res.status, cuerpo: texto ? (JSON.parse(texto) as unknown) : null }
  }, { metodo, ruta, cuerpo, cabeceras })
}

/** Lo del taller de ese IMEI fuera: las reparaciones (las R… antes que las asignaciones), el teléfono del lote y, por si quedó algo
 *  a mano, «Volver a lo de NSYS» (como sku-taller-reparacion.spec.ts). */
async function limpiar(page: Page) {
  const r = await pedir(page, 'GET', `/api/reparaciones/imei/${IMEI}`)
  expect(r.estado, `GET /api/reparaciones/imei/${IMEI}`).toBe(200)
  const ids = (r.cuerpo as { idRep: string }[]).map((x) => x.idRep)
  for (const idRep of [...ids.filter((id) => id.startsWith('R')), ...ids.filter((id) => !id.startsWith('R'))]) {
    const b = await pedir(page, 'DELETE', `/api/reparaciones/${idRep}`, { motivo: 'E2E: limpieza' })
    expect.soft(b.estado, `limpieza DELETE /api/reparaciones/${idRep}`).toBe(204)
  }
  const t = await pedir(page, 'DELETE', `/api/telefonos/${IMEI}`)
  expect.soft([204, 404], `limpieza DELETE /api/telefonos/${IMEI}`).toContain(t.estado)
  const v = await pedir(page, 'DELETE', `/api/stock-telefonos/${IMEI}/taller`, { motivo: 'E2E: limpieza' })
  const detalle = `limpieza del móvil de prueba: ${v.estado} ${JSON.stringify(v.cuerpo)}`
  expect.soft([204, 400], detalle).toContain(v.estado)
  if (v.estado === 400) expect.soft(JSON.stringify(v.cuerpo), `${detalle} (se esperaba «${SIN_NADA}»)`).toContain(SIN_NADA)
}

test.describe('0.9.22 pieza 3: el aviso con «Deshacer» de Asignaciones', () => {
  test.describe.configure({ mode: 'serial' })
  let pagina: Page
  // Solo true tras comprobar el letrero de preprod: sin eso la limpieza (DELETE) no corre.
  let enPreprod = false
  let idAsig: string

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    enPreprod = true
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `falta el móvil sintético ${IMEI} en el espejo de preprod (lo mete el guion)`).toBe(200)
    await limpiar(pagina)
    const idTec = await pagina.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
    expect(typeof idTec, 'idTec del supertécnico en la sesión').toBe('number')
    const lote = await pedir(pagina, 'POST', '/api/asignaciones/lote', {
      telefonos: [{ imei: IMEI, modelo: '13', idCli: null, clienteExplicito: false }],
      asignaciones: [{ imei: IMEI, categoria: 'R', idTec, comentario: MOTIVO, esChasis: false }],
    }, { 'Idempotency-Key': `e2e-avisos-deshacer-${Date.now()}` })
    expect(lote.estado, 'POST /api/asignaciones/lote').toBe(200)
    const creadas = (lote.cuerpo as { creadas: { idRep: string }[] }).creadas
    expect(creadas, 'una asignación de prueba').toHaveLength(1)
    idAsig = creadas[0].idRep
  })

  test.afterAll(async () => {
    try {
      if (pagina && enPreprod) await limpiar(pagina)
    } finally {
      await pagina?.close()
    }
  })

  test('«Marcar urgente» saca el aviso con la barra y la ×; la × lo cierra sin deshacer', async () => {
    await pagina.goto('/reparaciones/asignaciones')
    // Con la tabla cargada: «Actualizado HH:mm» solo sale con datos (como asignar.spec.ts).
    await expect(pagina.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible({ timeout: 30_000 })
    await pagina.getByPlaceholder('Filtrar por IMEI').fill(IMEI)
    const celdaId = pagina.locator('td[data-columna="id"]', { hasText: new RegExp(`^\\s*${escapar(idAsig)}\\s*$`) })
    await expect(celdaId, `la asignación de prueba ${idAsig}`).toHaveCount(1)
    await celdaId.click({ button: 'right' })
    await pagina.getByRole('menuitem', { name: 'Marcar urgente' }).click()

    const aviso = pagina.getByRole('status').filter({ hasText: `IMEI ${IMEI} marcado como urgente` })
    await expect(aviso).toBeVisible()
    await expect(aviso.getByRole('button', { name: 'Deshacer' })).toBeVisible()
    await expect(aviso.locator('.aviso-barra'), 'la barra que se consume en 8 s').toHaveCount(1)
    await aviso.getByRole('button', { name: 'Cerrar aviso' }).click()
    await expect(pagina.getByText(`IMEI ${IMEI} marcado como urgente`), 'la × cierra el aviso').toHaveCount(0)

    // Cerrar no deshace: la asignación sigue urgente.
    await expect.poll(async () => {
      const r = await pedir(pagina, 'GET', '/api/reparaciones/asignaciones')
      return (r.cuerpo as { idRep: string; urgente: boolean }[]).find((x) => x.idRep === idAsig)?.urgente
    }, { message: `${idAsig} sigue urgente tras cerrar el aviso` }).toBe(true)
  })
})
