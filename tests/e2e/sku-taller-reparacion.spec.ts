import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// sku-taller-reparacion.spec.ts (0.9.21, spec «SKU del taller», pieza 2): una reparación con un chasis de otro color
// (reutilizado: no gasta stock) cambia sola el color y el grado del móvil de prueba; el stock, la ficha, el rastro y
// «Por pasar a NSYS» lo enseñan; borrar la reparación lo deshace y lo saca de la
// lista. Solo contra PREPRODUCCIÓN (se niega a seguir sin el letrero) y con el móvil SINTÉTICO del guion de preprod (el de
// sku-taller.spec.ts: por defecto 350000000009921, grado B; otro con E2E_IMEI_TALLER): nunca un móvil real. La asignación de
// prueba es del propio supertécnico (E2E_USER) y, al acabar, se borra todo lo del taller de ese IMEI.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_TALLER ?? '350000000009921'
const SIN_NADA = 'Este móvil no tiene nada del taller'
const MOTIVO = 'E2E 0.9.21: SKU del taller desde una reparación'

type Respuesta = { estado: number; cuerpo: unknown }
type Valores = { color: string | null; grado: string | null }
type Previa = { enNsys: boolean; antes: Valores; despues: Valores; colorSinDeducir: boolean; gradoSinCalcular: boolean }
type Chasis = { idCom: number; tipo: string; antes: Valores; despues: Valores }

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

/** Un chasis del iPhone 13 (ni Pro ni mini) que, reutilizado, cambia el color del móvil de prueba a otro que se deduce. Lo
 *  calcula la previa del servidor (la misma cuenta que al guardar; el formulario ya no la enseña desde el 22/10). */
async function elegirChasis(page: Page): Promise<Chasis> {
  const r = await pedir(page, 'GET', '/api/componentes/agrupados')
  expect(r.estado, 'GET /api/componentes/agrupados').toBe(200)
  const chasis = ((r.cuerpo as Record<string, { idCom: number; tipo: string; activo: boolean }[]>).cha ?? [])
    .filter((c) => c.activo && /^chai13(?!pro|mini)[a-z]+$/.test(c.tipo))
  for (const c of chasis) {
    const p = await pedir(page, 'POST', '/api/reparaciones/sku-taller/previsualizar', { imei: IMEI, filas: [{ idRep: null, idCom: c.idCom, reutilizada: true }] })
    expect(p.estado, 'POST /api/reparaciones/sku-taller/previsualizar').toBe(200)
    const previa = p.cuerpo as Previa
    if (previa.enNsys && !previa.colorSinDeducir && previa.despues.color !== previa.antes.color
      && !previa.gradoSinCalcular && previa.despues.grado !== previa.antes.grado) {
      return { idCom: c.idCom, tipo: c.tipo, antes: previa.antes, despues: previa.despues }
    }
  }
  throw new Error(`Ningún chasis del iPhone 13 cambia el color del móvil de prueba ${IMEI}: revisa el catálogo de preprod`)
}

