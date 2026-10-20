import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Forma de la respuesta de POST /api/asignaciones/lote (schema.d.ts: LoteAsignacionesRespuesta). Se repite a mano porque
 *  el e2e no importa código de la app. */
type RespuestaLote = { creadas: { idRep: string; imei: string; idTec: number; categoria: string }[]; conflictos: unknown[] }

/** Contexto de API con la sesión del supertécnico (E2E_USER): crea los pulidos de prueba y los borra en afterAll con el mismo
 *  token, sin gastar otro inicio de sesión (el entorno limita los inicios por minuto). */
let api: { ctx: APIRequestContext; headers: Record<string, string> } | null = null
/** Asignaciones de pulido creadas por este fichero; afterAll borra todo lo que cuelga de sus IMEIs. */
let creadas: { idRep: string; imei: string }[] = []

/** Dos IMEIs sintéticos de 15 dígitos, distintos en cada ejecución: "00000" + los 9 últimos dígitos de la marca de tiempo + 1/2. */
function imeisSinteticos(): [string, string] {
  const marca = String(Date.now()).slice(-9)
  return [`00000${marca}1`, `00000${marca}2`]
}

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** La fila cuya celda de id es EXACTAMENTE `idRep` (DataTable.tsx pone `data-columna="id"` en el `<td>`). */
function filaDeId(page: Page, idRep: string) {
  const exacto = new RegExp(`^\\s*${escaparRegex(idRep)}\\s*$`)
  return page.getByRole('row').filter({ has: page.locator('td[data-columna="id"]', { hasText: exacto }) })
}

/** Filas de datos de la tabla: DataTable les pone aria-selected; la cabecera y la fila del texto vacío no lo llevan. */
const filasDeDatos = (page: Page) => page.getByRole('table').locator('tr[aria-selected]')

const esCompletarLote = (r: Request) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/pulidos/asignaciones/completar-lote'

test.beforeAll(async ({ playwright }, testInfo) => {
  const usuario = process.env.E2E_USER
  const clave = process.env.E2E_PASS
  if (!usuario || !clave || !process.env.TEC_USER || !process.env.TEC_PASS) return // los tests se saltan con credenciales()
  const ctx = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  const login = await ctx.post('/api/auth/login', { data: { usuario, password: clave } })
  expect(login.status(), 'POST /api/auth/login (supertécnico, por API)').toBe(200)
  const { token } = (await login.json()) as { token: string }
  api = { ctx, headers: { Authorization: `Bearer ${token}` } }
})

/** Crea por la API, con la sesión del supertécnico, una asignación de pulido de cada IMEI sintético para el técnico con la
 *  sesión abierta en `page`. Si el lote no crea exactamente esas dos, falla (y afterAll limpia lo que haya de esos IMEIs). */
async function crearPulidosDePrueba(page: Page): Promise<{ idRep: string; imei: string }[]> {
  expect(api, 'sesión de API del supertécnico (beforeAll)').not.toBeNull()
  const idTec = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
  expect(typeof idTec, 'idTec del técnico en la sesión').toBe('number')
  const imeis = imeisSinteticos()
  creadas = imeis.map((imei) => ({ idRep: '', imei })) // por si el lote crea algo y luego falla: afterAll limpia por IMEI
  const respuesta = await api!.ctx.post('/api/asignaciones/lote', {
    headers: { ...api!.headers, 'Idempotency-Key': `e2e-pulidos-${imeis[0]}` },
    data: {
      telefonos: imeis.map((imei) => ({ imei, modelo: '13', idCli: null, clienteExplicito: false })),
      asignaciones: imeis.map((imei) => ({ imei, categoria: 'P', idTec, comentario: null, esChasis: false })),
    },
  })
  expect(respuesta.status(), 'POST /api/asignaciones/lote').toBe(200)
  const lote = (await respuesta.json()) as RespuestaLote
  const porImei = imeis.map((imei) => lote.creadas.find((c) => c.imei === imei && c.categoria === 'P'))
  if (lote.creadas.length !== 2 || porImei.some((c) => !c)) {
    throw new Error(`El lote no creó exactamente un pulido de cada IMEI de prueba: ${JSON.stringify(lote)}`)
  }
  creadas = porImei.map((c) => ({ idRep: c!.idRep, imei: c!.imei }))
  test.info().annotations.push({ type: 'e2e-creado', description: creadas.map((c) => `${c.idRep} / IMEI ${c.imei}`).join(', ') })
  return creadas
}

/**
 * Incidencia del taller del 2026-10-20 (web 0.9.19). ESCRIBE: crea por la API dos pulidos del técnico de TEC_USER sobre IMEIs
 * sintéticos; con el filtro por el primero, «Seleccionar todo» y «Completar seleccionados» completan solo ese, tras una
 * confirmación «Completar 1 pulido» con su IMEI. Si la confirmación dice otro número, el test falla SIN confirmar: no completa
 * pulidos ajenos del técnico de pruebas. «Cancelar» en la confirmación del segundo no lo completa. Termine o no, afterAll
 * borra los pulidos, las asignaciones y los teléfonos de los dos IMEIs.
 */
