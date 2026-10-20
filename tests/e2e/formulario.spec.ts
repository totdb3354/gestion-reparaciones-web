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
/** Pieza que el técnico pone como «Nueva» y guarda: el supertécnico la pasa luego a reutilizada (y el stock la recupera). */
let piezaNueva: { tipo: string; stockAntes: number } | null = null

/** Stock actual de un SKU (por su texto) según GET /api/componentes/agrupados, con la sesión de API del supertécnico. */
async function stockPorApi(tipo: string): Promise<number> {
  const r = await api!.ctx.get('/api/componentes/agrupados', { headers: api!.headers })
  expect(r.status(), 'GET /api/componentes/agrupados').toBe(200)
  const todos = Object.values((await r.json()) as Record<string, { tipo: string; stock: number }[]>).flat()
  const c = todos.find((x) => x.tipo === tipo)
  if (!c) throw new Error(`El SKU ${tipo} no está en el catálogo`)
  return c.stock
}

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

/** Códigos de modelo del catálogo, como los guarda el servidor. Se repiten a mano porque el e2e no importa código de la app. */
const MODELOS = [
  '6s', '6splus', '7', '7plus', '8', '8plus', 'se2020', 'x', 'xr', 'xs', 'xsmax', '11', '11pro', '11promax',
  '12', '12mini', '12pro', '12promax', '13', '13mini', '13pro', '13promax', '14', '14plus', '14pro', '14promax',
  '15', '15plus', '15pro', '15promax', '16', '16e', '16plus', '16pro', '16promax', '17', 'air', '17pro', '17promax',
]
/** Tipos que no son fila del formulario de Reparación: acciones y los dos de Glass. */
const TIPOS_SIN_FILA = ['otro', 'g', 'mc']
/** Chasis y tapa piden color además de «Nueva»: la prueba usa otras filas para no depender del color. */
const CON_COLOR = ['cha', 'tapa']

/** Modelo de un SKU: sin el prefijo del tipo ni la "i" inicial, el código más largo del catálogo que sea prefijo del resto. */
function modeloDeSku(sku: string, prefijo: string): string | null {
  let resto = sku.toLowerCase().slice(prefijo.length)
  if (resto.startsWith('i')) resto = resto.slice(1)
  let mejor: string | null = null
  for (const m of MODELOS) if (resto.startsWith(m) && (mejor === null || m.length > mejor.length)) mejor = m
  return mejor
}

/**
 * Modelo del teléfono sintético (el servidor lo exige en una asignación de Reparación): `E2E_MODELO_PRUEBA` si está definido;
 * si no, el primero del catálogo que, según GET /api/componentes/agrupados, tiene un tipo **sin color** con algún SKU activo con
 * stock (para «Nueva» y guardar la fila) y otro **sin color** con todos sus SKU activos a 0 (para «Solicitar pieza»).
 */
async function elegirModeloDePrueba(): Promise<string> {
  if (process.env.E2E_MODELO_PRUEBA) return process.env.E2E_MODELO_PRUEBA
  const respuesta = await api!.ctx.get('/api/componentes/agrupados', { headers: api!.headers })
  expect(respuesta.status(), 'GET /api/componentes/agrupados').toBe(200)
  const agrupados = (await respuesta.json()) as Record<string, { tipo: string; stock: number; activo: boolean }[]>
  const porModelo = new Map<string, Map<string, number[]>>()
  for (const [prefijo, skus] of Object.entries(agrupados)) {
    if (TIPOS_SIN_FILA.includes(prefijo) || CON_COLOR.includes(prefijo)) continue
    for (const c of skus) {
      const modelo = c.activo ? modeloDeSku(c.tipo, prefijo) : null
      if (modelo === null) continue
      const tipos = porModelo.get(modelo) ?? new Map<string, number[]>()
      tipos.set(prefijo, [...(tipos.get(prefijo) ?? []), c.stock])
      porModelo.set(modelo, tipos)
    }
  }
  const elegido = MODELOS.find((m) => {
    const stocks = [...(porModelo.get(m)?.values() ?? [])]
    return stocks.some((s) => s.some((n) => n > 0)) && stocks.some((s) => s.every((n) => n <= 0))
  })
  if (!elegido) throw new Error('Ningún modelo tiene un tipo con stock y otro con todos sus SKU a 0: define E2E_MODELO_PRUEBA')
  return elegido
}
/**
 * Crea por la API, con la sesión del supertécnico, UNA asignación de Reparación de un IMEI sintético para el técnico con la
 * sesión abierta en `page`. El modelo del teléfono lo da `elegirModeloDePrueba`.
 */
