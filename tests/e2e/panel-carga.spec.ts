import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/**
 * Panel flotante «Carga de técnicos» (0.9.20, spec raíz 2026-10-20). Solo contra PREPRODUCCIÓN: se niega a seguir sin el
 * letrero. ESCRIBE: con E2E_USER crea por la API una asignación de Reparación de un IMEI sintético («000000» + marca de
 * tiempo) para el técnico E2E_TEC_PRUEBA («otro PC») y la borra desde la tabla de Asignaciones (lo propio, al momento).
 * afterAll borra por la API lo que quede de ese IMEI: la asignación y el teléfono. En fin de semana no hay jornada y la carga
 * no se mide, así que el test de la actualización se salta.
 */
test.describe.configure({ mode: 'serial' })

// Navegador limpio: la configuración siembra el panel cerrado para las demás E2E; aquí se prueba desde lo de fábrica.
test.use({ storageState: { cookies: [], origins: [] } })

const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'

/** Forma de la respuesta de POST /api/asignaciones/lote (se repite a mano: el e2e no importa código de la app). */
type RespuestaLote = { creadas: { idRep: string; imei: string; idTec: number; categoria: string }[]; conflictos: unknown[] }

let api: { ctx: APIRequestContext; headers: Record<string, string> } | null = null
let creada: { imei: string; idRep: string } | null = null

const imeiSintetico = () => `000000${String(Date.now()).slice(-9)}`
const panel = (page: Page) => page.getByRole('region', { name: 'Carga de técnicos' })
const pastilla = (page: Page) => page.getByTestId('pastilla-carga')

test.beforeAll(async ({ playwright }, testInfo) => {
  const usuario = process.env.E2E_USER
  const clave = process.env.E2E_PASS
  if (!usuario || !clave) return // los tests se saltan con credenciales()
  const ctx = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  const login = await ctx.post('/api/auth/login', { data: { usuario, password: clave } })
  expect(login.status(), 'POST /api/auth/login (supertécnico, por API)').toBe(200)
  const { token } = (await login.json()) as { token: string }
  api = { ctx, headers: { Authorization: `Bearer ${token}` } }
})

test.afterAll(async () => {
  const sesion = api
  const restante = creada
  api = null
  creada = null
  if (!sesion) return
  try {
    if (!restante) return
    const ruta = `/api/reparaciones/asignaciones/${restante.idRep}`
    const abierta = await sesion.ctx.get(ruta, { headers: sesion.headers })
    if (abierta.ok()) {
      const r = await sesion.ctx.delete(ruta, { headers: sesion.headers, data: { motivo: 'Limpieza del smoke e2e' } })
      expect.soft(r.status(), `limpieza DELETE ${ruta}`).toBe(204)
    }
    // Al borrar su única asignación el teléfono puede haberse ido ya con ella: 404 también vale.
    const rutaTelefono = `/api/telefonos/${restante.imei}`
    const borrado = await sesion.ctx.delete(rutaTelefono, { headers: sesion.headers })
    expect.soft([204, 404], `limpieza DELETE ${rutaTelefono}`).toContain(borrado.status())
  } finally {
    await sesion.ctx.dispose()
  }
})

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

async function idDeTecnico(nombre: string): Promise<number> {
  const r = await api!.ctx.get('/api/tecnicos/activos', { headers: api!.headers })
  expect(r.status(), 'GET /api/tecnicos/activos').toBe(200)
  const tec = ((await r.json()) as { idTec: number; nombre: string }[]).find((t) => t.nombre === nombre)
  if (!tec) throw new Error(`No hay un técnico activo llamado «${nombre}» (E2E_TEC_PRUEBA)`)
  return tec.idTec
}

/** «Otro PC»: la asignación entra por la API, no por la página que mira el panel. */
async function crearAsignacion(idTec: number): Promise<{ imei: string; idRep: string }> {
  const imei = imeiSintetico()
  const respuesta = await api!.ctx.post('/api/asignaciones/lote', {
    headers: { ...api!.headers, 'Idempotency-Key': `e2e-panel-carga-${imei}` },
    data: {
      telefonos: [{ imei, modelo: '13', idCli: null, clienteExplicito: false }],
      asignaciones: [{ imei, categoria: 'R', idTec, comentario: 'e2e panel de carga', esChasis: false }],
    },
  })
  expect(respuesta.status(), 'POST /api/asignaciones/lote').toBe(200)
  const lote = (await respuesta.json()) as RespuestaLote
  const rep = lote.creadas.find((c) => c.categoria === 'R' && c.imei === imei)
  if (!rep) throw new Error(`El lote no creó la Reparación del IMEI de prueba: ${JSON.stringify(lote)}`)
  test.info().annotations.push({ type: 'e2e-creado', description: `${rep.idRep} / IMEI ${imei}` })
  return { imei, idRep: rep.idRep }
}

