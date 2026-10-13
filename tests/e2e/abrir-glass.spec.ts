import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/**
 * «Abrir» automático al entregar a glass y atajo «+ Cerrar» (spec raíz 2026-10-13). ESCRIBE: con E2E_USER crea por la API una
 * Reparación y una Glass de un IMEI sintético, las dos para TEC_USER (así el mismo técnico entrega, marca la llegada y cierra).
 * afterAll borra todo lo que cuelga de ese IMEI: asignaciones, «Abrir», «Cerrar» y teléfono.
 */
test.describe.configure({ mode: 'serial' })

/** Forma de la respuesta de POST /api/asignaciones/lote (se repite a mano: el e2e no importa código de la app). */
type RespuestaLote = { creadas: { idRep: string; imei: string; idTec: number; categoria: string }[]; conflictos: unknown[] }

let api: { ctx: APIRequestContext; headers: Record<string, string> } | null = null
let creada: { imei: string; idRep: string; idGlass: string } | null = null

const imeiSintetico = () => `000000${String(Date.now()).slice(-9)}`

/** Códigos de modelo del catálogo, como los guarda el servidor (se repiten a mano). */
const MODELOS = [
  '6s', '6splus', '7', '7plus', '8', '8plus', 'se2020', 'x', 'xr', 'xs', 'xsmax', '11', '11pro', '11promax',
  '12', '12mini', '12pro', '12promax', '13', '13mini', '13pro', '13promax', '14', '14plus', '14pro', '14promax',
  '15', '15plus', '15pro', '15promax', '16', '16e', '16plus', '16pro', '16promax', '17', 'air', '17pro', '17promax',
]

function modeloDeSku(sku: string, prefijo: string): string | null {
  let resto = sku.toLowerCase().slice(prefijo.length)
  if (resto.startsWith('i')) resto = resto.slice(1)
  let mejor: string | null = null
  for (const m of MODELOS) if (resto.startsWith(m) && (mejor === null || m.length > mejor.length)) mejor = m
  return mejor
}

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

/** Primer modelo con componente «otro» (sin él no hay «Abrir»). */
async function modeloConOtro(): Promise<string> {
  const r = await api!.ctx.get('/api/componentes/agrupados', { headers: api!.headers })
  expect(r.status(), 'GET /api/componentes/agrupados').toBe(200)
  const agrupados = (await r.json()) as Record<string, { tipo: string }[]>
  const modelo = (agrupados.otro ?? []).map((c) => modeloDeSku(c.tipo, 'otro')).find((m): m is string => m !== null)
  if (!modelo) throw new Error('Ningún modelo tiene componente «otro»')
  return modelo
}

/** Crea por la API una Reparación y una Glass del mismo IMEI sintético para el técnico con la sesión abierta en `page`. */
async function crearTrabajos(page: Page): Promise<{ imei: string; idRep: string; idGlass: string }> {
  expect(api, 'sesión de API del supertécnico (beforeAll)').not.toBeNull()
  const idTec = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
  expect(typeof idTec, 'idTec del técnico en la sesión').toBe('number')
  const imei = imeiSintetico()
  const modelo = await modeloConOtro()
  const respuesta = await api!.ctx.post('/api/asignaciones/lote', {
    headers: { ...api!.headers, 'Idempotency-Key': `e2e-abrir-glass-${imei}` },
    data: {
      telefonos: [{ imei, modelo, idCli: null, clienteExplicito: false }],
      asignaciones: [
        { imei, categoria: 'R', idTec, comentario: 'e2e abrir glass', esChasis: false },
        { imei, categoria: 'G', idTec, comentario: 'e2e abrir glass', esChasis: false },
      ],
    },
  })
  expect(respuesta.status(), 'POST /api/asignaciones/lote').toBe(200)
  const lote = (await respuesta.json()) as RespuestaLote
  const rep = lote.creadas.find((c) => c.categoria === 'R')
  const gla = lote.creadas.find((c) => c.categoria === 'G')
  if (!rep || !gla) throw new Error(`El lote no creó la Reparación y la Glass del IMEI de prueba: ${JSON.stringify(lote)}`)
  creada = { imei, idRep: rep.idRep, idGlass: gla.idRep }
  test.info().annotations.push({ type: 'e2e-creado', description: `${rep.idRep} + ${gla.idRep} / IMEI ${imei} / modelo ${modelo}` })
  return creada
}

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

