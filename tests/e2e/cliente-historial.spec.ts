import { expect, test, type Locator, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// La sesión del supertécnico se abre una vez y la comparten los tres primeros tests (el entorno limita los inicios de
// sesión por minuto); el del administrador lee en «Ver logs» las correcciones de los dos primeros: van en orden.
test.describe.configure({ mode: 'serial' })

/** Formas de las respuestas que usa el test (schema.d.ts: TrabajoCerrado, Cliente, LoteAsignacionesRespuesta). Se repiten
 *  aquí a mano porque el e2e no importa código de la app. */
type TrabajoCerrado = { idRep: string; fechaFin: string; descripcion: string | null; idCli: number | null; cliente: string | null }
type Cliente = { idCli: number; nombre: string }
type Eleccion = { idRep: string; imei: string; original: Cliente; otro: Cliente }
type RespuestaLote = { creadas: { idRep: string; imei: string; idTec: number; categoria: string }[]; conflictos: unknown[] }
type Correccion = { idRep: string; imei: string; antes: number; despues: number }

/** Página con la sesión del supertécnico, abierta en beforeAll. */
let sup: Page | null = null
/** Correcciones hechas por los tests 1 y 2 (ida y vuelta), para buscarlas en «Ver logs». */
const correcciones: Correccion[] = []
/** Datos sintéticos del test 3; afterAll borra todo lo que cuelga de ese IMEI. */
let sintetico: { imei: string; idAsignacion: string } | null = null
/** Stock de los dos SKU que gasta el test 3 antes de empezar: afterAll comprueba que la limpieza lo deja igual. */
let stockAntes: { idCom: number; stock: number }[] = []

const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
/** IMEI sintético de 15 dígitos, distinto en cada ejecución (como formulario.spec.ts). */
const imeiSintetico = () => `000000${String(Date.now()).slice(-9)}`

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

/** Petición a la API con el token de la sesión de la página (patrón de pedidos.spec.ts). */
async function llamarApi(page: Page, metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ metodo, ruta, cuerpo, extra }) => {
      const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
      const headers: Record<string, string> = { Authorization: `Bearer ${sesion.token}`, ...extra }
      if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
      const r = await fetch(ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
      const texto = await r.text()
      return { status: r.status, json: texto === '' ? null : (JSON.parse(texto) as unknown) }
    },
    { metodo, ruta, cuerpo, extra },
  )
}

async function cerradosDe(page: Page, imei: string): Promise<TrabajoCerrado[]> {
  const r = await llamarApi(page, 'GET', `/api/reparaciones/imei/${encodeURIComponent(imei)}/cerrados`)
  expect(r.status, `GET /cerrados respondió ${r.status}`).toBe(200)
  return r.json as TrabajoCerrado[]
}

/** Un trabajo cerrado del historial `ruta` con un cliente activo (el modal solo ofrece activos: así se puede devolver desde
 *  la interfaz) y otro cliente activo al que cambiarlo. Se elige dentro de la página para no traer el historial entero por
 *  el protocolo del navegador. Sin candidato, null. */
async function elegirTrabajo(page: Page, ruta: string, prefijo: string): Promise<Eleccion | null> {
  return page.evaluate(async ({ ruta, prefijo }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const headers = { Authorization: `Bearer ${sesion.token}` }
    const activos = (await (await fetch('/api/clientes/activos', { headers })).json()) as { idCli: number; nombre: string }[]
    const historial = (await (await fetch(ruta, { headers })).json()) as { idRep: string; imei: string; fechaFin: string | null; cliente: string | null }[]
    const porNombre = new Map(activos.map((c) => [c.nombre, c]))
    const rep = historial.find((r) => r.idRep.startsWith(prefijo) && r.fechaFin && r.cliente && porNombre.has(r.cliente))
    if (!rep?.cliente) return null
    const original = porNombre.get(rep.cliente)!
    const otro = activos.find((c) => c.idCli !== original.idCli && c.nombre !== original.nombre)
    if (!otro) return null
    return { idRep: rep.idRep, imei: rep.imei, original: { idCli: original.idCli, nombre: original.nombre }, otro: { idCli: otro.idCli, nombre: otro.nombre } }
  }, { ruta, prefijo })
}

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** La fila cuya celda de id es EXACTAMENTE `idRep` (DataTable pone `data-columna` en cada `<td>`). */
function filaDeId(page: Page, idRep: string) {
  const exacto = new RegExp(`^\\s*${escaparRegex(idRep)}\\s*$`)
  return page.getByRole('row').filter({ has: page.locator('td[data-columna="id"]', { hasText: exacto }) })
}