test('el panel recuerda estado, sitio y alcance al recargar, y «Carga técnicos» lo vuelve a abrir', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.setViewportSize({ width: 1366, height: 768 })
  await entrar(page, usuario, clave)
  // Navegador limpio: de fábrica, abierto arriba a la derecha, bajo la barra azul.
  await expect(panel(page)).toBeVisible()
  const inicio = (await panel(page).boundingBox())!
  expect(inicio.x + inicio.width).toBeGreaterThan(1366 - 40)
  expect(inicio.y).toBeLessThan(64 + 40)
  expect(inicio.y).toBeGreaterThanOrEqual(64)

  // Arrastrar por la cabecera a la izquierda y algo abajo: sigue en el cuarto de arriba a la izquierda.
  const asa = (await panel(page).getByTitle('Arrastra para moverlo').boundingBox())!
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2)
  await page.mouse.down()
  await page.mouse.move(asa.x - 800, asa.y + 60, { steps: 12 })
  await page.mouse.up()
  const movido = (await panel(page).boundingBox())!
  expect(movido.x).toBeLessThan(1366 / 2)
  expect(movido.y).toBeLessThan(768 / 2)
  expect(movido.y).toBeGreaterThanOrEqual(64) // nunca bajo la barra azul

  // Minimizar: la pastilla sale en esa esquina. Recargar: sigue igual.
  await panel(page).getByRole('button', { name: 'Minimizar el panel de carga' }).click()
  await expect(pastilla(page)).toBeVisible()
  const p1 = (await pastilla(page).boundingBox())!
  expect(p1.x).toBeLessThan(1366 / 2)
  expect(p1.y).toBeLessThan(768 / 2)
  await page.reload()
  await expect(pastilla(page)).toBeVisible()
  const p2 = (await pastilla(page).boundingBox())!
  expect(Math.abs(p2.x - p1.x)).toBeLessThan(2)
  expect(Math.abs(p2.y - p1.y)).toBeLessThan(2)

  // Abrir, pasar a Total y recargar: sigue en Total.
  await pastilla(page).getByRole('button', { name: 'Abrir el panel de carga' }).click()
  await panel(page).getByRole('button', { name: 'Total' }).click()
  await page.reload()
  await expect(panel(page).getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true')

  // Cerrar con la ×: al recargar sigue cerrado; la barra no tiene botón «Carga» y «Carga técnicos» de Asignaciones lo abre.
  await panel(page).getByRole('button', { name: 'Cerrar el panel de carga' }).click()
  await page.reload()
  await expect(page.getByText('FSGR:')).toBeVisible()
  await expect(panel(page)).toHaveCount(0)
  await expect(pastilla(page)).toHaveCount(0)
  await expect(page.getByRole('banner').getByRole('button', { name: 'Carga', exact: true })).toHaveCount(0)
  await page.goto('/reparaciones/asignaciones')
  await page.getByRole('button', { name: 'Carga técnicos' }).click()
  await expect(panel(page)).toBeVisible()
})

test('lo que asigna otro PC llega antes de 35 s y lo que borra uno mismo, al momento', async ({ page }) => {
  test.setTimeout(120_000)
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  const nombreTec = process.env.E2E_TEC_PRUEBA
  test.skip(!nombreTec, 'Falta E2E_TEC_PRUEBA')
  await page.setViewportSize({ width: 1366, height: 900 })
  await entrar(page, usuario, clave)
  await expect(panel(page)).toBeVisible()
  // Total: la asignación de prueba no lleva cliente y en Pedidos no contaría.
  await panel(page).getByRole('button', { name: 'Total' }).click()
  // De fábrica sale arriba a la derecha y taparía la papelera de la tabla: se lleva abajo a la izquierda (se recuerda).
  const asa = (await panel(page).getByTitle('Arrastra para moverlo').boundingBox())!
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2)
  await page.mouse.down()
  await page.mouse.move(40, 880, { steps: 12 })
  await page.mouse.up()
  // Con el ratón encima el panel no repinta (spec «Con el ratón encima no cambia»): se aparta a una zona neutra, fuera del
  // panel ya movido (que ocupa la esquina de abajo a la izquierda, unos 340 px de ancho).
  await page.mouse.move(700, 450)
  const fila = panel(page).getByRole('listitem').filter({ has: page.getByText(nombreTec!, { exact: true }) })
  await expect(fila).toHaveCount(1)
  test.skip(await fila.getByText('sin jornada hoy').isVisible(), 'Fin de semana: sin jornada no se mide la carga')
  const total = async () => Number(((await fila.getByText(/^\d+%$/).first().textContent()) ?? '').replace('%', ''))

  const antes = await total()
  creada = await crearAsignacion(await idDeTecnico(nombreTec!))
  await expect.poll(total, { timeout: 35_000, intervals: [1_000] }).toBeGreaterThan(antes)
  const conAsignacion = await total()

  // Lo propio: borrarla desde la tabla. La tabla se refresca cada 60 s; se recarga para tenerla ya.
  await page.reload()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()
  await page.getByPlaceholder('Filtrar por IMEI').fill(creada.imei)
  const filaTabla = page.getByRole('row').filter({ hasText: creada.idRep })
  await expect(filaTabla).toHaveCount(1)
  await expect(fila).toHaveCount(1) // tras recargar, la fila del técnico ya está pintada antes de leerla
  await expect.poll(total).toBe(conAsignacion)
  await filaTabla.getByRole('button', { name: 'Borrar asignación' }).click()
  const confirmar = page.getByRole('dialog', { name: `Borrar asignación ${creada.idRep}` })
  await confirmar.getByRole('button', { name: 'Borrar asignación' }).click()
  await expect(filaTabla).toHaveCount(0)
  // Sin esperar al sondeo de 30 s: la regla general vuelve a pedir la carga tras la escritura.
  await expect.poll(total, { timeout: 5_000, intervals: [250] }).toBeLessThan(conAsignacion)
})

