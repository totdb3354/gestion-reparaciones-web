import { expect, test, type Page, type Response } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// 0.9.15 «Añadir otro»: los otros pedidos dentro del bloque de su proveedor. Un recorrido en serie con la sesión del
// supertécnico (E2E_USER), abierta una vez en beforeAll (el entorno limita los inicios de sesión por minuto). Todo lo que
// toca lo crea el propio fichero: un proveedor sintético «E2E Otros <marca>», una línea de E2E_SKU_PRUEBA a 2 € y dos otros
// con conceptos sintéticos a 1 €. Solo contra PREPRODUCCIÓN: beforeAll se niega a seguir sin el letrero. Lo recibido no
// vuelve a pendiente: afterAll lo deja en el estado más inocuo (desrecibir y cancelar), comprueba que el stock del SKU queda
// como estaba y avisa de lo que quede; la limpieza 2c de la guía de preprod borra después las líneas del proveedor sintético.
test.describe.configure({ mode: 'serial' })

/** Lo que el test lee de GET /api/compras y GET /api/compras-otros (schema.d.ts: CompraComponente y CompraOtro). Se repite
 *  a mano porque el e2e no importa código de la app. */
type Pieza = { idCompra: number; idProv: number; idBloque: number | null; estado: string; updatedAt: string }
type Otro = { idCompraOtro: number; idProv: number; idBloque: number | null; estado: string; updatedAt: string }
type RespuestaLote = { idsCreados: number[]; idsOtrosCreados: number[] }

const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const marca = Date.now()
const nombreProv = `E2E Otros ${marca}`
const concepto1 = `e2e otro ${marca}`
const concepto2 = `e2e otro bis ${marca}`
const sku = process.env.E2E_SKU_PRUEBA

/** Página con la sesión del supertécnico, abierta en beforeAll. */
let sup: Page | null = null
let idProv: number | null = null
let stockInicial: number | null = null

// Estado que se pasan los tests entre sí (van en serie).
let bloque = 0
let idPieza = 0
let idOtro1 = 0
let idOtro2 = 0

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

/** Petición a la API con el token de la sesión de la página (patrón de pedidos.spec.ts). */
async function llamarApi(page: Page, metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ metodo, ruta, cuerpo }) => {
      const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
      const headers: Record<string, string> = { Authorization: `Bearer ${sesion.token}` }
      if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
      const r = await fetch(ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
      const texto = await r.text()
      return { status: r.status, json: texto === '' ? null : (JSON.parse(texto) as unknown) }
    },
    { metodo, ruta, cuerpo },
  )
}

/** Las líneas del proveedor sintético de una de las dos listas, filtradas dentro de la página para no traer todo el
 *  historial por el protocolo. */
async function delProveedor<T>(page: Page, ruta: '/api/compras' | '/api/compras-otros', id: number): Promise<T[]> {
  const filas = await page.evaluate(async ({ ruta, idProv }) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const r = await fetch(ruta, { headers: { Authorization: `Bearer ${sesion.token}` } })
    if (!r.ok) throw new Error(`GET ${ruta}: ${r.status}`)
    return ((await r.json()) as { idProv: number }[]).filter((l) => l.idProv === idProv)
  }, { ruta, idProv: id })
  return filas as unknown as T[]
}

const piezas = () => delProveedor<Pieza>(sup!, '/api/compras', idProv!)
const otros = () => delProveedor<Otro>(sup!, '/api/compras-otros', idProv!)
const pieza = async (id: number) => (await piezas()).find((p) => p.idCompra === id)
const otro = async (id: number) => (await otros()).find((o) => o.idCompraOtro === id)
const bloquesDe = async () => [...new Set([...(await piezas()), ...(await otros())].map((l) => l.idBloque).filter((b): b is number => b !== null))]
const estados = async () => [...(await piezas()), ...(await otros())].map((l) => l.estado)

/** Stock del SKU de prueba (E2E_SKU_PRUEBA: activo y sin master), leído del listado de Stock (patrón de bloques.spec.ts). */
async function stockDelSku(page: Page): Promise<number> {
  const r = await llamarApi(page, 'GET', '/api/componentes/gestionados')
  expect(r.status, `GET /api/componentes/gestionados respondió ${r.status}`).toBe(200)
  const c = (r.json as { tipo: string; stock: number }[]).find((x) => x.tipo === sku)
  expect(c, `No hay componente ${sku}`).toBeTruthy()
  return c!.stock
}