async function crearAsignacionDePrueba(page: Page): Promise<{ idRep: string; imei: string }> {
  expect(api, 'sesión de API del supertécnico (beforeAll)').not.toBeNull()
  const idTec = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
  expect(typeof idTec, 'idTec del técnico en la sesión').toBe('number')
  const imei = imeiSintetico()
  const modelo = await elegirModeloDePrueba()
  const respuesta = await api!.ctx.post('/api/asignaciones/lote', {
    headers: { ...api!.headers, 'Idempotency-Key': `e2e-formulario-${imei}` },
    data: {
      telefonos: [{ imei, modelo, idCli: null, clienteExplicito: false }],
      asignaciones: [{ imei, categoria: 'R', idTec, comentario: null, esChasis: false }],
    },
  })
  expect(respuesta.status(), 'POST /api/asignaciones/lote').toBe(200)
  const lote = (await respuesta.json()) as RespuestaLote
  if (lote.creadas.length !== 1 || lote.creadas[0].imei !== imei || lote.creadas[0].categoria !== 'R') {
    throw new Error(`El lote no creó exactamente una Reparación para el IMEI de prueba: ${JSON.stringify(lote)}`)
  }
  creada = { idRep: lote.creadas[0].idRep, imei }
  test.info().annotations.push({ type: 'e2e-creado', description: `asignación ${creada.idRep} / IMEI ${imei} / modelo ${modelo}` })
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
 * TEC_USER), pone una pieza como «Nueva» y guarda la fila (consume una unidad de stock de prueba), prueba «Reutilizada» y
 * «Volver atrás», registra una solicitud con «Solicitar pieza» y termina. Si el test termine o no, afterAll borra la asignación,
 * las reparaciones, la solicitud y el teléfono de ese IMEI.
 */
