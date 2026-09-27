import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// El test del supertécnico rechaza y recupera la solicitud que deja el del técnico: van en orden y en el mismo worker.
test.describe.configure({ mode: 'serial' })

/** Forma de la respuesta de POST /api/asignaciones/lote (schema.d.ts: LoteAsignacionesRespuesta). Se repite a mano porque
 *  el e2e no importa código de la app. */
type RespuestaLote = { creadas: { idRep: string; imei: string; idTec: number; categoria: string }[]; conflictos: unknown[] }

/** Contexto de API con la sesión del supertécnico (E2E_USER): crea la asignación de prueba y la borra en afterAll con el
 *  mismo token, sin gastar otro inicio de sesión (el entorno limita los inicios por minuto). */
let api: { ctx: APIRequestContext; headers: Record<string, string> } | null = null
/** Asignación de prueba creada por este fichero (y su IMEI sintético); afterAll borra todo lo que cuelga de ese IMEI. */
let creada: { idRep: string; imei: string } | null = null

/** IMEI sintético de 15 dígitos, distinto en cada ejecución: "000000" + los 9 últimos dígitos de la marca de tiempo. */
const imeiSintetico = () => `000000${String(Date.now()).slice(-9)}`

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

/**
 * Crea por la API, con la sesión del supertécnico, UNA asignación de Reparación de un IMEI sintético para el técnico con la
 * sesión abierta en `page`. El modelo del teléfono es `E2E_MODELO_PRUEBA` si está definido (un modelo con un tipo con
 * stock y otro con el SKU a 0); si no, el teléfono va sin modelo y el test elige el primero del combo.
 */
async function crearAsignacionDePrueba(page: Page): Promise<{ idRep: string; imei: string }> {
  expect(api, 'sesión de API del supertécnico (beforeAll)').not.toBeNull()
  const idTec = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
  expect(typeof idTec, 'idTec del técnico en la sesión').toBe('number')
  const imei = imeiSintetico()
  const respuesta = await api!.ctx.post('/api/asignaciones/lote', {
    headers: { ...api!.headers, 'Idempotency-Key': `e2e-formulario-${imei}` },
    data: {
      telefonos: [{ imei, modelo: process.env.E2E_MODELO_PRUEBA || null, idCli: null, clienteExplicito: false }],
      asignaciones: [{ imei, categoria: 'R', idTec, comentario: null, esChasis: false }],
    },
  })
  expect(respuesta.status(), 'POST /api/asignaciones/lote').toBe(200)
  const lote = (await respuesta.json()) as RespuestaLote
  if (lote.creadas.length !== 1 || lote.creadas[0].imei !== imei || lote.creadas[0].categoria !== 'R') {
    throw new Error(`El lote no creó exactamente una Reparación para el IMEI de prueba: ${JSON.stringify(lote)}`)
  }
  creada = { idRep: lote.creadas[0].idRep, imei }
  test.info().annotations.push({ type: 'e2e-creado', description: `asignación ${creada.idRep} / IMEI ${imei}` })
  return { idRep: creada.idRep, imei }
}

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

const esBorrador = (metodo: string) => (r: { url(): string; request(): { method(): string }; ok(): boolean }) =>
  r.request().method() === metodo && new URL(r.url()).pathname.endsWith('/borrador') && r.ok()

/**
 * Guion del técnico (spec §11). ESCRIBE: crea por la API su propia asignación de Reparación (IMEI sintético, técnico de
 * TEC_USER), guarda una fila (consume una unidad de stock de prueba), registra una solicitud de pieza y termina. Si el test
 * cae antes de terminar, afterAll borra la asignación.
 */