test.describe('0.9.21: SKU del taller desde una reparación', () => {
  test.describe.configure({ mode: 'serial' })
  let pagina: Page
  // Solo true tras comprobar el letrero de preprod: sin eso la limpieza (DELETE) no corre.
  let enPreprod = false
  let chasis: Chasis
  let idAsig: string
  let idRep: string | null = null

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    enPreprod = true
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `falta el móvil sintético ${IMEI} en el espejo de preprod (lo mete el guion)`).toBe(200)
    await limpiar(pagina)
    const ficha = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).cuerpo as { grado: string; porPasar: boolean }
    expect(ficha, 'el móvil de prueba empieza en B y sin nada del taller').toMatchObject({ grado: 'B', porPasar: false })
    chasis = await elegirChasis(pagina)
    const idTec = await pagina.evaluate(() => (JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { idTec?: number }).idTec)
    expect(typeof idTec, 'idTec del supertécnico en la sesión').toBe('number')
    const lote = await pedir(pagina, 'POST', '/api/asignaciones/lote', {
      telefonos: [{ imei: IMEI, modelo: '13', idCli: null, clienteExplicito: false }],
      asignaciones: [{ imei: IMEI, categoria: 'R', idTec, comentario: MOTIVO, esChasis: false }],
    }, { 'Idempotency-Key': `e2e-sku-taller-${Date.now()}` })
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

  test('una reparación con un chasis de otro color cambia el color y el grado y sale en «Por pasar a NSYS»', async () => {
    const { tipo, antes, despues } = chasis
    await pagina.goto(`/reparaciones/pendientes/reparar/${idAsig}`)
    const formulario = pagina.getByRole('dialog', { name: /^Nueva reparación — IMEI / })
    await expect(formulario).toBeVisible({ timeout: 30_000 })
    const modelo = formulario.getByRole('combobox', { name: 'Filtrar por modelo' })
    if (await modelo.isEnabled()) {
      await modelo.click()
      await pagina.getByRole('listbox').getByRole('button', { name: 'iPhone 13', exact: true }).click()
    }
    const fila = formulario.getByTestId('fila-cha')
    await fila.getByRole('button', { name: 'Reutilizada Chasis' }).first().click()
    await fila.getByRole('combobox', { name: 'SKU de Chasis' }).click()
    await pagina.getByRole('listbox', { name: 'SKU de Chasis' }).getByTitle(tipo, { exact: true }).click()
    const boton = formulario.getByTestId('zona-guardar').getByRole('button')
    await boton.click()
    await expect(boton).toHaveText('✓  Confirmar terminar')
    await boton.click()
    await expect(formulario).toHaveCount(0, { timeout: 30_000 })

    const reparaciones = await pedir(pagina, 'GET', `/api/reparaciones/imei/${IMEI}`)
    idRep = (reparaciones.cuerpo as { idRep: string }[]).map((r) => r.idRep).find((id) => id.startsWith('R')) ?? null
    expect(idRep, 'la reparación creada').not.toBeNull()

    // El stock: el buscador enseña el color nuevo con la marca y lo de NSYS.
    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' }).fill(IMEI)
    await expect(pagina.getByRole('button', {
      name: new RegExp(`^${IMEI} · .*${escapar(despues.color ?? '')} taller NSYS: ${escapar(antes.color ?? '')} · `),
    })).toBeVisible({ timeout: 30_000 })
    await pagina.keyboard.press('Escape')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS \(\d+\)$/ }).click()
    const enLista = pagina.getByRole('table', { name: 'Móviles por pasar a NSYS' }).getByRole('row', { name: new RegExp(IMEI) })
    await expect(enLista).toContainText(`Color: reparación ${idRep}`)
    await expect(enLista).toContainText(`Grado: reparación ${idRep}`)

    // La ficha y el rastro.
    await pagina.goto(`/reparaciones/imeis/${IMEI}`)
    const ficha = pagina.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toContainText(`NSYS: ${antes.color}`, { timeout: 30_000 })
    await expect(ficha).toContainText('Por pasar a NSYS:')
    await ficha.getByRole('button', { name: /^Ver rastro/ }).click()
    const rastro = pagina.getByRole('dialog', { name: 'Rastro' })
    await expect(rastro).toContainText(`Taller: color ${antes.color} → ${despues.color} (reparación ${idRep} · `)
    await expect(rastro).toContainText(`Taller: grado ${antes.grado} → ${despues.grado} (reparación ${idRep} · `)
    await pagina.keyboard.press('Escape')
  })

  test('borrar la reparación deshace el color y el grado y la saca de la lista', async () => {
    expect(idRep, 'el test anterior dejó la reparación').not.toBeNull()
    const { antes, despues } = chasis
    const b = await pedir(pagina, 'DELETE', `/api/reparaciones/${idRep}`, { motivo: MOTIVO })
    expect(b.estado, `DELETE /api/reparaciones/${idRep}`).toBe(204)
    await pagina.goto(`/reparaciones/imeis/${IMEI}`)
    const ficha = pagina.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toBeVisible({ timeout: 30_000 })
    await expect(ficha).not.toContainText('Por pasar a NSYS:')
    await ficha.getByRole('button', { name: /^Ver rastro/ }).click()
    const rastro = pagina.getByRole('dialog', { name: 'Rastro' })
    await expect(rastro).toContainText(`Se deshace: color ${despues.color} → ${antes.color} (se borró la reparación ${idRep}`)
    await expect(rastro).toContainText(`Se deshace: grado ${despues.grado} → ${antes.grado} (se borró la reparación ${idRep}`)
    await pagina.keyboard.press('Escape')
    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS \(\d+\)$/ }).click()
    const tabla = pagina.getByRole('table', { name: 'Móviles por pasar a NSYS' })
    await expect(tabla).toBeVisible()
    // Sin esperar a que acabe la carga, «0 filas» se cumpliría con la lista aún vacía.
    await expect(tabla.getByText('Cargando…')).toHaveCount(0)
    await expect(tabla.getByRole('row', { name: new RegExp(IMEI) })).toHaveCount(0)
  })
})
