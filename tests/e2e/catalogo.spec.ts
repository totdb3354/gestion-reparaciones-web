import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

// 0.9.9 (spec 2026-10-12): tipos de pieza que vende cada proveedor con modelos excluidos, previsión por proveedor, «Pendiente» / «Pedir 60 d» y buscar un bloque por su número. ESCRIBE: solo contra PREPRODUCCIÓN (beforeAll se niega sin el
// letrero). Proveedor sintético «E2E Catálogo <marca>»; el SKU de prueba (E2E_SKU_PRUEBA, activo y sin master; su tipo debe
// tener al menos otro modelo activo, y el SKU no debe tener esclavos de otro modelo: si no, la exclusión de la
// primera prueba no puede dejarlo fuera) se pasa a Auto y se le sube el mínimo (ADMIN) para que haya algo que pedir. afterAll devuelve mínimo y modo, borra la línea
// pendiente creada y el proveedor, y comprueba que el stock del SKU no se ha movido. Sesiones abiertas una vez en
// beforeAll (supertécnico y admin: el entorno limita los inicios de sesión por minuto).
test.describe.configure({ mode: 'serial' })

type Pieza = { idCom: number; tipo: string; stockMinimo: number; autoPedido: boolean | null; pedir60: number | null; pendiente: number | null; proveedores: number[] | null; stock: number; enCamino: number; idComMaster: number | null; activo: boolean }
type RespuestaLote = { idsCreados: number[] }

const LETRERO_PRE = 'PREPRODUCCIÓN · datos de prueba'
const marca = Date.now()
const nombreProv = `E2E Catálogo ${marca}`
const sku = process.env.E2E_SKU_PRUEBA

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
async function llamarApi(page: Page, metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown }> {
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

type TipoPiezas = { prefijo: string; vende: boolean; modelos: string[]; excluidos: string[] }

/** Prefijo y modelo del SKU de prueba con el criterio del servidor: prefijo = lo que va antes de la primera «i»; modelo
 *  = el código más largo de los modelos de su tipo que sea prefijo de lo que queda. */
function prefijoYModelo(tipos: TipoPiezas[]): { prefijo: string; modelo: string } {
  const s = (sku as string).toLowerCase()
  const prefijo = s.slice(0, s.indexOf('i'))
  const tipo = tipos.find((t) => t.prefijo === prefijo)
  expect(tipo, `El tipo ${prefijo} de ${sku} no sale en GET /piezas`).toBeTruthy()
  const resto = s.slice(prefijo.length + 1)
  const modelo = (tipo as TipoPiezas).modelos.filter((m) => resto.startsWith(m)).sort((a, b) => b.length - a.length)[0]
  expect(modelo, `Sin modelo para ${sku}`).toBeTruthy()
  return { prefijo, modelo }
}

/** Las piezas que «Añadir previsión de X (N)» cuenta: masters activas en Auto con algo que pedir que vende X. */
async function previstas(page: Page): Promise<Pieza[]> {
  const r = await llamarApi(page, 'GET', '/api/componentes/gestionados')
  return (r.json as Pieza[]).filter((p) => p.idComMaster == null && p.activo && p.autoPedido === true && (p.pedir60 ?? 0) > 0
    && (p.proveedores ?? []).includes(idProv as number))
}

let tipoPrueba: { prefijo: string; modelo: string } | null = null

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

test('con el modelo de la pieza excluido, la previsión de X no la trae', async () => {
  const page = sup as Page
  const p = antes as Pieza
  // Mínimo por encima de lo que hay (solo ADMIN) y pieza en Auto, para que «Pedir 60 d» sea > 0.
  expect((await llamarApi(adm as Page, 'PATCH', `/api/componentes/${p.idCom}/stock-minimo`, { stockMinimo: p.stock + p.enCamino + (p.pendiente ?? 0) + 50 })).status).toBe(200)
  expect((await llamarApi(page, 'PATCH', `/api/componentes/${p.idCom}/auto-pedido`, { autoPedido: true })).status).toBe(200)
  const lectura = await llamarApi(page, 'GET', `/api/proveedores/${idProv}/piezas`)
  expect(lectura.status).toBe(200)
  tipoPrueba = prefijoYModelo(lectura.json as TipoPiezas[])
  // El tipo de la pieza, con todos los modelos menos el suyo (por la API: el desplegable lo cubren los tests unitarios).
  const guardado = await llamarApi(page, 'PUT', `/api/proveedores/${idProv}/piezas`, { tipos: [{ prefijo: tipoPrueba.prefijo, excluidos: [tipoPrueba.modelo] }] })
  expect(guardado.status).toBe(204)
  expect((await pieza(page)).proveedores ?? []).not.toContain(idProv)
  const n = (await previstas(page)).length

  await page.goto('/stock/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
  await dlg.getByRole('combobox', { name: 'Proveedor general' }).click()
  await page.getByRole('listbox', { name: 'Proveedor general' }).getByRole('button', { name: nombreProv }).click()
  await expect(dlg.getByRole('button', { name: `Añadir previsión de ${nombreProv} (${n})` })).toBeVisible()
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
})

test('«Piezas que vende…»: «Todos los modelos» y la previsión ya la trae', async () => {
  const page = sup as Page
  const tp = tipoPrueba as { prefijo: string; modelo: string }
  await page.goto('/stock/proveedores')
  await page.getByRole('row').filter({ hasText: nombreProv }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Piezas que vende…' }).click()
  const dlg = page.getByRole('dialog', { name: `Piezas que vende · ${nombreProv}` })
  const renglon = dlg.locator(`[data-prefijo="${tp.prefijo}"]`)
  await expect(renglon.getByRole('checkbox')).toBeChecked()
  const desplegable = renglon.getByRole('button')
  await expect(desplegable).toContainText('Seleccionados')
  await desplegable.click()
  await page.getByRole('checkbox', { name: 'Todos los modelos' }).click()
  await expect(desplegable).toHaveText(/Todos los modelos/)
  await page.keyboard.press('Escape')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await pieza(page)).proveedores).toContain(idProv)

  const conPedido = await pieza(page)
  const n = (await previstas(page)).length
  expect(n).toBeGreaterThan(0)
  await page.goto('/stock/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
  const pedido = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
  await pedido.getByRole('combobox', { name: 'Proveedor general' }).click()
  await page.getByRole('listbox', { name: 'Proveedor general' }).getByRole('button', { name: nombreProv }).click()
  await pedido.getByRole('button', { name: `Añadir previsión de ${nombreProv} (${n})` }).click()
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/compras/lote' && r.request().method() === 'POST')
  await pedido.getByRole('button', { name: 'Confirmar pedido' }).click()
  const lote = await respuesta
  expect(lote.ok(), `POST /api/compras/lote respondió ${lote.status()}`).toBe(true)
  lineasCreadas.push(...((await lote.json()) as RespuestaLote).idsCreados)
  expect(lineasCreadas).toHaveLength(n)
  await expect(pedido).toBeHidden()

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
