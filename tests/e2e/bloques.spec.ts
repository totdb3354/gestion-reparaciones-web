import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page, type Response } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// 0.9.9 «Pedidos por bloques». Un único recorrido en serie con la sesión del supertécnico (E2E_USER), abierta una vez en
// beforeAll (el entorno limita los inicios de sesión por minuto). Todo lo que toca lo crea el propio fichero: un proveedor
// sintético «E2E Bloques <marca>» y líneas de E2E_SKU_PRUEBA a precio 2 y 3 €. Solo contra PREPRODUCCIÓN: beforeAll se niega
// a seguir si la web no enseña el letrero de preproducción. Una línea confirmada, recibida o cancelada no se puede volver a
// pendiente ni (probablemente) borrar: afterAll lo intenta todo y documenta lo que quede (ver el informe del fichero).
test.describe.configure({ mode: 'serial' })

/** Forma de las líneas de GET /api/compras que usa el test (schema.d.ts: CompraComponente). Se repite a mano porque el e2e
 *  no importa código de la app. */
type Linea = { idCompra: number; idBloque: number | null; estado: string; cantidad: number; cantidadRecibida: number | null; notaBloque: string | null; updatedAt: string }
type RespuestaLote = { idsCreados: number[] }

const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const marca = Date.now()
const nombreProv = `E2E Bloques ${marca}`
const nota = `e2e nota ${marca}`
const sku = process.env.E2E_SKU_PRUEBA

/** Página con la sesión del supertécnico, abierta en beforeAll. */
let sup: Page | null = null
let idProv: number | null = null
let stockInicial: number | null = null

// Estado que se pasan los tests entre sí (van en serie).
let idsBloqueA: number[] = [] // L1, L2 (test 1)
let l3 = 0 // test 2
let l4 = 0 // test 3
let bloque1 = 0 // bloque del proveedor creado en el test 1
let bloque3 = 0 // bloque de L3 tras separarla (test 5)

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

/** Líneas del proveedor sintético, filtradas dentro de la página para no traer todo el historial por el protocolo. */
async function lineasDelProveedor(page: Page, id: number): Promise<Linea[]> {
  return page.evaluate(async (idProv) => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const r = await fetch('/api/compras', { headers: { Authorization: `Bearer ${sesion.token}` } })
    if (!r.ok) throw new Error(`GET /api/compras: ${r.status}`)
    const todas = (await r.json()) as (Linea & { idProv: number })[]
    return todas.filter((c) => c.idProv === idProv).map(({ idCompra, idBloque, estado, cantidad, cantidadRecibida, notaBloque, updatedAt }) => ({ idCompra, idBloque, estado, cantidad, cantidadRecibida, notaBloque, updatedAt }))
  }, id)
}

const lineas = () => lineasDelProveedor(sup!, idProv!)
const linea = async (id: number) => (await lineas()).find((l) => l.idCompra === id)
const bloquesDe = async () => [...new Set((await lineas()).map((l) => l.idBloque).filter((b): b is number => b !== null))]

/** Stock del SKU de prueba (E2E_SKU_PRUEBA: activo y sin master, como dice .env.e2e.example). Se lee del listado de
 *  Stock: `GET /api/componentes` está retirado (403 «Esta operación ya no está disponible»). */
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
/** La fila cuya celda de id es EXACTAMENTE el id de la línea (DataTable pone `data-columna` en cada `<td>`). */
const fila = (page: Page, idCompra: number) =>
  page.getByRole('row').filter({ has: page.locator('td[data-columna="id"]', { hasText: new RegExp(`^\\s*${idCompra}\\s*$`) }) })
const celdaId = (page: Page, idCompra: number) => fila(page, idCompra).locator('td[data-columna="id"]')

async function elegirEnMenuBloque(page: Page, n: number, entrada: RegExp) {
  await cabecera(page, n).getByRole('button', { name: `Acciones del bloque ${n}` }).click()
  await page.getByRole('menuitem', { name: entrada }).click()
}

/** Elige el SKU en la línea 1 del diálogo (la única) y escribe la cantidad 1: elegir la pieza pone su «Pedir 60 d» (0.9.9),
 *  que depende de cómo esté el SKU en preproducción, y los tests cuentan con 1 (totales del bloque). */
async function elegirSku(page: Page, dlg: Locator) {
  await dlg.getByPlaceholder('Escribe componente...').fill(sku!)
  // La lista del autocompletar va en un portal fuera del diálogo (114ca65): se busca en la página.
  await page.getByRole('option', { name: sku!, exact: true }).click()
  await dlg.getByLabel('Cantidad línea 1').fill('1')
}