test('técnico: con el filtro por IMEI se completa solo el pulido que se ve, con confirmación', async ({ page }) => {
  credenciales('E2E_USER', 'E2E_PASS')
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  const [primero, segundo] = await crearPulidosDePrueba(page)

  const lotes: unknown[] = []
  page.on('request', (r) => { if (esCompletarLote(r)) lotes.push(r.postDataJSON()) })

  await page.goto('/reparaciones/pendientes/pulidos')
  await expect(page.getByRole('heading', { name: 'Mis pulidos pendientes' })).toBeVisible()
  await expect(filaDeId(page, primero.idRep)).toHaveCount(1)
  await expect(filaDeId(page, segundo.idRep)).toHaveCount(1)

  // Con el filtro por el primero solo se ve ese; «Seleccionar todo» marca solo ese.
  await page.getByPlaceholder('Filtrar por IMEI').fill(primero.imei)
  await expect(filasDeDatos(page)).toHaveCount(1)
  await expect(filaDeId(page, primero.idRep)).toHaveCount(1)
  await page.getByRole('button', { name: 'Seleccionar todo' }).click()
  await expect(page.getByRole('checkbox', { name: `Seleccionar ${primero.idRep}` })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'Completar seleccionados' }).click()
  // Antes del arreglo, «Seleccionar todo» marcaba todos los pulidos del técnico: el diálogo diría «Completar N pulidos» y
  // esta espera fallaría sin pulsar nada.
  const confirmacion = page.getByRole('dialog', { name: 'Completar 1 pulido' })
  await expect(confirmacion).toBeVisible()
  await expect(confirmacion).toContainText('Has seleccionado 1 pulido:')
  await expect(confirmacion).toContainText(`${primero.imei} · iPhone 13`)
  await expect(confirmacion).not.toContainText(segundo.imei)
  const respuestaLote = page.waitForResponse((r) => esCompletarLote(r.request()))
  await confirmacion.getByRole('button', { name: 'Completar 1 pulido' }).click()
  expect((await respuestaLote).status(), 'POST /api/pulidos/asignaciones/completar-lote').toBe(204)
  expect(lotes).toEqual([{ ids: [primero.idRep] }])
  await expect(filaDeId(page, primero.idRep)).toHaveCount(0)

  // Sin filtro, el segundo sigue pendiente y sin marcar.
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(filaDeId(page, segundo.idRep)).toHaveCount(1)
  const casillaSegundo = page.getByRole('checkbox', { name: `Seleccionar ${segundo.idRep}` })
  await expect(casillaSegundo).toHaveAttribute('aria-checked', 'false')

  // «Cancelar» en la confirmación no completa nada.
  await casillaSegundo.click()
  await page.getByRole('button', { name: 'Completar seleccionados' }).click()
  const confirmacionSegundo = page.getByRole('dialog', { name: 'Completar 1 pulido' })
  await expect(confirmacionSegundo).toContainText(segundo.imei)
  await confirmacionSegundo.getByRole('button', { name: 'Cancelar' }).click()
  await expect(confirmacionSegundo).toBeHidden()
  await expect(filaDeId(page, segundo.idRep)).toHaveCount(1)
  expect(lotes).toHaveLength(1)
})

test.afterAll(async () => {
  const sesion = api
  const restantes = creadas
  api = null
  creadas = []
  if (!sesion) return
  try {
    const motivo = { motivo: 'Limpieza del smoke e2e' }
    for (const { imei } of restantes) {
      const rutaImei = `/api/reparaciones/imei/${imei}`
      const delImei = await sesion.ctx.get(rutaImei, { headers: sesion.headers })
      expect.soft(delImei.status(), `limpieza GET ${rutaImei}`).toBe(200)
      if (!delImei.ok()) continue
      const ids = ((await delImei.json()) as { idRep: string }[]).map((r) => r.idRep)
      // Los P… antes que su asignación: así ninguno queda apuntando a una asignación ya borrada.
      const orden = [...ids.filter((id) => id.startsWith('P')), ...ids.filter((id) => !id.startsWith('P'))]
      for (const idRep of orden) {
        const rutaRep = `/api/reparaciones/${idRep}`
        const r = await sesion.ctx.delete(rutaRep, { headers: sesion.headers, data: motivo })
        expect.soft(r.status(), `limpieza DELETE ${rutaRep}`).toBe(204)
      }
      const despues = await sesion.ctx.get(rutaImei, { headers: sesion.headers })
      expect.soft(despues.ok() ? await despues.json() : null, `limpieza: sin trabajos del IMEI ${imei}`).toEqual([])
      // El servidor borra el teléfono con su último trabajo; el DELETE es idempotente (204 igualmente).
      const rutaTelefono = `/api/telefonos/${imei}`
      const borrado = await sesion.ctx.delete(rutaTelefono, { headers: sesion.headers })
      expect.soft(borrado.status(), `limpieza DELETE ${rutaTelefono}`).toBe(204)
    }
    // Se comprueba en el inventario, que lista todos los teléfonos: el DELETE responde 204 también si ya no estaba.
    const inventario = await sesion.ctx.get('/api/telefonos/inventario', { headers: sesion.headers })
    expect.soft(inventario.status(), 'limpieza GET /api/telefonos/inventario').toBe(200)
    if (inventario.ok()) {
      const imeis = new Set(restantes.map((c) => c.imei))
      const quedan = ((await inventario.json()) as { imei: string }[]).filter((t) => imeis.has(t.imei))
      expect.soft(quedan, 'limpieza: sin teléfonos de los IMEIs de prueba').toEqual([])
    }
  } finally {
    await sesion.ctx.dispose()
  }
})