test('técnico: borrador recuperado, nueva y guardar fila, reutilizada y volver, solicitar pieza y terminar', async ({ page }) => {
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

  // «Nueva» en la primera fila sin color que la ofrezca (su SKU por defecto tiene stock): ya pone 1 y Stock enseña lo que quedará
  const sinColor = '[data-testid^="fila-"]:not([data-testid="fila-cha"]):not([data-testid="fila-tapa"])'
  const fila = formulario.locator(sinColor).filter({ has: page.getByRole('button', { name: /^Nueva /, disabled: false }) }).first()
  await expect(fila).toBeVisible()
  const prefijo = ((await fila.getAttribute('data-testid')) ?? '').replace('fila-', '')
  await fila.getByRole('button', { name: /^Nueva / }).click()
  await expect(formulario.getByTestId(`contador-${prefijo}`)).toHaveText('1')
  await expect(formulario.getByTestId(`marca-${prefijo}`)).toContainText('+ Nueva')
  const tipoSku = (await fila.getByRole('combobox', { name: /^SKU de / }).innerText()).trim()
  const stockAntes = await stockPorApi(tipoSku)
  await expect(formulario.getByTestId(`stock-${prefijo}`)).toHaveText(`${stockAntes} → ${stockAntes - 1}`)

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
  await expect(formulario.getByTestId(`marca-${prefijo}`)).toContainText('+ Nueva') // el borrador recupera la elección

  // "✓ Guardar fila" en dos clics
  const botonDerecho = formulario.getByTestId(`boton-derecho-${prefijo}`)
  await expect(botonDerecho).toHaveText('✓ Guardar fila')
  await botonDerecho.click()
  await expect(botonDerecho).toHaveText('✓ Confirmar')
  await botonDerecho.click()
  await expect(botonDerecho).toHaveText(/^✓ Guardada [0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}$/)
  expect(await stockPorApi(tipoSku), 'la pieza nueva gasta una del stock').toBe(stockAntes - 1)
  piezaNueva = { tipo: tipoSku, stockAntes }

  // Fila sin color y sin stock: el botón de la celda del SKU ya dice «Solicitar <tipo>». Antes, «Reutilizada» (contador «—»)
  // y «Volver atrás» (la fila vuelve a los dos botones).
  const filaSinStock = formulario.locator(sinColor).filter({ has: page.getByRole('button', { name: /^Solicitar / }) }).first()
  await expect(filaSinStock).toBeVisible()
  const prefijoSinStock = ((await filaSinStock.getAttribute('data-testid')) ?? '').replace('fila-', '')
  await filaSinStock.getByRole('button', { name: /^Reutilizada / }).click()
  await expect(formulario.getByTestId(`contador-${prefijoSinStock}`)).toHaveText('—')
  await expect(formulario.getByTestId(`marca-${prefijoSinStock}`)).toContainText('↺ Reutilizada')
  await filaSinStock.getByRole('button', { name: /^Volver atrás / }).click()
  await filaSinStock.getByRole('button', { name: /^Solicitar / }).click()
  const solicitar = page.getByRole('dialog', { name: /^Solicitar pieza — / })
  await solicitar.getByPlaceholder('Describe la pieza que necesitas (opcional)...').fill('Smoke e2e')
  await solicitar.getByRole('button', { name: 'Confirmar: solicitar pieza' }).click()
  const subfila = formulario.getByTestId(`subfila-${prefijoSinStock}`)
  await expect(subfila).toHaveAttribute('data-variante', 'confirmada')
  await expect(subfila).toContainText('✓  Solicitud de reposición pendiente — Smoke e2e')
  await expect(formulario.getByTestId(`marca-${prefijoSinStock}`)).toContainText('Solicitada')

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
  // El supertécnico entra en Asignaciones, como en el JavaFX (ReparacionControllerSuperTecnico.java:229).
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)

  // La solicitud que dejó el técnico enciende el badge
  await expect(page.getByTestId('campana-badge')).toHaveText(/^[1-9][0-9]*$/)
  await page.getByTestId('campana').click()
  const panel = page.getByTestId('panel-notificaciones')
  await expect(panel).toBeVisible()
  await panel.getByRole('tab', { name: 'Solicitudes' }).click()

  // Solo la tarjeta de la solicitud del IMEI sintético de este fichero (nunca la primera de la lista, que puede ser real):
  // su idRc sale de GET /api/solicitudes?estado=PENDIENTE y la tarjeta urgente se identifica por él.
  expect(api, 'sesión de API del supertécnico (beforeAll)').not.toBeNull()
  expect(creada, 'asignación de prueba creada por el test del técnico').not.toBeNull()
  const imeiPrueba = creada!.imei
  const pendientes = await api!.ctx.get('/api/solicitudes', { headers: api!.headers, params: { estado: 'PENDIENTE' } })
  expect(pendientes.status(), 'GET /api/solicitudes?estado=PENDIENTE').toBe(200)
  const suyas = ((await pendientes.json()) as { idRc: number; imei: string }[]).filter((s) => s.imei === imeiPrueba)
  expect(suyas, `solicitudes pendientes del IMEI de prueba ${imeiPrueba}`).toHaveLength(1)
  const tarjeta = panel.getByTestId(`tarjeta-solicitud-U-${suyas[0].idRc}`)
  await expect(tarjeta).toHaveAttribute('data-grupo', 'pendiente')
  await tarjeta.getByRole('button', { name: 'Rechazar' }).click()
  await expect(tarjeta).toHaveAttribute('data-grupo', 'rechazada')
  await tarjeta.getByRole('button', { name: 'Recuperar' }).click()
  await expect(tarjeta).toHaveAttribute('data-grupo', 'pendiente')
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // "Editar" desde el Historial (enlace de la columna lateral de Reparaciones)
  await page.getByRole('link', { name: 'Historial', exact: true }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial$/)
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  const primeraFila = page.getByRole('table').locator('tr[aria-selected]').first()
  await expect(primeraFila).toBeVisible()
  await primeraFila.getByRole('cell').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Editar' }).click()
  await expect(page).toHaveURL(/\/reparaciones\/historial\/editar\/[^/]+$/)
  const edicion = page.getByRole('dialog', { name: /^Editar reparación — / })
  await expect(edicion).toBeVisible()

  // Con una pieza editada se provoca un cambio y se sale sin guardar; una acción "otro" no tiene fila editada y cierra sin más.
  // El cambio es la observación, que nunca deja el cambio como inválido.
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

  // La pieza que el técnico guardó como nueva pasa a reutilizada: el stock recupera la unidad (spec 0.9.19 §2, edición).
  expect(piezaNueva, 'pieza nueva guardada por el test del técnico').not.toBeNull()
  const reps = await api!.ctx.get(`/api/reparaciones/imei/${imeiPrueba}`, { headers: api!.headers })
  expect(reps.status(), `GET /api/reparaciones/imei/${imeiPrueba}`).toBe(200)
  const idR = ((await reps.json()) as { idRep: string }[]).map((r) => r.idRep).find((id) => id.startsWith('R'))
  expect(idR, 'la R… de la fila guardada').toBeTruthy()
  await page.goto(`/reparaciones/historial/editar/${idR}`)
  const edicionPrueba = page.getByRole('dialog', { name: /^Editar reparación — / })
  await expect(edicionPrueba).toBeVisible()
  const editadaPrueba = edicionPrueba.locator('[data-estado="editada"]')
  await editadaPrueba.getByRole('button', { name: /^Volver atrás / }).click()
  await editadaPrueba.getByRole('button', { name: /^Reutilizada / }).click()
  const guardarCambios = edicionPrueba.getByTestId('zona-guardar').getByRole('button')
  await expect(guardarCambios).toHaveText('Guardar cambios')
  await guardarCambios.click()
  await expect(guardarCambios).toHaveText('✓  Confirmar terminar')
  await guardarCambios.click()
  await expect(edicionPrueba).toBeHidden()
  expect(await stockPorApi(piezaNueva!.tipo), 'pasar a reutilizada devuelve la unidad').toBe(piezaNueva!.stockAntes)
  const detalle = await api!.ctx.get(`/api/reparaciones/${idR}/detalle-edicion`, { headers: api!.headers })
  expect(detalle.status(), `GET /api/reparaciones/${idR}/detalle-edicion`).toBe(200)
  expect(((await detalle.json()) as { esReutilizado: boolean }).esReutilizado).toBe(true)
})