/**
 * Abre «Nuevo pedido» con una línea del SKU a ese precio, al proveedor sintético, y devuelve el diálogo. Mismo recorrido que
 * pedidos.spec.ts: autocompletar de componente; el proveedor, en «¿A qué proveedor pides?». Una sola línea: en un
 * mismo diálogo una pieza no se repite (0.9.9); la segunda línea del SKU se añade al bloque con `anadirLineaAlBloque`.
 */
async function rellenarNuevoPedido(page: Page, precio: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
  // «¿A qué proveedor pides?» (0.9.9, varios proveedores): ComboNavy «Proveedor», opciones «{nombre} · {bloque abierto}».
  await dlg.getByRole('combobox', { name: 'Proveedor', exact: true }).click()
  await page.getByRole('listbox', { name: 'Proveedor', exact: true }).getByRole('button', { name: new RegExp(`^${escaparRegex(nombreProv)} · `) }).click()
  await dlg.getByRole('button', { name: '+ Añadir línea' }).click()
  await elegirSku(page, dlg)
  await dlg.getByLabel('Precio línea 1').fill(precio)
  return dlg
}

/** Pulsa «Confirmar pedido» y devuelve los ids de las líneas creadas. */
async function guardarLote(page: Page, dlg: Locator): Promise<number[]> {
  const respuestaLote = page.waitForResponse(esRespuesta('/api/compras/lote', 'POST'))
  await dlg.getByRole('button', { name: 'Confirmar pedido' }).click()
  const respuesta = await respuestaLote
  expect(respuesta.ok(), `POST /api/compras/lote respondió ${respuesta.status()}`).toBe(true)
  await expect(dlg).toBeHidden()
  return ((await respuesta.json()) as RespuestaLote).idsCreados
}

/** «Añadir líneas…» del menú del bloque n: una línea del SKU a ese precio. Devuelve el id de la línea creada. Así el bloque
 *  lleva dos líneas del mismo SKU: lo de no repetir una pieza es dentro de cada diálogo. */
