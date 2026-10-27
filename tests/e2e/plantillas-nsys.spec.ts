import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'
import { leerXlsx, type Xlsx } from './xlsx.ts'

// plantillas-nsys.spec.ts (0.9.22, spec «plantillas NSYS» §3 y §6): con el móvil SINTÉTICO del guion de preprod (por defecto
// 350000000009921; otro con E2E_IMEI_TALLER), el supertécnico le cambia el color y el grado por la API, lo ve en «Cambio de color» y
// en «Cambio de grado», descarga la plantilla de color y marca y deshace «Hecho». Mide de paso lo que tarda la lista de las tarjetas
// (el cruce de «No está en NSYS»). Solo contra PREPRODUCCIÓN (se niega sin el letrero) y deja el móvil como estaba: sin marcas y con
// «Volver a lo de NSYS».
// Además cubre lo que antes se probaba a mano en preprod: «✓ Revisado» (con doble clic) y su rastro, el contenido de las plantillas de
// color y de altas (cabecera de la vacía de NSYS, columnas, rellenos), «Copiar lista» y los números de las tarjetas y de la pestaña.
const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const IMEI = process.env.E2E_IMEI_TALLER ?? '350000000009921'
const SIN_NADA = 'Este móvil no tiene nada del taller'
const MOTIVO = 'E2E 0.9.22: prueba de las tarjetas de NSYS'

type Respuesta = { estado: number; cuerpo: unknown }
type Opcion = { color: string; producto: string | null }
type FilaConHecho = { imeiSn: string; hechoEn: string | null; hechoVolvio: string | null }
type FilaColor = FilaConHecho & { ponerProducto: string | null; compruebalo: boolean }
type FilaRevisar = { imeiSn: string; idRep: string }
// sinGrado: las filas «Sin grado en NSYS» de la 0.9.22 pieza 4 (cuentan en «Revisar a mano»; opcional por si el servidor es anterior).
type Tarjetas = { color: FilaColor[]; grado: FilaConHecho[]; altas: FilaConHecho[]; revisar: FilaRevisar[]; sinGrado?: { imeiSn: string }[] }

// Las filas 4 a 6 (A-N) de la plantilla vacía de NSYS, que las dos plantillas llevan tal cual (los datos van desde la fila 7), y el
// aviso de la fila 1. La fila 5 lleva los títulos de las columnas y la 6 el detalle de «Goods».
const AVISO_NSYS = 'Warning! Do not change the name of the columns!  New Goods, Suppliers, Groups will be written to the database automatically.'
const FILA_4 = ['(required field)', '(required field)', '(required field)', '(optional)', '(optional)', '(optional)', '(optional)',
  '(optional)', '(optional)', '(optional)', '(optional)', '(optional)', '(optional)', '(optional)']
const FILA_5 = ['IMEI/SN *', 'Goods', 'Goods', 'Goods', 'Goods', 'Grade', 'Purchase price', 'Supplier Name', 'Batch Number', 'Goods',
  'Goods', 'Goods', 'Goods', 'Status']
const FILA_6 = [null, 'Manufacturer *', 'Model *', 'Storage', 'Color', null, null, null, null, 'Group of Goods', 'EAN', 'UPC', 'Description', null]
const COLUMNAS = [...'ABCDEFGHIJKLMN']
const AMARILLO = 'FFF7CC'
const ROJO = 'FDE8E8'

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  expect(await page.getByText(LETRERO_PRE).isVisible(), `solo corre contra PREPRODUCCIÓN (letrero «${LETRERO_PRE}»)`).toBe(true)
}