/**
 * Limpieza con la sesión de API del beforeAll (supertécnico), de todo lo que cuelga del IMEI sintético:
 * 1. si la asignación de prueba sigue abierta (el test cayó antes de terminar), se borra por su id;
 * 2. después se borran por DELETE /api/reparaciones/{idRep} todas las reparaciones que queden del IMEI: primero las R… que
 *    creó el test (si el test cayó antes de pasarla a reutilizada, la fila guardada devuelve su unidad al stock; con ellas se
 *    van sus Reparacion_componente, incluida la solicitud de pieza) y al final la asignación ya cerrada;
 * 3. se comprueba que no queda ninguna reparación del IMEI ni ninguna solicitud de pieza suya;
 * 4. se borra el teléfono que creó el lote (DELETE /api/telefonos/{imei}) y se comprueba que ya no existe.
 * Los fallos se señalan con expect.soft nombrando la ruta, sin tapar el fallo original.
 */
test.afterAll(async () => {
  const sesion = api
  const restante = creada
  api = null
  creada = null
  piezaNueva = null
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

    // Por último, el teléfono que creó el lote: solo puede irse cuando ya no lo referencia ninguna reparación ni solicitud.
    // El servidor puede haberlo borrado ya con la última reparación; el DELETE es idempotente (204 igualmente).
    const rutaTelefono = `/api/telefonos/${restante.imei}`
    const borrado = await sesion.ctx.delete(rutaTelefono, { headers: sesion.headers })
    expect.soft(borrado.status(), `limpieza DELETE ${rutaTelefono}`).toBe(204)
    // Se comprueba en el inventario, que lista todos los teléfonos sin filtrar: el DELETE responde 204 también si ya no
    // estaba, así que por sí solo no prueba que el teléfono se haya ido.
    const inventario = await sesion.ctx.get('/api/telefonos/inventario', { headers: sesion.headers })
    expect.soft(inventario.status(), 'limpieza GET /api/telefonos/inventario').toBe(200)
    if (inventario.ok()) {
      const quedan = ((await inventario.json()) as { imei: string }[]).filter((t) => t.imei === restante.imei)
      expect.soft(quedan, `limpieza: sin teléfono ${restante.imei}`).toEqual([])
    }
  } finally {
    await sesion.ctx.dispose()
  }
})