const esRespuesta = (ruta: string, metodo: string) => (r: Response) => new URL(r.url()).pathname === ruta && r.request().method() === metodo
const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** «Bloque n» sin casar con «Bloque n0». */
const reBloque = (n: number) => new RegExp(`Bloque ${n}(?!\\d)`)
/** Cabecera del bloque n (fila `data-cabecera` de DataTable). */
const cabecera = (page: Page, n: number) => page.locator('tr[data-cabecera]').filter({ hasText: reBloque(n) })
/** La fila cuya celda de ID es EXACTAMENTE `id` («123» de una pieza u «O-45» de un otro). */
const filaDeId = (page: Page, id: string) =>
  page.getByRole('row').filter({ has: page.locator('td[data-columna="id"]', { hasText: new RegExp(`^\\s*${escaparRegex(id)}\\s*$`) }) })

async function elegirEnMenuBloque(page: Page, n: number, entrada: RegExp) {
  await cabecera(page, n).getByRole('button', { name: `Acciones del bloque ${n}` }).click()
  await page.getByRole('menuitem', { name: entrada }).click()
}

test.beforeAll(async ({ browser }, testInfo) => {
  const usuario = process.env.E2E_USER
  const clave = process.env.E2E_PASS
  if (!usuario || !clave || !sku) return // los tests se saltan en beforeEach
  sup = await browser.newPage({ baseURL: testInfo.project.use.baseURL })
  await entrar(sup, usuario, clave)
  // Guarda contra producción: este fichero escribe, así que solo sigue si la web enseña el letrero de preproducción.
  const preprod = await sup.getByText(LETRERO_PRE).isVisible()
  if (!preprod) {
    await sup.close()
    sup = null
    throw new Error(`otros-en-bloques.spec.ts escribe datos: se niega a correr sin el letrero «${LETRERO_PRE}» (solo contra PREPRODUCCIÓN)`)
  }
  stockInicial = await stockDelSku(sup)
  const alta = await llamarApi(sup, 'POST', '/api/proveedores', { nombre: nombreProv, divisa: 'EUR', tipo: 'COMPONENTES' })
  expect(alta.status, `POST /api/proveedores respondió ${alta.status}`).toBe(201)
  const lista = await llamarApi(sup, 'GET', '/api/proveedores?tipo=COMPONENTES')
  const creados = (lista.json as { idProv: number; nombre: string }[]).filter((p) => p.nombre === nombreProv)
  expect(creados).toHaveLength(1)
  idProv = creados[0].idProv
})

test.beforeEach(() => {
  credenciales('E2E_USER', 'E2E_PASS')
  test.skip(!sku, 'Falta E2E_SKU_PRUEBA')
  test.skip(sup === null || idProv === null, 'Sin sesión o sin proveedor de prueba (beforeAll)')
})

/** Limpieza robusta: por cada línea del proveedor sintético (piezas y otros) intenta borrarla; si no se puede, la lleva al
 *  estado más inocuo (recibida → desrecibir, que devuelve el stock de la pieza; en camino → cancelar) y reintenta. Después
 *  borra el proveedor o, si no puede, lo desactiva. Por último comprueba que el stock del SKU es el de antes. Lo que no se
 *  pueda borrar queda en el aviso. */
test.afterAll(async () => {
  if (!sup) return
  const pagina = sup
  const residuos: string[] = []
  /** Borra la línea o la lleva a cancelada. `leer` devuelve su estado de ahora (undefined si ya no existe). */
  async function limpiar(ruta: string, leer: () => Promise<{ estado: string; updatedAt: string } | undefined>) {
    for (let paso = 0; paso < 4; paso++) {
      const l = await leer()
      if (!l) return
      const borrado = await llamarApi(pagina, 'DELETE', ruta)
      if (borrado.status === 200 || borrado.status === 204) return
      if (l.estado === 'recibido') await llamarApi(pagina, 'PATCH', `${ruta}/desrecibir`, { updatedAt: l.updatedAt })
      else if (l.estado === 'en_camino') await llamarApi(pagina, 'PATCH', `${ruta}/cancelar`, { updatedAt: l.updatedAt })
      else return
    }
  }
  try {
    if (idProv !== null) {
      for (const p of await piezas()) await limpiar(`/api/compras/${p.idCompra}`, () => pieza(p.idCompra))
      for (const o of await otros()) await limpiar(`/api/compras-otros/${o.idCompraOtro}`, () => otro(o.idCompraOtro))
      for (const p of await piezas()) residuos.push(`pieza ${p.idCompra} (${p.estado})`)
      for (const o of await otros()) residuos.push(`otro O-${o.idCompraOtro} (${o.estado})`)
      const proveedor = await llamarApi(pagina, 'DELETE', `/api/proveedores/${idProv}`)
      if (proveedor.status !== 204 && proveedor.status !== 200) {
        const baja = await llamarApi(pagina, 'PATCH', `/api/proveedores/${idProv}/activo`, { activo: false })
        residuos.push(`proveedor ${idProv} «${nombreProv}» (DELETE respondió ${proveedor.status}; desactivado: ${baja.status})`)
      }
    }
    if (residuos.length > 0) console.warn(`otros-en-bloques.spec: queda en el entorno de pruebas: ${residuos.join(', ')}`)
    if (stockInicial !== null) expect(await stockDelSku(pagina), 'el stock del SKU de prueba debe quedar como estaba').toBe(stockInicial)
  } finally {
    await pagina.close()
    sup = null
  }
})