test('pulsar un técnico desde otra pantalla lleva a Asignaciones filtrada por él, y el panel sigue', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  await page.goto('/stock')
  await expect(panel(page)).toBeVisible()
  const primera = panel(page).getByRole('listitem').first()
  const nombre = ((await primera.locator('span').first().textContent()) ?? '').trim()
  await primera.getByRole('button').click()
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)
  // El filtro «Técnico» se rotula con el nombre cuando hay uno solo marcado.
  await expect(page.getByRole('button', { name: nombre, exact: true })).toBeVisible()
  await expect(panel(page)).toBeVisible()
})

test('el técnico no tiene panel de carga ni pide la carga', async ({ page }) => {
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  const pedidas: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/reparaciones/carga-tecnicos') pedidas.push(r.url())
  })
  await entrar(page, usuario, clave)
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  await expect(page.getByRole('banner').getByRole('button', { name: 'Carga', exact: true })).toHaveCount(0)
  await expect(panel(page)).toHaveCount(0)
  await expect(pastilla(page)).toHaveCount(0)
  await page.waitForTimeout(2_000)
  expect(pedidas).toEqual([])
})

test('con «Asignar trabajos» abierto, el panel queda por encima y se puede usar sin cerrar la ventana', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.setViewportSize({ width: 1366, height: 768 })
  await entrar(page, usuario, clave)
  await page.goto('/reparaciones/asignaciones')
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  const ventana = page.getByRole('dialog', { name: 'Asignar trabajos' })
  await expect(ventana).toBeVisible()
  // Con la ventana abierta Radix pone aria-hidden en lo de fuera: el panel se localiza por testid y sus botones, incluyendo lo oculto.
  const caja = page.getByTestId('panel-carga')
  await expect(caja).toBeVisible()
  // 1. Total: el clic comprueba que el panel recibe el ratón (si el fondo oscuro lo tapara, fallaría).
  const total = caja.getByRole('button', { name: 'Total', includeHidden: true })
  await total.click()
  await expect(total).toHaveAttribute('aria-pressed', 'true')
  await expect(ventana).toBeVisible()
  // 2. Minimizar: aparece la pastilla y la ventana sigue.
  await caja.getByRole('button', { name: 'Minimizar el panel de carga', includeHidden: true }).click()
  await expect(pastilla(page)).toBeVisible()
  await expect(ventana).toBeVisible()
  // 3. Abrir desde la pastilla: vuelve el panel y la ventana sigue.
  await pastilla(page).getByRole('button', { name: 'Abrir el panel de carga', includeHidden: true }).click()
  await expect(caja).toBeVisible()
  await expect(ventana).toBeVisible()
  // 4. Arrastrar el panel por su asa y soltarlo sobre la ventana: el soltar no cuenta como clic fuera y la ventana sigue.
  const asa = await caja.getByTitle('Arrastra para moverlo').boundingBox()
  const cuerpo = await ventana.boundingBox()
  if (!asa || !cuerpo) throw new Error('Sin caja para el asa del panel o para la ventana')
  const antes = await caja.boundingBox()
  if (!antes) throw new Error('Sin caja para el panel')
  // Se pulsa en la zona del ⋮⋮ (a 1366 px el centro del asa cae sobre el botón «Pedidos», que no arrastra).
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2)
  await page.mouse.down()
  await page.mouse.move(cuerpo.x + cuerpo.width / 2, cuerpo.y + cuerpo.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.mouse.move(2, 2)
  expect((await caja.boundingBox())!.x).toBeLessThan(antes.x - 100)
  await expect(ventana).toBeVisible()
  await expect(caja).toBeVisible()
  // 5. Escape cierra la ventana (sin nada en la cola no pregunta) y el panel sigue.
  await page.keyboard.press('Escape')
  await expect(ventana).toHaveCount(0)
  await expect(caja).toBeVisible()
})