test('técnico: borrador recuperado, guardar fila, solicitar pieza y terminar', async ({ page }) => {
  credenciales('E2E_USER', 'E2E_PASS')
  const { usuario, clave } = credenciales('TEC_USER', 'TEC_PASS')
  await entrar(page, usuario, clave)
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  const { idRep, imei } = await crearAsignacionDePrueba(page)
  await page.reload()

  // Abrir "Añadir reparación" de la asignación de prueba (su fila, por el IMEI sintético)
  await page.getByRole('row').filter({ hasText: imei }).getByRole('button', { name: 'Añadir reparación' }).click()
  await expect(page).toHaveURL(new RegExp(`/reparaciones/pendientes/reparar/${idRep}$`))
  const urlFormulario = page.url()
  const formulario = page.getByRole('dialog', { name: /^Nueva reparación — IMEI / })
  await expect(formulario).toBeVisible()

  // Elegir modelo (si el teléfono ya lo trae, el combo llega bloqueado y con valor)
  const modelo = formulario.getByRole('combobox', { name: 'Filtrar por modelo' })
  if (await modelo.isEnabled()) {
    await modelo.click()
    await page.getByRole('option').first().click()
  }

  // Activar la primera fila que tenga stock
  const fila = formulario
    .locator('[data-testid^="fila-"]')
    .filter({ has: page.getByRole('button', { name: /^Sumar /, disabled: false }) })
    .first()
  await expect(fila).toBeVisible()
  const prefijo = ((await fila.getAttribute('data-testid')) ?? '').replace('fila-', '')
  await fila.getByRole('button', { name: /^Sumar / }).click()
  await expect(formulario.getByTestId(`contador-${prefijo}`)).toHaveText('1')

  // Cerrar: no pregunta y vuelca el borrador en ese momento
  const volcado = page.waitForResponse(esBorrador('PUT'))
  await formulario.getByRole('button', { name: 'Cerrar formulario' }).click()
  await volcado
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)

  // Reabrir por URL (mismo camino que F5): el borrador se recupera
  await page.goto(urlFormulario)
  await expect(formulario).toBeVisible()
  await expect(formulario.getByTestId('banda-borrador')).toContainText('✓ Borrador recuperado')
  await expect(formulario.getByTestId(`contador-${prefijo}`)).toHaveText('1')

  // "✓ Guardar fila" en dos clics
  const botonDerecho = formulario.getByTestId(`boton-derecho-${prefijo}`)
  await expect(botonDerecho).toHaveText('✓ Guardar fila')
  await botonDerecho.click()
  await expect(botonDerecho).toHaveText('✓ Confirmar')
  await botonDerecho.click()
  await expect(botonDerecho).toHaveText(/^✓ Guardada [0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}$/)

  // Solicitar pieza (local) en la fila sin stock. Al confirmar, data-variante pasa a "confirmada": la sub-fila se vuelve a
  // localizar por su data-testid, porque un localizador que filtre por "sinStock" dejaría de encontrarla.
  const sinStock = formulario.locator('[data-testid^="subfila-"][data-variante="sinStock"]').first()
  await expect(sinStock).toBeVisible()
  const subfila = formulario.getByTestId((await sinStock.getAttribute('data-testid')) ?? '')
  await subfila.getByRole('button', { name: 'Solicitar pieza' }).click()
  const solicitar = page.getByRole('dialog', { name: /^Solicitar pieza — / })
  await solicitar.getByPlaceholder('Describe la pieza que necesitas (opcional)...').fill('Smoke e2e')
  await solicitar.getByRole('button', { name: 'Confirmar: solicitar pieza' }).click()
  await expect(subfila).toHaveAttribute('data-variante', 'confirmada')
  await expect(subfila).toContainText('✓  Solicitud de reposición pendiente — Smoke e2e')

  // "Terminar asignación" en dos clics y vuelta a la lista
  const terminar = formulario.getByTestId('zona-guardar').getByRole('button')
  await expect(terminar).toHaveText('Terminar asignación')
  await terminar.click()
  await expect(terminar).toHaveText('✓  Confirmar terminar')
  await terminar.click()
  await expect(page).toHaveURL(/\/reparaciones\/pendientes$/)
  await expect(formulario).toBeHidden()
})

