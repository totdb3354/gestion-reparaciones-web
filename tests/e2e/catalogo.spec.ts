import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// 0.9.9 (spec 2026-10-11): piezas que vende cada proveedor, previsión por proveedor, «Pendiente» / «Pedir 60 d» en el
// listado de Stock y buscar un bloque por su número. ESCRIBE: solo contra PREPRODUCCIÓN (beforeAll se niega sin el
// letrero). Proveedor sintético «E2E Catálogo <marca>»; el SKU de prueba (E2E_SKU_PRUEBA, activo y sin master) se pasa a
// Auto y se le sube el mínimo (ADMIN) para que haya algo que pedir. afterAll devuelve mínimo y modo, borra la línea
// pendiente creada y el proveedor, y comprueba que el stock del SKU no se ha movido. Sesiones abiertas una vez en
// beforeAll (supertécnico y admin: el entorno limita los inicios de sesión por minuto).
test.describe.configure({ mode: 'serial' })

type Pieza = { idCom: number; tipo: string; stockMinimo: number; autoPedido: boolean | null; pedir60: number | null; pendiente: number | null; proveedores: number[] | null; stock: number; enCamino: number }
type RespuestaLote = { idsCreados: number[] }

const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const marca = Date.now()
const nombreProv = `E2E Catálogo ${marca}`
const sku = process.env.E2E_SKU_PRUEBA
const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

let sup: Page | null = null
let adm: Page | null = null
let idProv: number | null = null
let antes: Pieza | null = null
const lineasCreadas: number[] = []

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

/** El SKU de prueba en el listado de Stock (`GET /api/componentes` está retirado: 403). */
async function pieza(page: Page): Promise<Pieza> {
  const r = await llamarApi(page, 'GET', '/api/componentes/gestionados')
  expect(r.status, `GET /api/componentes/gestionados respondió ${r.status}`).toBe(200)
  const p = (r.json as Pieza[]).find((x) => x.tipo === sku)
  expect(p, `No hay componente ${sku}`).toBeTruthy()
  return p as Pieza
}

test.beforeAll(async ({ browser }, testInfo) => {
  const { E2E_USER, E2E_PASS, ADMIN_USER, ADMIN_PASS } = process.env
  if (!E2E_USER || !E2E_PASS || !ADMIN_USER || !ADMIN_PASS || !sku) return // los tests se saltan en beforeEach
  const baseURL = testInfo.project.use.baseURL
  sup = await browser.newPage({ baseURL })
  await entrar(sup, E2E_USER, E2E_PASS)
  // Guarda contra producción: este fichero escribe, así que solo sigue si la web enseña el letrero de preproducción.
  if (!(await sup.getByText(LETRERO_PRE).isVisible())) {
    await sup.close()
    sup = null
    throw new Error(`catalogo.spec.ts escribe datos: se niega a correr sin el letrero «${LETRERO_PRE}» (solo contra PREPRODUCCIÓN)`)
  }
  adm = await browser.newPage({ baseURL })
  await entrar(adm, ADMIN_USER, ADMIN_PASS)
  antes = await pieza(sup)
  const alta = await llamarApi(sup, 'POST', '/api/proveedores', { nombre: nombreProv, divisa: 'EUR', tipo: 'COMPONENTES' })
  expect(alta.status, `POST /api/proveedores respondió ${alta.status}`).toBe(201)
  const lista = await llamarApi(sup, 'GET', '/api/proveedores?tipo=COMPONENTES')
  const creados = (lista.json as { idProv: number; nombre: string }[]).filter((p) => p.nombre === nombreProv)
  expect(creados).toHaveLength(1)
  idProv = creados[0].idProv
})

test.beforeEach(() => {
  credenciales('E2E_USER', 'E2E_PASS')
  credenciales('ADMIN_USER', 'ADMIN_PASS')
  test.skip(!sku, 'Falta E2E_SKU_PRUEBA')
  test.skip(sup === null || adm === null || idProv === null, 'Sin sesiones o sin proveedor de prueba (beforeAll)')
})