test('técnico: entregar apunta el «Abrir», deshacer lo borra, la llegada lo vuelve a apuntar y sale «+ Cerrar»', async ({ page }) => {
  credenciales('E2E_USER', 'E2E_PASS')
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  const { imei, idRep } = await crearTrabajos(page)
  await page.reload()

  const accionesRep = async () => {
    const r = await api!.ctx.get(`/api/reparaciones/imei/${imei}/acciones?categoria=R`, { headers: api!.headers })
    expect(r.status(), 'GET acciones del IMEI').toBe(200)
    return (await r.json()) as string[]
  }
  const aviso = page.getByTestId('aviso-breve')
  const fila = page.getByRole('row').filter({ hasText: imei })

  // 1) Entregar → «Abrir» a nombre del técnico, en su reparación
  await fila.getByText(imei).click({ button: 'right' })
  await page.getByRole('menuitem', { name: /^Entregar a / }).click()
  await expect(aviso).toContainText('· Abierto')
  await expect.poll(accionesRep).toEqual(['Abrir'])
  await expect(fila).toContainText('→ ') // la lista ya refrescó la marca de entrega

  // 2) Deshacer entrega → el «Abrir» se borra
  await fila.getByText(imei).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Deshacer entrega' }).click()
  await expect(aviso).toContainText('Entrega deshecha · «Abrir» borrado')
  await expect.poll(accionesRep).toEqual([])
  await expect(fila).toContainText('Glass: ') // la lista ya refrescó: vuelve la marca de glass pendiente

  // 3) Pestaña Glass: «Marcar que llegó» → el «Abrir» va al dueño de la normal (el mismo técnico)
  await page.goto('/reparaciones/pendientes/glass')
  const filaGlass = page.getByRole('row').filter({ hasText: imei })
  await filaGlass.getByText(imei).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Marcar que llegó' }).click()
  await expect(aviso).toContainText('Llegada registrada · Abierto (')
  await expect.poll(accionesRep).toEqual(['Abrir'])

  // 4) Formulario de la normal: «+ Cerrar» → guardar → el atajo ya no sale
  await page.goto('/reparaciones/pendientes')
  await page.getByRole('row').filter({ hasText: imei }).getByRole('button', { name: 'Añadir reparación' }).click()
  await expect(page).toHaveURL(new RegExp(`/reparaciones/pendientes/reparar/${idRep}$`))
  const formulario = page.getByRole('dialog', { name: /^Nueva reparación — IMEI / })
  const seccion = formulario.getByTestId('otras-acciones')
  const cerrar = seccion.getByRole('button', { name: '+ Cerrar' })
  await expect(cerrar).toBeVisible()
  await cerrar.click()
  await expect(seccion.getByLabel('Descripción de la acción 1')).toHaveValue('Cerrar')
  await expect(cerrar).toBeHidden()
  await seccion.getByRole('button', { name: '✓ Guardar' }).click()
  await seccion.getByRole('button', { name: '✓ Confirmar' }).click()
  await expect(seccion.getByText(/^✓ Guardada /)).toBeVisible()
  await expect.poll(accionesRep).toEqual(['Abrir', 'Cerrar'])
  await formulario.getByRole('button', { name: 'Cerrar formulario' }).click()
})

test.afterAll(async () => {
  const sesion = api
  const restante = creada
  api = null
  creada = null
  if (!sesion) return
  try {
    if (!restante) return
    const motivo = { motivo: 'Limpieza del smoke e2e' }
    for (const id of [restante.idRep, restante.idGlass]) {
      const ruta = `/api/reparaciones/asignaciones/${id}`
      const abierta = await sesion.ctx.get(ruta, { headers: sesion.headers })
      if (abierta.status() === 404) continue
      expect.soft(abierta.status(), `limpieza GET ${ruta}`).toBe(200)
      if (abierta.ok()) {
        const r = await sesion.ctx.delete(ruta, { headers: sesion.headers, data: motivo })
        expect.soft(r.status(), `limpieza DELETE ${ruta}`).toBe(204)
      }
    }
    const rutaImei = `/api/reparaciones/imei/${restante.imei}`
    const delImei = await sesion.ctx.get(rutaImei, { headers: sesion.headers })
    expect.soft(delImei.status(), `limpieza GET ${rutaImei}`).toBe(200)
    if (delImei.ok()) {
      for (const { idRep } of (await delImei.json()) as { idRep: string }[]) {
        const rutaRep = `/api/reparaciones/${idRep}`
        const r = await sesion.ctx.delete(rutaRep, { headers: sesion.headers, data: motivo })
        expect.soft(r.status(), `limpieza DELETE ${rutaRep}`).toBe(204)
      }
      const despues = await sesion.ctx.get(rutaImei, { headers: sesion.headers })
      expect.soft(despues.ok() ? await despues.json() : null, `limpieza: sin reparaciones del IMEI ${restante.imei}`).toEqual([])
    }
    const rutaTelefono = `/api/telefonos/${restante.imei}`
    const borrado = await sesion.ctx.delete(rutaTelefono, { headers: sesion.headers })
    expect.soft(borrado.status(), `limpieza DELETE ${rutaTelefono}`).toBe(204)
  } finally {
    await sesion.ctx.dispose()
  }
})
