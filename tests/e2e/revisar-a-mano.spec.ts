import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// revisar-a-mano.spec.ts (0.9.22 pieza 4): un móvil sin grado («n/a») con trabajo del taller sale en «Revisar a mano» como «Sin
// grado en NSYS»; una batería nueva se recuerda (sale en la fila); un chasis después le pone la A con el 100: sale en «Cambio de
// grado», deja «Sin grado» y el rastro dice «Batería resuelta por el ERP». Solo contra PREPRODUCCIÓN (se niega sin el letrero) y
// con el móvil SINTÉTICO sin grado del guion de preprod (por defecto 350000000009924, copia de un iPhone 13 128GB con GRADE
// «n/a»; otro con E2E_IMEI_SIN_GRADO): nunca uno real. Las asignaciones son del propio supertécnico (E2E_USER) y, al acabar, se
// borra todo lo del taller de ese IMEI (los avisos y el registro de actividad los limpia el guion).
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_SIN_GRADO ?? '350000000009924'
const SIN_NADA = 'Este móvil no tiene nada del taller'
const MOTIVO = 'E2E 0.9.22 pieza 4: Revisar a mano'

type Respuesta = { estado: number; cuerpo: unknown }
type FilaSinGrado = { imeiSn: string; ultimoTrabajo: string; bateriaIdRep: string | null; bateriaNueva: boolean | null }
type Tarjetas = { sinGrado: FilaSinGrado[]; grado: { imeiSn: string; gradoA: string | null }[] }
type Previa = { enNsys: boolean; despues: { color: string | null; grado: string | null }; colorSinDeducir: boolean }

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

/** Lo del taller de ese IMEI fuera: las reparaciones (las R… antes que las asignaciones; borrar una R… deshace lo suyo), el
 *  teléfono del lote y, por si quedó algo a mano, «Volver a lo de NSYS». */
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