/** Guion del supertécnico (spec §11): campana con badge, "Rechazar", "Recuperar", "Editar" desde Historial y salir sin guardar. */
test('supertécnico: campana con badge, rechazar y recuperar, editar y salir sin guardar', async ({ page }) => {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await entrar(page, usuario, clave)
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)

  // La solicitud que dejó el técnico enciende el badge
  await expect(page.getByTestId('campana-badge')).toHaveText(/^[1-9][0-9]*$/)
  await page.getByTestId('campana').click()
  const panel = page.getByTestId('panel-notificaciones')
  await expect(panel).toBeVisible()
  await panel.getByRole('tab', { name: 'Solicitudes' }).click()

  const pendiente = panel.locator('[data-testid^="tarjeta-solicitud-"][data-grupo="pendiente"]').first()
  await expect(pendiente).toBeVisible()
  const idTarjeta = (await pendiente.getAttribute('data-testid')) ?? ''
  const tarjeta = panel.getByTestId(idTarjeta)
  await tarjeta.getByRole('button', { name: 'Rechazar' }).click()
  await expect(tarjeta).toHaveAttribute('data-grupo', 'rechazada')
  await tarjeta.getByRole('button', { name: 'Recuperar' }).click()
  await expect(tarjeta).toHaveAttribute('data-grupo', 'pendiente')
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // "Editar" desde el Historial
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  const primeraFila = page.getByRole('table').locator('tr[aria-selected]').first()
  await expect(primeraFila).toBeVisible()
  await primeraFila.getByRole('cell').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Editar' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial\/editar\/[^/]+$/)
  const edicion = page.getByRole('dialog', { name: /^Editar reparación — / })
  await expect(edicion).toBeVisible()

  // Con una pieza editada se provoca un cambio y se sale sin guardar; una acción "otro" no tiene fila editada y cierra sin más.
  // El cambio es la observación, el único control de la fila editada que está siempre habilitado ("Reutilizado" va
  // deshabilitado con cantidad > 0 y "+" con el stock a 0) y que nunca deja el cambio como inválido.
  const editada = edicion.locator('[data-estado="editada"]')
  if ((await editada.count()) > 0) {
    const papelera = editada.getByRole('button', { name: /^Borrar observación de / })
    if ((await papelera.count()) > 0) {
      await papelera.click()
    } else {
      await editada.getByRole('button', { name: 'Añadir observación' }).click()
      const observacion = page.getByRole('dialog', { name: /^Observación para: / })
      await observacion.getByRole('textbox', { name: 'Observación' }).fill('Smoke e2e')
      await observacion.getByRole('button', { name: 'Guardar', exact: true }).click()
    }
    await expect(edicion.getByTestId('zona-guardar')).toBeVisible()
    await edicion.getByRole('button', { name: 'Cerrar formulario' }).click()
    await page.getByRole('button', { name: 'Salir sin guardar' }).click()
  } else {
    await edicion.getByRole('button', { name: 'Cerrar formulario' }).click()
  }
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await expect(edicion).toBeHidden()
})

/**
 * Limpieza con la sesión de API del beforeAll (supertécnico), de todo lo que cuelga del IMEI sintético:
 * 1. si la asignación de prueba sigue abierta (el test cayó antes de terminar), se borra por su id;
 * 2. después se borran por DELETE /api/reparaciones/{idRep} todas las reparaciones que queden del IMEI: primero las R… que
 *    creó el test (la fila guardada devuelve su unidad al stock y con ellas se van sus Reparacion_componente, incluida la
 *    solicitud de pieza) y al final la asignación ya cerrada;
 * 3. se comprueba que no queda ninguna reparación del IMEI ni ninguna solicitud de pieza suya.
 * Los fallos se señalan con expect.soft nombrando la ruta, sin tapar el fallo original.
 */
test.afterAll(async () => {
  const sesion = api
  const restante = creada
  api = null
  creada = null
  if (!sesion) return
  try {
    if (!restante) return
    const motivo = { motivo: 'Limpieza del smoke e2e' }
    const ruta = `/api/reparaciones/asignaciones/${restante.idRep}`
    const abierta = await sesion.ctx.get(ruta, { headers: sesion.headers })
    if (abierta.status() !== 404) {
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
      const ids = ((await delImei.json()) as { idRep: string }[]).map((r) => r.idRep)
      // Las R… antes que la asignación: así ninguna queda apuntando a una asignación ya borrada.
      const orden = [...ids.filter((id) => id.startsWith('R')), ...ids.filter((id) => !id.startsWith('R'))]
      for (const idRep of orden) {
        const rutaRep = `/api/reparaciones/${idRep}`
        const r = await sesion.ctx.delete(rutaRep, { headers: sesion.headers, data: motivo })
        expect.soft(r.status(), `limpieza DELETE ${rutaRep}`).toBe(204)
      }
      const despues = await sesion.ctx.get(rutaImei, { headers: sesion.headers })
      expect.soft(despues.ok() ? await despues.json() : null, `limpieza: sin reparaciones del IMEI ${restante.imei}`).toEqual([])
    }

    const solicitudes = await sesion.ctx.get('/api/solicitudes', { headers: sesion.headers })
    expect.soft(solicitudes.status(), 'limpieza GET /api/solicitudes').toBe(200)
    if (solicitudes.ok()) {
      const suyas = ((await solicitudes.json()) as { imei: string }[]).filter((x) => x.imei === restante.imei)
      expect.soft(suyas, `limpieza: sin solicitudes de pieza del IMEI ${restante.imei}`).toEqual([])
    }
  } finally {
    await sesion.ctx.dispose()
  }
})