test.describe('supertécnico: otros pedidos dentro de los bloques', () => {
  test('«Nuevo pedido» con una pieza y un otro al mismo proveedor crea un solo bloque con las dos', async () => {
    const page = sup!
    await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expect(page).toHaveURL(/\/stock\/pedidos$/)
    await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

    await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
    // El primer recuadro (0.9.9, varios proveedores): ComboNavy «Proveedor», opciones «{nombre} · {bloque abierto}».
    await dlg.getByRole('combobox', { name: 'Proveedor', exact: true }).click()
    await page.getByRole('listbox', { name: 'Proveedor', exact: true }).getByRole('button', { name: new RegExp(`^${escaparRegex(nombreProv)} · `) }).click()
    const recuadro = dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })
    await recuadro.getByRole('button', { name: '+ Añadir línea' }).click()
    await recuadro.getByPlaceholder('Escribe componente...').fill(sku!)
    // La lista del autocompletar va en un portal fuera del diálogo (114ca65): se busca en la página.
    await page.getByRole('option', { name: sku!, exact: true }).click()
    // Elegir la pieza pone su «Pedir 60 d» (0.9.9), que depende del entorno: el test cuenta con 1.
    await recuadro.getByLabel('Cantidad línea 1').fill('1')
    await recuadro.getByLabel('Precio línea 1').fill('2')
    await recuadro.getByRole('button', { name: '+ Añadir otro' }).click()
    const concepto = recuadro.getByLabel('Concepto línea 2')
    await expect(concepto).toBeFocused()
    await expect(concepto).toHaveAttribute('placeholder', 'Escribe el concepto…')
    await concepto.fill(concepto1)
    await recuadro.getByLabel('Precio línea 2').fill('1')
    await expect(recuadro).toContainText('2 líneas')

    const respuestaLote = page.waitForResponse(esRespuesta('/api/compras/lote', 'POST'))
    await dlg.getByRole('button', { name: 'Confirmar pedido' }).click()
    const respuesta = await respuestaLote
    expect(respuesta.ok(), `POST /api/compras/lote respondió ${respuesta.status()}`).toBe(true)
    expect(respuesta.request().postDataJSON()).toEqual({
      lineas: [{ idCom: expect.any(Number), idProv, cantidad: 1, esUrgente: false, precioUnidad: 2 }],
      solicitudes: { urgentes: [], preventivas: [] },
      destinos: null,
      otros: [{ idProv, concepto: concepto1, cantidad: 1, esUrgente: false, precioUnidad: 1 }],
    })
    const ids = (await respuesta.json()) as RespuestaLote
    expect(ids.idsCreados).toHaveLength(1)
    expect(ids.idsOtrosCreados).toHaveLength(1)
    idPieza = ids.idsCreados[0]
    idOtro1 = ids.idsOtrosCreados[0]
    await expect(dlg).toBeHidden()

    // Un solo bloque con las dos líneas.
    await expect.poll(async () => (await pieza(idPieza))?.idBloque ?? null).not.toBeNull()
    bloque = (await pieza(idPieza))!.idBloque!
    expect((await otro(idOtro1))?.idBloque).toBe(bloque)
    expect(await bloquesDe()).toEqual([bloque])

    // La lista: solo ese bloque (el buscador con cifras busca el número de bloque), agrupada por defecto.
    await page.getByPlaceholder('Buscar componente o nº de bloque…').fill(String(bloque))
    await expect(cabecera(page, bloque)).toHaveCount(1)
    await expect(cabecera(page, bloque)).toContainText('2 líneas (1 otro)')
    await expect(cabecera(page, bloque)).toContainText('3,00 €')
    const filaOtro = filaDeId(page, `O-${idOtro1}`)
    await expect(filaOtro).toContainText(concepto1)
    await expect(filaOtro.getByText('otro', { exact: true })).toBeVisible()
    await expect(filaDeId(page, String(idPieza)).getByText('pieza', { exact: true })).toBeVisible()
  })

  test('«Añadir otro…» del ⋮ suma un otro al mismo bloque; el buscador lo encuentra por su concepto', async () => {
    const page = sup!
    await elegirEnMenuBloque(page, bloque, /^Añadir otro…/)
    const dlg = page.getByRole('dialog', { name: `Añadir líneas · Bloque ${bloque}`, exact: true })
    const concepto = dlg.getByLabel('Concepto línea 1')
    await expect(concepto).toBeFocused()
    await concepto.fill(concepto2)
    await dlg.getByLabel('Precio línea 1').fill('1')
    const respuestaLote = page.waitForResponse(esRespuesta('/api/compras/lote', 'POST'))
    await dlg.getByRole('button', { name: 'Confirmar pedido' }).click()
    const respuesta = await respuestaLote
    expect(respuesta.ok(), `POST /api/compras/lote respondió ${respuesta.status()}`).toBe(true)
    expect(respuesta.request().postDataJSON()).toEqual({
      lineas: [],
      solicitudes: { urgentes: [], preventivas: [] },
      destinos: [{ idProv, idBloque: bloque }],
      otros: [{ idProv, concepto: concepto2, cantidad: 1, esUrgente: false, precioUnidad: 1 }],
    })
    idOtro2 = ((await respuesta.json()) as RespuestaLote).idsOtrosCreados[0]
    await expect(dlg).toBeHidden()

    await expect.poll(async () => (await otro(idOtro2))?.idBloque).toBe(bloque)
    await expect(cabecera(page, bloque)).toContainText('3 líneas (2 otros)')
    await expect(cabecera(page, bloque)).toContainText('4,00 €')

    const buscador = page.getByPlaceholder('Buscar componente o nº de bloque…')
    await buscador.fill(concepto2)
    await expect(cabecera(page, bloque)).toContainText('mostrando 1 de 3')
    await expect(filaDeId(page, String(idPieza))).toHaveCount(0)
    await expect(filaDeId(page, `O-${idOtro2}`)).toContainText(concepto2)
    await buscador.fill('')
    await expect(filaDeId(page, String(idPieza))).toHaveCount(1)
  })

  test('«Confirmar bloque» y «Recibir todo» con piezas y otros: el stock solo sube por la pieza', async () => {
    const page = sup!
    await elegirEnMenuBloque(page, bloque, /^Confirmar bloque \(3\)/)
    const confirmar = page.getByRole('dialog', { name: `Confirmar bloque · Bloque ${bloque}`, exact: true })
    await expect(confirmar).toContainText('Pasan a en camino (3)')
    await expect(confirmar.getByRole('checkbox', { name: `${concepto1} (ID O-${idOtro1})` })).toBeChecked()
    await expect(confirmar.getByRole('checkbox', { name: `${sku} (ID ${idPieza})` })).toBeChecked()
    const respuestaConfirmar = page.waitForResponse(esRespuesta(`/api/bloques-compra/${bloque}/confirmar`, 'POST'))
    await confirmar.getByRole('button', { name: 'Confirmar (3)' }).click()
    const rc = await respuestaConfirmar
    expect(rc.ok(), `POST /api/bloques-compra/${bloque}/confirmar respondió ${rc.status()}`).toBe(true)
    // Cada línea viaja con su tipo (0.9.15): piezas y otros tienen numeración propia.
    const vistas = (rc.request().postDataJSON() as { lineas: { idCompra: number; tipo: string }[] }).lineas
    expect(vistas.map((v) => `${v.tipo} ${v.idCompra}`).sort()).toEqual([`OTRO ${idOtro1}`, `OTRO ${idOtro2}`, `PIEZA ${idPieza}`].sort())
    await expect(confirmar).toBeHidden()
    await expect.poll(estados).toEqual(['en_camino', 'en_camino', 'en_camino'])

    await elegirEnMenuBloque(page, bloque, /^Recibir todo \(3\)/)
    const recibir = page.getByRole('dialog', { name: `Recibir todo · Bloque ${bloque}`, exact: true })
    await expect(recibir).toContainText('Se reciben (las piezas suman al stock) (3)')
    await recibir.getByRole('button', { name: 'Recibir (3)' }).click()
    await expect(recibir).toBeHidden()
    await expect.poll(estados).toEqual(['recibido', 'recibido', 'recibido'])
    // La pieza suma su cantidad (1); los otros no tocan el stock.
    await expect.poll(() => stockDelSku(page)).toBe(stockInicial! + 1)
    await expect(cabecera(page, bloque)).toContainText('3 recibido')
  })
})