test.afterAll(async () => {
  if (!sup) return
  const fallos: string[] = []
  /** Cada paso de limpieza va aislado: si uno lanza o responde mal, los demás se intentan igual y el fallo se apunta. */
  async function paso(nombre: string, f: () => Promise<{ status: number } | void>, aceptados: number[] = [200, 204]) {
    try {
      const r = await f()
      if (r && !aceptados.includes(r.status)) fallos.push(`${nombre} (${r.status})`)
    } catch (e) {
      fallos.push(`${nombre} (${e instanceof Error ? e.message : String(e)})`)
    }
  }
  try {
    const s1 = sup
    for (const id of lineasCreadas) await paso(`borrar línea ${id}`, () => llamarApi(s1, 'DELETE', `/api/compras/${id}`))
    if (antes !== null) {
      const a1 = antes
      if (adm !== null) {
        const a2 = adm
        await paso(`restaurar stockMinimo de ${a1.tipo} a ${a1.stockMinimo}`, () => llamarApi(a2, 'PATCH', `/api/componentes/${a1.idCom}/stock-minimo`, { stockMinimo: a1.stockMinimo }))
      } else fallos.push('restaurar stockMinimo (sin sesión admin)')
      await paso(`restaurar autoPedido de ${a1.tipo} a ${a1.autoPedido === true}`, () => llamarApi(s1, 'PATCH', `/api/componentes/${a1.idCom}/auto-pedido`, { autoPedido: a1.autoPedido === true }))
    }
    if (idProv !== null) {
      const id = idProv
      await paso(`borrar proveedor ${id} «${nombreProv}»`, async () => {
        const borrado = await llamarApi(s1, 'DELETE', `/api/proveedores/${id}`)
        if (borrado.status === 204 || borrado.status === 200) return borrado
        const baja = await llamarApi(s1, 'PATCH', `/api/proveedores/${id}/activo`, { activo: false })
        console.warn(`catalogo.spec: proveedor ${id} sin borrar (DELETE ${borrado.status}); desactivado: ${baja.status}`)
        return borrado
      })
    }
    if (antes !== null) expect((await pieza(sup)).stock, 'el stock del SKU de prueba debe quedar como estaba').toBe(antes.stock)
  } finally {
    await sup.close()
    sup = null
    await adm?.close()
    adm = null
  }
  if (fallos.length > 0) throw new Error(`catalogo.spec: preprod NO queda como estaba: ${fallos.join('; ')}`)
})

test('«Piezas que vende…» guarda la pieza en la lista del proveedor', async () => {
  const page = sup as Page
  await page.goto('/stock/proveedores')
  await page.getByRole('row').filter({ hasText: nombreProv }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Piezas que vende…' }).click()
  const dlg = page.getByRole('dialog', { name: `Piezas que vende · ${nombreProv}` })
  await dlg.getByRole('textbox', { name: 'Buscar pieza' }).fill(sku as string)
  // El nombre del grupo puede llevar más tipos unidos por « / »: el SKU de prueba va entero, no como prefijo de otro.
  const s = escaparRegex(sku as string)
  await dlg.getByRole('checkbox', { name: new RegExp(`^Vende (.* / )?${s}( / .*)?$`) }).click()
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await pieza(page)).proveedores).toContain(idProv)
})

test('con algo que pedir, «Añadir previsión de X (1)» la mete con su cantidad y X', async () => {
  const page = sup as Page
  const p = antes as Pieza
  // Mínimo por encima de lo que hay (solo ADMIN) y pieza en Auto, para que «Pedir 60 d» sea > 0.
  expect((await llamarApi(adm as Page, 'PATCH', `/api/componentes/${p.idCom}/stock-minimo`, { stockMinimo: p.stock + p.enCamino + (p.pendiente ?? 0) + 50 })).status).toBe(200)
  expect((await llamarApi(page, 'PATCH', `/api/componentes/${p.idCom}/auto-pedido`, { autoPedido: true })).status).toBe(200)
  const conPedido = await pieza(page)
  expect(conPedido.pedir60 ?? 0).toBeGreaterThan(0)

  await page.goto('/stock/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
  await expect(dlg.getByRole('button', { name: 'Añadir previsión', exact: true })).toBeDisabled()
  await dlg.getByRole('combobox', { name: 'Proveedor general' }).click()
  await page.getByRole('listbox', { name: 'Proveedor general' }).getByRole('button', { name: nombreProv }).click()
  await dlg.getByRole('button', { name: `Añadir previsión de ${nombreProv} (1)` }).click()
  await expect(dlg.getByLabel('Cantidad línea 1')).toHaveValue(String(conPedido.pedir60))
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/compras/lote' && r.request().method() === 'POST')
  await dlg.getByRole('button', { name: 'Confirmar pedido' }).click()
  const lote = await respuesta
  expect(lote.ok(), `POST /api/compras/lote respondió ${lote.status()}`).toBe(true)
  lineasCreadas.push(...((await lote.json()) as RespuestaLote).idsCreados)
  expect(lineasCreadas).toHaveLength(1)
  await expect(dlg).toBeHidden()

  const despues = await pieza(page)
  expect(despues.pendiente).toBe((conPedido.pendiente ?? 0) + (conPedido.pedir60 ?? 0))
  expect(despues.pedir60).toBe(0)
})

test('el buscador con el número del bloque enseña solo ese bloque', async () => {
  const page = sup as Page
  const compras = await llamarApi(page, 'GET', '/api/compras')
  const idBloque = (compras.json as { idCompra: number; idBloque: number | null }[]).find((l) => l.idCompra === lineasCreadas[0])?.idBloque
  expect(idBloque, 'la línea creada debe tener bloque').toBeTruthy()
  await page.goto('/stock/pedidos')
  await page.getByPlaceholder('Buscar componente o nº de bloque…').fill(String(idBloque))
  // Una búsqueda solo de dígitos devuelve las líneas cuyo idBloque es ese número: queda una única cabecera.
  await expect(page.locator('tr[data-cabecera]')).toHaveCount(1)
  // «Bloque n» sin casar con «Bloque n0» (como bloques.spec.ts).
  const nuestra = page.locator('tr[data-cabecera]').filter({ hasText: new RegExp(`Bloque ${idBloque}(?!\\d)`) })
  await expect(nuestra).toHaveCount(1)
  await expect(nuestra).toContainText(nombreProv)
})