async function tarjetas(page: Page): Promise<Tarjetas> {
  const r = await pedir(page, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')
  expect(r.estado, 'GET /api/stock-telefonos/por-pasar/tarjetas').toBe(200)
  return r.cuerpo as Tarjetas
}

/** Una asignación de reparación del propio supertécnico para el móvil de prueba; devuelve su A…. */
async function asignar(page: Page, idTec: number, clave: string): Promise<string> {
  const lote = await pedir(page, 'POST', '/api/asignaciones/lote', {
    telefonos: [{ imei: IMEI, modelo: '13', idCli: null, clienteExplicito: false }],
    asignaciones: [{ imei: IMEI, categoria: 'R', idTec, comentario: MOTIVO, esChasis: false }],
  }, { 'Idempotency-Key': `e2e-revisar-${clave}-${Date.now()}` })
  expect(lote.estado, 'POST /api/asignaciones/lote').toBe(200)
  const creadas = (lote.cuerpo as { creadas: { idRep: string }[] }).creadas
  expect(creadas, 'una asignación de prueba').toHaveLength(1)
  return creadas[0].idRep
}

/** «Terminar asignación» desde el formulario con una sola pieza: la fila ({@code fila}, p. ej. «fila-bat»), su botón («Nueva
 *  Batería», «Reutilizada Chasis») y, si va por color, su SKU. */
async function terminar(page: Page, idAsig: string, fila: string, boton: string, sku?: { combo: string; tipo: string }) {
  await page.goto(`/reparaciones/pendientes/reparar/${idAsig}`)
  const formulario = page.getByRole('dialog', { name: /^Nueva reparación — IMEI / })
  await expect(formulario).toBeVisible({ timeout: 30_000 })
  const modelo = formulario.getByRole('combobox', { name: 'Filtrar por modelo' })
  if (await modelo.isEnabled()) {
    await modelo.click()
    await page.getByRole('listbox').getByRole('button', { name: 'iPhone 13', exact: true }).click()
  }
  const f = formulario.getByTestId(fila)
  const elegir = f.getByRole('button', { name: boton }).first()
  await expect(elegir, `«${boton}» deshabilitado: ¿sin stock de esa pieza en preprod?`).toBeEnabled()
  await elegir.click()
  if (sku) {
    await f.getByRole('combobox', { name: sku.combo }).click()
    await page.getByRole('listbox', { name: sku.combo }).getByTitle(sku.tipo, { exact: true }).click()
  }
  const guardar = formulario.getByTestId('zona-guardar').getByRole('button')
  await guardar.click()
  await expect(guardar).toHaveText('✓  Confirmar terminar')
  await guardar.click()
  await expect(formulario).toHaveCount(0, { timeout: 30_000 })
}

/** Un chasis reutilizado del iPhone 13 (ni Pro ni mini) cuyo color se deduce y que, con la batería nueva recordada, deja el móvil
 *  en A100 según la previa del servidor (la misma cuenta que al guardar). */
async function elegirChasis(page: Page): Promise<string> {
  const r = await pedir(page, 'GET', '/api/componentes/agrupados')
  expect(r.estado, 'GET /api/componentes/agrupados').toBe(200)
  const chasis = ((r.cuerpo as Record<string, { idCom: number; tipo: string; activo: boolean }[]>).cha ?? [])
    .filter((c) => c.activo && /^chai13(?!pro|mini)[a-z]+$/.test(c.tipo))
  for (const c of chasis) {
    const p = await pedir(page, 'POST', '/api/reparaciones/sku-taller/previsualizar', { imei: IMEI, filas: [{ idRep: null, idCom: c.idCom, reutilizada: true }] })
    expect(p.estado, 'POST /api/reparaciones/sku-taller/previsualizar').toBe(200)
    const previa = p.cuerpo as Previa
    if (previa.enNsys && !previa.colorSinDeducir && previa.despues.grado === 'A100') return c.tipo
  }
  throw new Error(`Ningún chasis del iPhone 13 deja ${IMEI} en A100 con la batería recordada: revisa el catálogo de preprod o la batería`)
}

async function abrirRevisarAMano(page: Page) {
  await page.goto('/telefonos/stock')
  await page.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
  await page.getByRole('button', { name: 'Revisar a mano' }).click()
  const tabla = page.getByRole('table', { name: 'Revisar a mano' })
  await expect(tabla).toBeVisible()
  await expect(tabla.getByText('Cargando…')).toHaveCount(0)
  return tabla
}

test.describe('0.9.22 pieza 4: Revisar a mano con «Sin grado en NSYS» y la batería recordada', () => {
  test.describe.configure({ mode: 'serial' })
  let pagina: Page
  // Solo true tras comprobar el letrero de preprod: sin eso la limpieza (DELETE) no corre.
  let enPreprod = false
  let idTec: number
  let idAsig: string
  let bateria: string | null = null

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    enPreprod = true
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `falta el móvil sintético ${IMEI} en el espejo de preprod (lo mete el guion)`).toBe(200)
    await limpiar(pagina)
    const ficha = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).cuerpo as { grado: string; porPasar: boolean }
    expect(ficha, 'el móvil de prueba empieza en «n/a» y sin nada del taller').toMatchObject({ grado: 'n/a', porPasar: false })
    idTec = await pagina.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec) as number
    expect(typeof idTec, 'idTec del supertécnico en la sesión').toBe('number')
  })

  test.afterAll(async () => {
    try {
      if (pagina && enPreprod) await limpiar(pagina)
    } finally {
      await pagina?.close()
    }
  })

  test('con una asignación sale en «Sin grado en NSYS», sin «Revisado»', async () => {
    idAsig = await asignar(pagina, idTec, 'bateria')
    expect((await tarjetas(pagina)).sinGrado.find((f) => f.imeiSn === IMEI)).toMatchObject({ ultimoTrabajo: idAsig, bateriaIdRep: null })
    const fila = (await abrirRevisarAMano(pagina)).getByRole('row', { name: new RegExp(IMEI) })
    await expect(fila).toContainText('Sin grado en NSYS')
    await expect(fila).toContainText('NSYS: n/a')
    await expect(fila.getByRole('button', { name: /^Revisado/ })).toHaveCount(0)
  })

  test('una batería nueva se recuerda en la fila', async () => {
    await terminar(pagina, idAsig, 'fila-bat', 'Nueva Batería')
    const f = (await tarjetas(pagina)).sinGrado.find((x) => x.imeiSn === IMEI)
    expect(f, 'sigue sin grado tras la batería').toBeDefined()
    expect(f).toMatchObject({ bateriaNueva: true })
    bateria = f?.bateriaIdRep ?? null
    expect(bateria).toMatch(/^R/)
    const fila = (await abrirRevisarAMano(pagina)).getByRole('row', { name: new RegExp(IMEI) })
    await expect(fila).toContainText(`Batería nueva del`)
    await expect(fila).toContainText(`(${bateria})`)
  })

  test('un chasis después le pone A100: sale en «Cambio de grado», deja «Sin grado» y el rastro lo dice', async () => {
    expect(bateria, 'el test anterior dejó la batería').not.toBeNull()
    const tipo = await elegirChasis(pagina)
    const idAsig2 = await asignar(pagina, idTec, 'chasis')
    await terminar(pagina, idAsig2, 'fila-cha', 'Reutilizada Chasis', { combo: 'SKU de Chasis', tipo })
    const t = await tarjetas(pagina)
    expect(t.sinGrado.some((x) => x.imeiSn === IMEI), 'ya tiene letra: fuera de «Sin grado»').toBe(false)
    expect(t.grado.find((x) => x.imeiSn === IMEI)).toMatchObject({ gradoA: 'A100' })
    await pagina.goto(`/reparaciones/imeis/${IMEI}`)
    const ficha = pagina.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toBeVisible({ timeout: 30_000 })
    await ficha.getByRole('button', { name: /^Ver rastro/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Rastro' })).toContainText(`Batería resuelta por el ERP · grado A100 (reparación ${bateria})`)
    await pagina.keyboard.press('Escape')
  })
})