/** Una petición a la API con el token de la sesión de la página (patrón de sku-taller.spec.ts). */
async function pedir(page: Page, metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta> {
  return page.evaluate(async ({ metodo, ruta, cuerpo }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const res = await fetch(ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const texto = await res.text()
    return { estado: res.status, cuerpo: texto ? (JSON.parse(texto) as unknown) : null }
  }, { metodo, ruta, cuerpo })
}

/** Lo pendiente de una tarjeta, como lo cuenta la web: sin marca «Hecho» que valga (una que «volvió» cuenta otra vez). */
const pendientesDe = (filas: FilaConHecho[]) => filas.filter((f) => f.hechoEn === null || f.hechoVolvio !== null)
const tarjetasApi = async (page: Page) => (await pedir(page, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')).cuerpo as Tarjetas

/** Las filas 1 (aviso), 4, 5 y 6 de una plantilla descargada, iguales a las de la vacía de NSYS. */
function comprobarCabecera(xlsx: Xlsx) {
  expect(xlsx.celda('A1').valor, 'aviso de la fila 1').toBe(AVISO_NSYS)
  COLUMNAS.forEach((c, i) => {
    expect(xlsx.celda(`${c}4`).valor, `${c}4`).toBe(FILA_4[i])
    expect(xlsx.celda(`${c}5`).valor, `${c}5`).toBe(FILA_5[i])
    expect(xlsx.celda(`${c}6`).valor, `${c}6`).toBe(FILA_6[i])
  })
}

/** Las líneas del portapapeles del navegador (hay que dar el permiso al contexto antes). */
const portapapeles = async (page: Page): Promise<string[]> =>
  (await page.evaluate(() => (navigator as Navigator & { clipboard: { readText(): Promise<string> } }).clipboard.readText())).split(/\r?\n/)

/** Baja la plantilla de una tarjeta con su botón y devuelve el nombre que manda el servidor y su contenido leído. Se lee la respuesta
 *  y el aviso «Descargado», que la web saca justo después de dar el fichero al navegador, y no el evento «download»: Chromium sin
 *  cabeza pierde alguna descarga automática (1 de cada ~11 en una prueba aislada, también sin revocar la URL; en preprod el
 *  26/10 llegó la respuesta 200 y no la descarga), y eso no es de la app. */
async function bajarPlantilla(page: Page, tarjeta: string) {
  const respuesta = page.waitForResponse((r) => /\/api\/stock-telefonos\/por-pasar\/plantilla-(color|altas)$/.test(new URL(r.url()).pathname))
  await page.getByRole('article', { name: tarjeta }).getByRole('button', { name: /^⬇ Descargar plantilla/ }).click()
  const r = await respuesta
  expect(r.status(), `la plantilla de «${tarjeta}»`).toBe(200)
  const nombre = /filename="([^"]+)"/.exec(r.headers()['content-disposition'] ?? '')?.[1] ?? ''
  await expect(page.getByTestId('aviso-breve'), 'la web da el fichero al navegador').toContainText(`Descargado «${nombre}»`)
  return { nombre, xlsx: leerXlsx(await r.body()) }
}

/** Sin marcas «Hecho» y sin nada del taller: 204 al quitar las marcas (aunque no hubiera) y 204, o el 400 «Este móvil no tiene
 *  nada del taller», al volver a lo de NSYS. */
async function limpiar(page: Page) {
  for (const tarjeta of ['COLOR', 'GRADO']) {
    const r = await pedir(page, 'DELETE', '/api/stock-telefonos/por-pasar/hecho', { tarjeta, imeiSn: IMEI })
    expect(r.estado, `quitar la marca ${tarjeta}: ${JSON.stringify(r.cuerpo)}`).toBe(204)
  }
  const r = await pedir(page, 'DELETE', `/api/stock-telefonos/${IMEI}/taller`, { motivo: MOTIVO })
  const detalle = `limpieza del móvil de prueba: ${r.estado} ${JSON.stringify(r.cuerpo)}`
  expect([204, 400], detalle).toContain(r.estado)
  if (r.estado === 400) expect(JSON.stringify(r.cuerpo), detalle).toContain(SIN_NADA)
}

test.describe('0.9.22: «Por pasar a NSYS» con cuatro tarjetas', () => {
  test.describe.configure({ mode: 'serial' })
  // Una sola sesión: el entorno limita los inicios de sesión por minuto.
  let pagina: Page
  // Solo true tras comprobar el letrero de preprod: sin eso la limpieza no corre.
  let enPreprod = false
  let colorNuevo = ''

  test.beforeAll(async ({ browser }, testInfo) => {
    const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
    pagina = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
    await entrar(pagina, usuario, clave)
    enPreprod = true
    expect((await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).estado,
      `el móvil de prueba ${IMEI} tiene que estar en el espejo (lo mete el guion de preprod)`).toBe(200)
    await limpiar(pagina)
  })

  test.afterAll(async () => {
    if (enPreprod) await limpiar(pagina)
    await pagina?.close()
  })

  // Va la primera: un cambio del taller hecho a mano después de un aviso lo saca de «Revisar a mano». El aviso sintético (SIN_COLOR,
  // reparación R20261026_E2E) lo mete a mano el guion de preprod, y el guion lo borra con su línea del registro.
  test('«✓ Revisado» (con doble clic) quita el aviso de «Revisar a mano» y queda en el rastro', async () => {
    const aviso = (await tarjetasApi(pagina)).revisar.find((f) => f.imeiSn === IMEI)
    test.skip(!aviso, 'no hay aviso sintético del móvil de prueba: lo mete el bloque del guion de preprod')
    const idRep = aviso!.idRep
    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
    await pagina.getByRole('button', { name: 'Revisar a mano' }).click()
    const revisado = pagina.getByRole('table', { name: 'Revisar a mano' }).getByRole('button', { name: `Revisado ${idRep} de ${IMEI}` })
    await revisado.dblclick()
    await expect(revisado).toHaveCount(0)
    await expect(pagina.getByRole('dialog', { name: 'Error' }), 'el doble clic no abre el diálogo de error').toHaveCount(0)
    expect((await tarjetasApi(pagina)).revisar.filter((f) => f.imeiSn === IMEI && f.idRep === idRep), 'el aviso ya no sale en «revisar»').toHaveLength(0)

    await pagina.goto(`/reparaciones/imeis/${IMEI}`)
    const ficha = pagina.getByRole('region', { name: 'Ficha de NSYS' })
    await expect(ficha).toBeVisible({ timeout: 30_000 })
    await ficha.getByRole('button', { name: /^Ver rastro/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Rastro' })).toContainText('Revisado por ')
    await expect(pagina.getByRole('dialog', { name: 'Rastro' })).toContainText(`(reparación ${idRep})`)
    await pagina.keyboard.press('Escape')
  })

  test('un cambio de color y de grado salen en sus dos tarjetas y la plantilla de color se descarga', async () => {
    const ficha = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}`)).cuerpo as { color: string | null }
    const opciones = (await pedir(pagina, 'GET', `/api/stock-telefonos/${IMEI}/colores`)).cuerpo as { colores: Opcion[] }
    const otro = opciones.colores.find((o) => o.color !== ficha.color && o.producto)
    test.skip(!otro, 'el modelo del móvil de prueba no tiene otro color con producto')
    colorNuevo = otro!.color
    const puesto = await pedir(pagina, 'PUT', `/api/stock-telefonos/${IMEI}/taller`, { color: colorNuevo, grado: 'A100', motivo: MOTIVO })
    expect(puesto.estado, JSON.stringify(puesto.cuerpo)).toBe(204)

    const antes = Date.now()
    const tarjetas = await pedir(pagina, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')
    const ms = Date.now() - antes
    console.log(`GET /api/stock-telefonos/por-pasar/tarjetas: ${ms} ms`)
    expect(tarjetas.estado).toBe(200)
    expect(ms, 'el límite de 15 s por petición').toBeLessThan(15_000)

    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
    const fila = pagina.getByRole('table', { name: 'Cambio de color' }).getByRole('row').filter({ hasText: IMEI })
    await expect(fila).toContainText('también en «Cambio de grado» (después)')
    // La fila del móvil de prueba, para saber qué producto va en la plantilla y si lleva «compruébalo».
    const filaApi = (tarjetas.cuerpo as Tarjetas).color.find((f) => f.imeiSn === IMEI)
    expect(filaApi?.ponerProducto, 'el móvil de prueba tiene producto al que cambiar').toBeTruthy()
    const { nombre, xlsx } = await bajarPlantilla(pagina, 'Cambio de color')
    expect(nombre).toMatch(/^NSYS_color_\d{4}-\d{2}-\d{2}\.xlsx$/)
    comprobarCabecera(xlsx)
    const filaXlsx = xlsx.filasConDatos(7, 'A').find((n) => xlsx.celda(`A${n}`).valor === IMEI)
    expect(filaXlsx, 'el móvil de prueba está en la plantilla de color').toBeDefined()
    const f = filaXlsx!
    const colorDelProducto = String(xlsx.celda(`E${f}`).valor)
    expect(filaApi!.ponerProducto!.endsWith(` ${colorDelProducto}`), `«${filaApi!.ponerProducto}» acaba en el color «${colorDelProducto}»`).toBe(true)
    expect(COLUMNAS.map((c) => xlsx.celda(`${c}${f}`).valor)).toEqual(
      [IMEI, 'Apple', 'iPhone 13', '128 GB', colorDelProducto, 'B', 123.45, 'Proveedor E2E', 'COLOR', 'iPhone', null, null, null, 0])
    if (filaApi!.compruebalo) expect(xlsx.celda(`E${f}`).relleno, 'color del maestro: en amarillo').toBe(AMARILLO)
    else expect(xlsx.celda(`E${f}`).relleno, 'color de NSYS: sin amarillo').not.toBe(AMARILLO)

    await pagina.getByRole('button', { name: 'Cambio de grado' }).click()
    await expect(pagina.getByRole('table', { name: 'Cambio de grado' }).getByRole('row').filter({ hasText: IMEI }))
      .toContainText('→ A100')

    // «Copiar lista» de grado: IMEI, producto y grado, para pegar en Excel.
    await pagina.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(pagina.url()).origin })
    await pagina.getByRole('article', { name: 'Cambio de grado' }).getByRole('button', { name: /^Copiar lista/ }).click()
    await expect.poll(async () => (await portapapeles(pagina)).filter((l) => l.includes(IMEI)).length,
      { message: 'el portapapeles lleva una línea con el móvil de prueba' }).toBe(1)
    expect((await portapapeles(pagina)).find((l) => l.includes(IMEI))).toContain('A100')
  })

  test('la plantilla de altas lleva lo de «No está en NSYS» y en rojo lo que falta', async () => {
    await pagina.goto('/telefonos/stock')
    await pagina.getByRole('button', { name: /^Por pasar a NSYS/ }).click()
    const boton = pagina.getByRole('article', { name: 'No está en NSYS' }).getByRole('button', { name: /^⬇ Descargar plantilla/ })
    await expect(boton).toBeVisible()
    // Lo pendiente, de la API: justo al abrir, el botón sale deshabilitado y sin número mientras llegan las tarjetas (en preprod
    // el 27/10 la prueba se saltaba así con 12 pendientes).
    const pendientes = pendientesDe((await tarjetasApi(pagina)).altas).length
    test.skip(pendientes === 0, 'no hay móviles pendientes en «No está en NSYS»')
    await expect(boton).toBeEnabled()
    await expect(boton).toHaveText(`⬇ Descargar plantilla (${pendientes})`)
    const n = pendientes
    const { nombre, xlsx } = await bajarPlantilla(pagina, 'No está en NSYS')
    expect(nombre).toMatch(/^NSYS_altas_\d{4}-\d{2}-\d{2}\.xlsx$/)
    comprobarCabecera(xlsx)
    const filas = xlsx.filasConDatos(7, 'A')
    expect(filas, 'tantas filas de datos como móviles dice el botón').toHaveLength(n)
    for (const f of filas) {
      const dato = (c: string) => xlsx.celda(`${c}${f}`)
      expect(dato('A').valor, `A${f}: IMEI`).toMatch(/^\S+$/)
      expect(dato('B').valor, `B${f}`).toBe('Apple')
      expect(dato('I').valor, `I${f}`).toBe('AJUSTE')
      expect(dato('J').valor, `J${f}`).toBe('iPhone')
      expect(dato('N').valor, `N${f}`).toBe(0)
      expect(dato('C').relleno, `C${f}: el modelo del taller, en rojo`).toBe(ROJO)
      for (const c of 'DEFGH') {
        expect(dato(c).valor, `${c}${f} vacía`).toBeNull()
        expect(dato(c).relleno, `${c}${f} en rojo`).toBe(ROJO)
      }
    }
  })

  test('los números de las tarjetas y de la pestaña son lo pendiente que da la API', async () => {
    await pagina.goto('/telefonos/stock')
    const pestana = pagina.getByRole('button', { name: /^Por pasar a NSYS/ })
    await pestana.click()
    await expect(pagina.getByRole('article', { name: 'Revisar a mano' })).toBeVisible()
    const t = await tarjetasApi(pagina)
    const cuenta = (total: number, hechos: number) => `${total} ${total === 1 ? 'móvil' : 'móviles'}${hechos > 0 ? ` · ${hechos} ${hechos === 1 ? 'hecho' : 'hechos'}` : ''}`
    // «Revisar a mano» cuenta los avisos y, desde la pieza 4, las filas «Sin grado en NSYS».
    const revisar = t.revisar.length + (t.sinGrado?.length ?? 0)
    let pendientes = revisar
    for (const [tarjeta, filas] of [['Cambio de color', t.color], ['Cambio de grado', t.grado], ['No está en NSYS', t.altas]] as const) {
      const pend = pendientesDe(filas).length
      pendientes += pend
      await expect(pagina.getByRole('article', { name: tarjeta }), tarjeta).toContainText(cuenta(filas.length, filas.length - pend))
    }
    await expect(pagina.getByRole('article', { name: 'Revisar a mano' })).toContainText(cuenta(revisar, 0))
    await expect(pestana, 'el número de la pestaña').toHaveAccessibleName(`Por pasar a NSYS (${pendientes})`)
  })

  test('«Hecho» marca la fila y «deshacer» la devuelve', async () => {
    test.skip(!colorNuevo, 'sin cambio de color (ver la prueba anterior)')
    await pagina.getByRole('button', { name: 'Cambio de color' }).click()
    await pagina.getByRole('button', { name: `Hecho ${IMEI}` }).click()
    await expect(pagina.getByRole('button', { name: `Deshacer Hecho de ${IMEI}` })).toBeVisible()
    const tarjetas = (await pedir(pagina, 'GET', '/api/stock-telefonos/por-pasar/tarjetas')).cuerpo as { color: FilaConHecho[] }
    expect(tarjetas.color.find((f) => f.imeiSn === IMEI)?.hechoEn, 'la marca está en el servidor').toBeTruthy()
    await pagina.getByRole('button', { name: `Deshacer Hecho de ${IMEI}` }).click()
    await expect(pagina.getByRole('button', { name: `Hecho ${IMEI}` })).toBeVisible()
  })
})