/** La casilla del modal cuyo id es EXACTAMENTE `idRep`: el primer `<span>` de cada `<li>` es el id (CorregirClienteDialog);
 *  un «contiene» casaría también con otros ids que lo incluyen (AP…, P…_10). */
function casillaDeId(dialogo: Locator, idRep: string) {
  const exacto = new RegExp(`^\\s*${escaparRegex(idRep)}\\s*$`)
  return dialogo.locator('li').filter({ has: dialogo.page().locator('span:first-of-type', { hasText: exacto }) })
}

/** Abre «Corregir cliente» desde la fila de `idRep` y comprueba la cabecera del modal. */
async function abrirCorregir(page: Page, idRep: string, guardadoAhora: string) {
  await filaDeId(page, idRep).locator('td[data-columna="cliente"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Corregir cliente' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Corregir cliente' })
  await expect(dialogo.getByText(`guardado ahora: ${guardadoAhora}`)).toBeVisible()
  await expect(casillaDeId(dialogo, idRep)).toHaveCount(1)
  return dialogo
}

/** Elige `destino`, deja marcados exactamente `marcar` y pulsa «Corregir N». Devuelve el estado del PATCH. */
async function confirmarCorreccion(page: Page, dialogo: Locator, destino: string, marcar: string[]): Promise<number> {
  await dialogo.getByLabel('Cliente correcto').selectOption({ label: destino })
  for (const li of await dialogo.locator('li').all()) {
    const casilla = li.getByRole('checkbox')
    const id = ((await li.locator('span').first().textContent()) ?? '').trim()
    const debe = marcar.includes(id)
    if ((await casilla.isChecked()) !== debe) await casilla.click()
  }
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/reparaciones/cliente' && r.request().method() === 'PATCH')
  await dialogo.getByRole('button', { name: `Corregir ${marcar.length}` }).click()
  const status = (await respuesta).status()
  await expect(dialogo).toBeHidden()
  return status
}

/** Ida y vuelta de un trabajo: a `otro` y de nuevo a `original`, solo esa casilla marcada. Si cae a medias, lo devuelve por
 *  la API. Apunta las dos correcciones para «Ver logs». */
async function corregirYDeshacer(page: Page, { idRep, imei, original, otro }: Eleccion) {
  const celda = filaDeId(page, idRep).locator('td[data-columna="cliente"]')
  try {
    expect(await confirmarCorreccion(page, await abrirCorregir(page, idRep, original.nombre), otro.nombre, [idRep])).toBe(204)
    correcciones.push({ idRep, imei, antes: original.idCli, despues: otro.idCli })
    await expect(celda).toHaveText(otro.nombre)
    expect(await confirmarCorreccion(page, await abrirCorregir(page, idRep, otro.nombre), original.nombre, [idRep])).toBe(204)
    correcciones.push({ idRep, imei, antes: otro.idCli, despues: original.idCli })
    await expect(celda).toHaveText(original.nombre)
  } finally {
    const ahora = (await cerradosDe(page, imei)).find((t) => t.idRep === idRep)
    if (ahora && ahora.idCli !== original.idCli) {
      const r = await llamarApi(page, 'PATCH', '/api/reparaciones/cliente', { imei, idReps: [idRep], idCli: original.idCli })
      expect(r.status, `No se pudo devolver ${idRep} a su cliente (${original.nombre}): corregirlo a mano`).toBe(204)
    }
  }
}

test.beforeAll(async ({ browser }, testInfo) => {
  const usuario = process.env.E2E_USER
  const clave = process.env.E2E_PASS
  if (!usuario || !clave) return // los tests se saltan con credenciales()
  sup = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
  await entrar(sup, usuario, clave)
})

/**
 * ESCRIBE: corrige el cliente guardado de UN trabajo cerrado de reparación (el primero del Historial con un cliente activo)
 * a otro cliente activo y lo devuelve al suyo, las dos veces desde el modal (si cae a medias, por la API).
 */
test('supertécnico: columna y filtro Cliente en el Historial, y corregir el cliente de una reparación y deshacerlo', async () => {
  credenciales('E2E_USER', 'E2E_PASS')
  const page = sup!
  await page.goto('/reparaciones/historial')
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

  const eleccion = await elegirTrabajo(page, '/api/reparaciones/historial', 'R')
  test.skip(!eleccion, 'No hay una reparación cerrada con un cliente activo y otro cliente activo al que cambiarlo')
  const { idRep, imei, original } = eleccion!
  expect((await cerradosDe(page, imei)).find((t) => t.idRep === idRep)?.idCli).toBe(original.idCli)

  // Columna y filtro: con el filtro en su cliente, la fila sigue y todas las visibles son de ese cliente.
  await page.getByPlaceholder('Filtrar por IMEI').fill(imei)
  const celdaCliente = filaDeId(page, idRep).locator('td[data-columna="cliente"]')
  await expect(celdaCliente).toHaveText(original.nombre)
  // El desplegable del filtro (PopoverTrigger, con aria-haspopup), no la cabecera ordenable de la columna, que también es
  // un botón «Cliente».
  await page.locator('button[aria-haspopup]').filter({ hasText: /^Cliente$/ }).click()
  await page.getByRole('checkbox', { name: original.nombre, exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(celdaCliente).toHaveText(original.nombre)
  for (const texto of await page.locator('td[data-columna="cliente"]').allTextContents()) expect(texto.trim()).toBe(original.nombre)
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await page.getByPlaceholder('Filtrar por IMEI').fill(imei)

  await corregirYDeshacer(page, eleccion!)
})

/** ESCRIBE: lo mismo con un pulido cerrado, desde el detalle de su IMEI (el Historial de pulidos no tiene la acción). */
test('supertécnico: corregir el cliente de un pulido desde el detalle del IMEI y deshacerlo', async () => {
  credenciales('E2E_USER', 'E2E_PASS')
  const page = sup!
  const eleccion = await elegirTrabajo(page, '/api/pulidos/historial', 'P')
  test.skip(!eleccion, 'No hay un pulido cerrado con un cliente activo y otro cliente activo al que cambiarlo')
  const { idRep, imei, original } = eleccion!

  await page.goto(`/reparaciones/imeis/${imei}`)
  await expect(page.getByText(`IMEI: ${imei}`)).toBeVisible()
  await expect(filaDeId(page, idRep).locator('td[data-columna="cliente"]')).toHaveText(original.nombre)
  await corregirYDeshacer(page, eleccion!)
})

/**
 * ESCRIBE datos sintéticos: una asignación de Reparación de un IMEI sintético para el propio supertécnico (sin cliente), con
 * dos piezas solicitadas y después reparadas: las dos solicitudes quedan resueltas (filas de pieza de la propia asignación)
 * y la asignación se cierra. Es el caso que repetía la asignación en la lista del modal. El modal la muestra una vez, como
 * «Asignación», y corrige de una vez la asignación y sus dos reparaciones. Consume una unidad de dos SKU con stock, que
 * vuelven al borrar las reparaciones en afterAll (que borra todo lo del IMEI).
 */
test('supertécnico: una asignación cerrada con dos piezas resueltas sale una vez en el modal y se corrige con sus reparaciones', async () => {
  credenciales('E2E_USER', 'E2E_PASS')
  const page = sup!
  const idTec = await page.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
  test.skip(typeof idTec !== 'number', 'El supertécnico de E2E_USER no tiene técnico: no puede cerrar su propia asignación')

  const agrupados = (await llamarApi(page, 'GET', '/api/componentes/agrupados')).json as Record<string, { idCom: number; stock: number; activo: boolean; idComMaster: number | null }[]>
  const piezas = Object.entries(agrupados)
    .filter(([prefijo]) => !['otro', 'g', 'mc'].includes(prefijo))
    .flatMap(([, skus]) => skus.filter((c) => c.activo && c.stock >= 1 && c.idComMaster === null))
    .slice(0, 2)
  test.skip(piezas.length < 2, 'No hay dos SKU activos con stock')
  const activos = (await llamarApi(page, 'GET', '/api/clientes/activos')).json as Cliente[]
  test.skip(activos.length === 0, 'No hay clientes activos')

  const imei = imeiSintetico()
  stockAntes = piezas.map((p) => ({ idCom: p.idCom, stock: p.stock }))
  const lote = await llamarApi(page, 'POST', '/api/asignaciones/lote', {
    telefonos: [{ imei, modelo: '13', idCli: null, clienteExplicito: false }],
    asignaciones: [{ imei, categoria: 'R', idTec, comentario: null, esChasis: false }],
  }, { 'Idempotency-Key': `e2e-cliente-historial-${imei}` })
  expect(lote.status, 'POST /api/asignaciones/lote').toBe(200)
  const creadas = (lote.json as RespuestaLote).creadas
  expect(creadas).toHaveLength(1)
  sintetico = { imei, idAsignacion: creadas[0].idRep }
  const idAsignacion = creadas[0].idRep
  test.info().annotations.push({ type: 'e2e-creado', description: `asignación ${idAsignacion} / IMEI ${imei}` })

  const fila = (idCom: number, esSolicitud: boolean) => ({
    idCom, cantidad: 1, reutilizado: false, observacion: null, prefijo: null, esSolicitud,
    descripcionSolicitud: esSolicitud ? 'Smoke e2e' : null, estadoSolicitud: null, enCamino: false,
  })
  const completa = (esSolicitud: boolean) => llamarApi(page, 'POST', '/api/reparaciones/completa', {
    filas: piezas.map((p) => fila(p.idCom, esSolicitud)), imei, idTec, idRepAnterior: null, idAsignacion, categoria: null,
  })
  expect((await completa(true)).status, 'POST /completa con las dos solicitudes').toBe(201)
  expect((await completa(false)).status, 'POST /completa con las dos piezas (resuelve y cierra)').toBe(201)

  const cerrados = await cerradosDe(page, imei)
  expect(cerrados).toHaveLength(3)
  expect(cerrados.filter((t) => t.idRep === idAsignacion)).toEqual([expect.objectContaining({ descripcion: 'Asignación', idCli: null })])
  const reparaciones = cerrados.filter((t) => t.idRep.startsWith('R')).map((t) => t.idRep)
  expect(reparaciones).toHaveLength(2)

  await page.goto(`/reparaciones/imeis/${imei}`)
  await expect(page.getByText(`IMEI: ${imei}`)).toBeVisible()
  const dialogo = await abrirCorregir(page, reparaciones[0], '— Sin cliente —')
  await expect(dialogo.getByText('Trabajos cerrados de este IMEI sin cliente:')).toBeVisible()
  await expect(dialogo.locator('li')).toHaveCount(3)
  const filaAsignacion = casillaDeId(dialogo, idAsignacion)
  await expect(filaAsignacion).toHaveCount(1)
  await expect(filaAsignacion).toContainText('Asignación')
  // Las tres del mismo día salen marcadas de entrada.
  for (const casilla of await dialogo.getByRole('checkbox').all()) await expect(casilla).toBeChecked()

  expect(await confirmarCorreccion(page, dialogo, activos[0].nombre, [idAsignacion, ...reparaciones])).toBe(204)
  for (const id of reparaciones) await expect(filaDeId(page, id).locator('td[data-columna="cliente"]')).toHaveText(activos[0].nombre)
  for (const t of await cerradosDe(page, imei)) expect(t.idCli, t.idRep).toBe(activos[0].idCli)
})

/** Solo lectura: el administrador no tiene el menú de edición del Historial, pero sí «Corregir cliente»; y en «Ver logs»
 *  están las líneas CORREGIR_CLIENTE_TRABAJO de las correcciones de los dos primeros tests, con el cliente anterior y el
 *  nuevo. */
test('admin: el menú ofrece Corregir cliente y no Editar, y Ver logs muestra las correcciones', async ({ page }) => {
  const { usuario, clave } = credenciales('ADMIN_USER', 'ADMIN_PASS')
  await entrar(page, usuario, clave)
  await page.goto('/reparaciones/historial')
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

  const eleccion = await elegirTrabajo(page, '/api/reparaciones/historial', 'R')
  test.skip(!eleccion, 'No hay una reparación cerrada con un cliente activo')
  const { idRep, imei, original } = eleccion!
  await page.getByPlaceholder('Filtrar por IMEI').fill(imei)
  await filaDeId(page, idRep).locator('td[data-columna="cliente"]').click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Corregir cliente' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Editar' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Corregir cliente' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Corregir cliente' })
  await expect(dialogo.getByText(`guardado ahora: ${original.nombre}`)).toBeVisible()
  await dialogo.getByRole('button', { name: 'Cerrar' }).click()
  await expect(dialogo).toBeHidden()

  expect(correcciones.length, 'correcciones de los tests 1 y 2').toBeGreaterThan(0)
  const hoy = hoyMadrid()
  await page.getByRole('button', { name: /Hola,/ }).click()
  await page.getByRole('menuitem', { name: 'Ver logs', exact: true }).click()
  await expect(page).toHaveURL(/\/gestion\/logs$/)
  await page.getByLabel('Desde:').fill(hoy)
  await page.getByLabel('Hasta:').fill(hoy)
  const filtrada = page.waitForResponse((r) => {
    const u = new URL(r.url())
    return u.pathname === '/api/logs' && r.request().method() === 'GET' && u.searchParams.get('accion') === 'CORREGIR_CLIENTE_TRABAJO'
  })
  await page.getByPlaceholder('Acción...').fill('CORREGIR_CLIENTE_TRABAJO')
  await page.getByRole('option', { name: 'CORREGIR_CLIENTE_TRABAJO', exact: true }).click()
  expect((await filtrada).ok(), 'GET /api/logs?accion=CORREGIR_CLIENTE_TRABAJO').toBe(true)
  for (const c of correcciones) {
    const detalle = `ID_REP: ${c.idRep}, IMEI: ${c.imei}, ID_CLI: ${c.antes} → ${c.despues}`
    await expect(page.getByRole('row').filter({ hasText: detalle }).first()).toBeVisible()
  }
})

/**
 * Limpieza con la sesión del supertécnico de todo lo que cuelga del IMEI sintético del test 3: primero las reparaciones R…
 * (DELETE /api/reparaciones/{id}: devuelven su unidad al stock) y después la asignación, abierta o cerrada, por
 * DELETE /api/reparaciones/asignaciones/{id}, que no toca el stock. Por la ruta general, el servidor devolvería al stock
 * también las filas de pieza de la asignación (las solicitudes resueltas), que no gastaron stock: la pieza la gastó la
 * reparación. Después, que no quede ninguna reparación ni solicitud del IMEI, el teléfono, y que el stock de los dos SKU
 * vuelva a ser el de antes. Los fallos se señalan con expect.soft.
 */
test.afterAll(async () => {
  const page = sup
  const datos = sintetico
  const antes = stockAntes
  sup = null
  sintetico = null
  stockAntes = []
  if (!page) return
  try {
    if (!datos) return
    const motivo = { motivo: 'Limpieza del smoke e2e' }
    const delImei = await llamarApi(page, 'GET', `/api/reparaciones/imei/${datos.imei}`)
    expect.soft(delImei.status, 'limpieza GET reparaciones del IMEI').toBe(200)
    if (delImei.status === 200) {
      const ids = (delImei.json as { idRep: string }[]).map((r) => r.idRep).filter((id) => id !== datos.idAsignacion)
      for (const idRep of ids) {
        const r = await llamarApi(page, 'DELETE', `/api/reparaciones/${idRep}`, motivo)
        expect.soft(r.status, `limpieza DELETE /api/reparaciones/${idRep}`).toBe(204)
      }
    }
    const asignacion = await llamarApi(page, 'DELETE', `/api/reparaciones/asignaciones/${datos.idAsignacion}`, motivo)
    expect.soft(asignacion.status, `limpieza DELETE /api/reparaciones/asignaciones/${datos.idAsignacion}`).toBe(204)
    expect.soft((await llamarApi(page, 'GET', `/api/reparaciones/imei/${datos.imei}`)).json, `limpieza: sin reparaciones del IMEI ${datos.imei}`).toEqual([])
    const solicitudes = await llamarApi(page, 'GET', '/api/solicitudes')
    if (solicitudes.status === 200) {
      expect.soft((solicitudes.json as { imei: string }[]).filter((s) => s.imei === datos.imei), `limpieza: sin solicitudes del IMEI ${datos.imei}`).toEqual([])
    }
    const borrado = await llamarApi(page, 'DELETE', `/api/telefonos/${datos.imei}`)
    expect.soft(borrado.status, `limpieza DELETE /api/telefonos/${datos.imei}`).toBe(204)
    const inventario = await llamarApi(page, 'GET', '/api/telefonos/inventario')
    if (inventario.status === 200) {
      expect.soft((inventario.json as { imei: string }[]).filter((t) => t.imei === datos.imei), `limpieza: sin teléfono ${datos.imei}`).toEqual([])
    }
    const agrupados = (await llamarApi(page, 'GET', '/api/componentes/agrupados')).json as Record<string, { idCom: number; stock: number }[]>
    const todos = Object.values(agrupados).flat()
    for (const { idCom, stock } of antes) {
      expect.soft(todos.find((c) => c.idCom === idCom)?.stock, `limpieza: stock del componente ${idCom} como antes del test`).toBe(stock)
    }
  } finally {
    await page.close()
  }
})