async function anadirLineaAlBloque(page: Page, n: number, precio: string): Promise<number> {
  await elegirEnMenuBloque(page, n, /^Añadir líneas…/)
  const dlg = page.getByRole('dialog', { name: `Añadir líneas · Bloque ${n}`, exact: true })
  await dlg.getByRole('button', { name: '+ Añadir línea' }).click()
  await elegirSku(page, dlg)
  await dlg.getByLabel('Precio línea 1').fill(precio)
  const ids = await guardarLote(page, dlg)
  expect(ids).toHaveLength(1)
  return ids[0]
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
    throw new Error(`bloques.spec.ts escribe datos: se niega a correr sin el letrero «${LETRERO_PRE}» (solo contra PREPRODUCCIÓN)`)
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

/** Limpieza robusta: por cada línea del proveedor sintético intenta borrarla; si no se puede, la lleva al estado más
 *  inocuo (recibida → desrecibir, en camino → cancelar) y reintenta. Después borra el proveedor o, si no puede, lo desactiva.
 *  Por último comprueba que el stock del SKU es el de antes. Lo que no se pueda borrar queda en el aviso. */
test.afterAll(async () => {
  if (!sup) return
  const residuos: string[] = []
  try {
    if (idProv !== null) {
      const nombreEstado = (id: number, estado: string) => `${id} (${estado})`
      for (const l0 of await lineas()) {
        for (let paso = 0; paso < 4; paso++) {
          const l = await linea(l0.idCompra)
          if (!l) break
          const borrado = await llamarApi(sup, 'DELETE', `/api/compras/${l.idCompra}`)
          if (borrado.status === 200 || borrado.status === 204) break
          if (l.estado === 'recibido') await llamarApi(sup, 'PATCH', `/api/compras/${l.idCompra}/desrecibir`, { updatedAt: l.updatedAt })
          else if (l.estado === 'en_camino') await llamarApi(sup, 'PATCH', `/api/compras/${l.idCompra}/cancelar`, { updatedAt: l.updatedAt })
          else {
            residuos.push(nombreEstado(l.idCompra, l.estado))
            break
          }
        }
      }
      for (const l of await lineas()) if (!residuos.some((r) => r.startsWith(`${l.idCompra} `))) residuos.push(nombreEstado(l.idCompra, l.estado))
      const proveedor = await llamarApi(sup, 'DELETE', `/api/proveedores/${idProv}`)
      if (proveedor.status !== 204 && proveedor.status !== 200) {
        const baja = await llamarApi(sup, 'PATCH', `/api/proveedores/${idProv}/activo`, { activo: false })
        residuos.push(`proveedor ${idProv} «${nombreProv}» (DELETE respondió ${proveedor.status}; desactivado: ${baja.status})`)
      }
    }
    if (residuos.length > 0) console.warn(`bloques.spec: queda en el entorno de pruebas: ${residuos.join(', ')}`)
    if (stockInicial !== null) expect(await stockDelSku(sup), 'el stock del SKU de prueba debe quedar como estaba').toBe(stockInicial)
  } finally {
    await sup.close()
    sup = null
  }
})

test.describe('supertécnico: pedidos por bloques', () => {
  test('Nuevo pedido crea un bloque nuevo y «Añadir líneas…» le suma una segunda línea', async () => {
    const page = sup!
    await page.goto('/stock/pedidos')
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible()
    await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()
    await page.getByPlaceholder('Buscar componente o nº de bloque…').fill(sku!)

    const dlg = await rellenarNuevoPedido(page, '2')
    const resumen = dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })
    await expect(resumen).toContainText(nombreProv)
    await expect(resumen).toContainText('1 línea')
    await expect(resumen).toContainText('Bloque nuevo (no tiene ninguno abierto)')
    const creadas = await guardarLote(page, dlg)
    expect(creadas).toHaveLength(1)
    const id1 = creadas[0]

    await expect.poll(async () => (await bloquesDe()).length).toBe(1)
    bloque1 = (await bloquesDe())[0]
    // La segunda línea, del mismo SKU, por el menú del bloque (en un mismo diálogo una pieza no se repite).
    const id2 = await anadirLineaAlBloque(page, bloque1, '3')
    idsBloqueA = [id1, id2]
    await expect.poll(async () => (await linea(id2))?.idBloque).toBe(bloque1)

    const cabeceras = page.locator('tr[data-cabecera]').filter({ hasText: nombreProv })
    await expect(cabeceras).toHaveCount(1)
    await expect(cabeceras).toContainText(`Bloque ${bloque1}`)
    await expect(cabeceras).toContainText('2 líneas')
    await expect(cabeceras).toContainText('5,00 €')
  })

  test('un segundo Nuevo pedido sugiere el bloque abierto y le suma la línea', async () => {
    const page = sup!
    const dlg = await rellenarNuevoPedido(page, '4')
    const resumen = dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })
    await expect(resumen.getByRole('combobox', { name: `Bloque de ${nombreProv}` })).toContainText(`Añadir a Bloque ${bloque1}`)
    ;[l3] = await guardarLote(page, dlg)

    await expect.poll(async () => (await linea(l3))?.idBloque).toBe(bloque1)
    expect(await bloquesDe()).toEqual([bloque1])
    await expect(cabecera(page, bloque1)).toContainText('3 líneas')
    await expect(page.locator('tr[data-cabecera]').filter({ hasText: nombreProv })).toHaveCount(1)
  })

  test('«Añadir líneas…» del menú del bloque, con el proveedor fijo', async () => {
    const page = sup!
    await elegirEnMenuBloque(page, bloque1, /^Añadir líneas…/)
    const dlg = page.getByRole('dialog', { name: `Añadir líneas · Bloque ${bloque1}`, exact: true })
    await expect(dlg).toContainText(nombreProv)
    await expect(dlg.getByRole('combobox', { name: 'Proveedor', exact: true })).toHaveCount(0)
    await dlg.getByRole('button', { name: '+ Añadir línea' }).click()
    await elegirSku(page, dlg)
    await expect(dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })).toContainText(`Bloque ${bloque1}`)
    await expect(dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })).toContainText('(fijado)')
    ;[l4] = await guardarLote(page, dlg)

    await expect.poll(async () => (await linea(l4))?.idBloque).toBe(bloque1)
    await expect(cabecera(page, bloque1)).toContainText('4 líneas')
  })

  test('mover una línea pendiente a «Bloque nuevo» y juntar el bloque de vuelta', async () => {
    const page = sup!
    await celdaId(page, l4).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Mover a bloque' }).click()
    await page.getByRole('menuitem', { name: /^Bloque nuevo/ }).click()

    await expect.poll(async () => { const b = (await linea(l4))?.idBloque; return b != null && b !== bloque1 }).toBe(true)
    const bloque2 = (await linea(l4))!.idBloque!
    await expect(cabecera(page, bloque2)).toHaveCount(1)
    await expect(cabecera(page, bloque2)).toContainText('1 línea')
    await expect(cabecera(page, bloque1)).toContainText('3 líneas')

    await elegirEnMenuBloque(page, bloque2, /^Juntar con…/)
    const dlg = page.getByRole('dialog', { name: `Juntar Bloque ${bloque2} con…`, exact: true })
    await dlg.getByRole('radio', { name: reBloque(bloque1) }).check()
    await dlg.getByRole('button', { name: 'Juntar', exact: true }).click()
    await expect(dlg).toBeHidden()

    await expect.poll(async () => (await linea(l4))?.idBloque).toBe(bloque1)
    await expect(cabecera(page, bloque2)).toHaveCount(0)
    await expect(cabecera(page, bloque1)).toContainText('4 líneas')
  })

  test('«Separar líneas…» una línea a un bloque nuevo', async () => {
    const page = sup!
    await elegirEnMenuBloque(page, bloque1, /^Separar líneas…/)
    const dlg = page.getByRole('dialog', { name: `Separar líneas · Bloque ${bloque1}`, exact: true })
    await expect(dlg.getByRole('button', { name: 'Separar', exact: true })).toBeDisabled()
    await dlg.getByRole('checkbox', { name: `Separar ${sku} (ID ${l3})` }).click()
    await dlg.getByRole('button', { name: 'Separar (1)' }).click()
    await expect(dlg).toBeHidden()

    await expect.poll(async () => { const b = (await linea(l3))?.idBloque; return b != null && b !== bloque1 }).toBe(true)
    bloque3 = (await linea(l3))!.idBloque!
    await expect(cabecera(page, bloque3)).toContainText('1 línea')
    await expect(cabecera(page, bloque1)).toContainText('3 líneas')
  })

  test('nota del bloque en la cabecera', async () => {
    const page = sup!
    await elegirEnMenuBloque(page, bloque1, /^Añadir nota…/)
    const dlg = page.getByRole('dialog', { name: `Nota · Bloque ${bloque1}`, exact: true })
    await dlg.getByLabel('Nota del bloque').fill(nota)
    await dlg.getByRole('button', { name: 'Guardar' }).click()
    await expect(dlg).toBeHidden()

    await expect(cabecera(page, bloque1)).toContainText(nota)
    expect((await linea(idsBloqueA[0]))?.notaBloque).toBe(nota)
  })

  test('Confirmar bloque pasa las líneas a «en camino»', async () => {
    const page = sup!
    await elegirEnMenuBloque(page, bloque1, /^Confirmar bloque \(3\)/)
    const dlg = page.getByRole('dialog', { name: `Confirmar bloque · Bloque ${bloque1}`, exact: true })
    await expect(dlg).toContainText('Pasan a en camino (3)')
    await dlg.getByRole('button', { name: 'Confirmar (3)' }).click()
    await expect(dlg).toBeHidden()

    await expect.poll(async () => (await lineas()).filter((l) => l.idBloque === bloque1).map((l) => l.estado)).toEqual(['en_camino', 'en_camino', 'en_camino'])
    await expect(cabecera(page, bloque1)).toContainText('3 en camino')
  })

  test('Recibir todo suma stock y «Revertir a En camino» lo devuelve', async () => {
    const page = sup!
    const del1 = (await lineas()).filter((l) => l.idBloque === bloque1)
    const unidades = del1.reduce((s, l) => s + l.cantidad, 0)

    await elegirEnMenuBloque(page, bloque1, /^Recibir todo \(3\)/)
    const dlg = page.getByRole('dialog', { name: `Recibir todo · Bloque ${bloque1}`, exact: true })
    await expect(dlg).toContainText('Se reciben (suman al stock) (3)')
    await dlg.getByRole('button', { name: 'Recibir (3)' }).click()
    await expect(dlg).toBeHidden()

    await expect.poll(async () => (await lineas()).filter((l) => l.idBloque === bloque1 && l.estado === 'recibido').length).toBe(3)
    await expect.poll(() => stockDelSku(page)).toBe(stockInicial! + unidades)
    await expect(cabecera(page, bloque1)).toContainText('3 recibido')

    for (const l of del1) {
      await celdaId(page, l.idCompra).click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Revertir a En camino' }).click()
      const confirmacion = page.getByRole('dialog', { name: 'Revertir a En camino', exact: true })
      await confirmacion.getByRole('button', { name: 'Revertir a En camino', exact: true }).click()
      await expect(confirmacion).toBeHidden()
      await expect.poll(async () => (await linea(l.idCompra))?.estado).toBe('en_camino')
    }
    await expect.poll(() => stockDelSku(page)).toBe(stockInicial!)
  })

  test('Cancelar bloque lista las líneas que cambian y las cancela', async () => {
    const page = sup!
    // El bloque 3 solo tiene la línea separada: se confirma y se cancela, así el resto del bloque 1 no queda cancelado.
    await elegirEnMenuBloque(page, bloque3, /^Confirmar bloque \(1\)/)
    const confirmar = page.getByRole('dialog', { name: `Confirmar bloque · Bloque ${bloque3}`, exact: true })
    await confirmar.getByRole('button', { name: 'Confirmar (1)' }).click()
    await expect(confirmar).toBeHidden()
    await expect.poll(async () => (await linea(l3))?.estado).toBe('en_camino')

    await elegirEnMenuBloque(page, bloque3, /^Cancelar bloque \(1\)/)
    const dlg = page.getByRole('dialog', { name: `Cancelar bloque · Bloque ${bloque3}`, exact: true })
    await expect(dlg).toContainText('Se cancelan (no se pueden reactivar) (1)')
    await expect(dlg).toContainText(String(l3))
    await dlg.getByRole('button', { name: 'Cancelar líneas (1)' }).click()
    await expect(dlg).toBeHidden()

    await expect.poll(async () => (await linea(l3))?.estado).toBe('cancelado')
    await expect(cabecera(page, bloque3)).toContainText('1 cancelado')
    expect((await linea(l4))?.estado).toBe('en_camino') // el bloque 1 no se toca
  })

  test('Borrar bloque con todo pendiente quita el bloque y sus líneas', async () => {
    const page = sup!
    const dlgNuevo = await rellenarNuevoPedido(page, '2')
    // El proveedor ya no tiene ningún bloque abierto (uno en camino y otro cancelado): bloque nuevo.
    await expect(dlgNuevo.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })).toContainText('Bloque nuevo (no tiene ninguno abierto)')
    const creadas = await guardarLote(page, dlgNuevo)
    expect(creadas).toHaveLength(1)
    await expect.poll(async () => (await linea(creadas[0]))?.idBloque ?? null).not.toBeNull()
    const bloque5 = (await linea(creadas[0]))!.idBloque!
    expect(bloque5).not.toBe(bloque1)
    // La segunda línea del SKU, por el menú del bloque.
    const ids = [creadas[0], await anadirLineaAlBloque(page, bloque5, '3')]
    await expect(cabecera(page, bloque5)).toContainText('2 líneas')

    await elegirEnMenuBloque(page, bloque5, /^Borrar bloque/)
    const dlg = page.getByRole('dialog', { name: `Borrar bloque · Bloque ${bloque5}`, exact: true })
    await expect(dlg).toContainText('Se borran el bloque y todas sus líneas (2)')
    await dlg.getByRole('button', { name: 'Borrar bloque', exact: true }).click()
    await expect(dlg).toBeHidden()

    await expect.poll(async () => (await lineas()).filter((l) => ids.includes(l.idCompra)).length).toBe(0)
    await expect(cabecera(page, bloque5)).toHaveCount(0)
    expect(await bloquesDe()).toHaveLength(2) // quedan el bloque en camino y el cancelado
  })

  test('vista plana: columna «Bloque»; y vuelta a la agrupada', async () => {
    const page = sup!
    const interruptor = page.getByRole('switch', { name: 'Agrupar por bloque' })
    await interruptor.click()
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('tr[data-cabecera]')).toHaveCount(0)
    await expect(page.getByRole('columnheader').filter({ hasText: /^Bloque$/ })).toHaveCount(1)
    await expect(fila(page, l4).locator('td[data-columna="bloque"]')).toHaveText(String(bloque1))
    await expect(fila(page, l3).locator('td[data-columna="bloque"]')).toHaveText(String(bloque3))

    await interruptor.click()
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')
    await expect(cabecera(page, bloque1)).toHaveCount(1)
  })

  test('CSV con «Bloque» y «Nota del bloque» tras «ID»', async () => {
    const page = sup!
    // Sin el selector de ficheros del navegador: descarga directa por enlace (src/shared/lib/csv.ts).
    await page.evaluate(() => { Reflect.set(globalThis, 'showSaveFilePicker', undefined) })
    await page.getByRole('button', { name: /^Hola,/ }).click()
    const descarga = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Descargar CSV' }).click()
    const ruta = await (await descarga).path()
    const texto = readFileSync(ruta, 'utf8')
    const lineasCsv = (texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto).split(String.fromCharCode(10)).map((l) => l.trim())
    expect(lineasCsv[0].startsWith('ID;Bloque;Nota del bloque;')).toBe(true)
    expect(lineasCsv.some((l) => l.startsWith(`${idsBloqueA[0]};${bloque1};${nota};`) && l.includes(nombreProv))).toBe(true)
    expect(lineasCsv.some((l) => new RegExp(`^${escaparRegex(String(l3))};${bloque3};;`).test(l) && l.includes(nombreProv))).toBe(true)
  })
})
