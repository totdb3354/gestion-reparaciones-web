import { expect, test, type Page, type Response } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Forma de la respuesta del lote (schema.d.ts: LoteComprasRespuesta, 0.9.15 con los otros). Se repite aquí a mano porque
 *  el e2e no importa código de la app. */
type RespuestaLote = { idsCreados: number[]; idsOtrosCreados: number[] }

async function entrar(page: Page) {
  const { usuario, clave } = credenciales('E2E_USER', 'E2E_PASS')
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

/** Petición a la API con el token de la sesión de la página (misma origin que la app; patrón de stock.spec.ts:12-20). */
async function llamarApi(page: Page, metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown }> {
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

/** «Nuevo pedido» (0.9.9, varios proveedores): al abrir vacío, un primer recuadro («Pedido sin proveedor») con el ComboNavy
 *  «Proveedor» en la cabecera; con un recuadro ya puesto, «+ Otro proveedor», en el pie. Cada opción es «{nombre} · {bloque
 *  abierto o «sin bloque abierto»}». */
async function elegirProveedorDelPedido(page: Page, combo: 'Proveedor' | 'Otro proveedor', nombre: string) {
  const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
  await dlg.getByRole('combobox', { name: combo, exact: true }).click()
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.getByRole('listbox', { name: combo, exact: true }).getByRole('button', { name: new RegExp(`^${escapado} · `) }).click()
}

/** Alta del proveedor de prueba por API y su id por el nombre EXACTO y único. Si no aparece exactamente uno, el test falla
 *  aquí sin limpiar nada (mejor basura de test que borrar una fila ajena, como asignar.spec.ts). */
async function crearProveedorDePrueba(page: Page, nombre: string): Promise<number> {
  const alta = await llamarApi(page, 'POST', '/api/proveedores', { nombre, divisa: 'EUR', tipo: 'COMPONENTES' })
  expect(alta.status, `POST /api/proveedores respondió ${alta.status}`).toBe(201)
  const lista = await llamarApi(page, 'GET', '/api/proveedores?tipo=COMPONENTES')
  expect(lista.status).toBe(200)
  const creados = (lista.json as { idProv: number; nombre: string }[]).filter((p) => p.nombre === nombre)
  expect(creados).toHaveLength(1)
  return creados[0].idProv
}

/** Solo deja pasar el DELETE de `rutaPermitida` bajo `patron`: si la fila o el menú apuntaran a otro pedido, se aborta
 *  (patrón de stock.spec.ts:85-89). */
async function soloBorrar(page: Page, patron: string, rutaPermitida: string) {
  await page.route(patron, (route) => {
    const req = route.request()
    if (req.method() === 'DELETE' && new URL(req.url()).pathname !== rutaPermitida) return route.abort()
    return route.continue()
  })
}

const esRespuesta = (ruta: string, metodo: string) => (r: Response) => new URL(r.url()).pathname === ruta && r.request().method() === metodo

/**
 * ESCRIBE en el entorno de destino: crea un proveedor de prueba por API, un pedido de componentes de una línea con
 * E2E_SKU_PRUEBA y precio 0 y, con «+ Añadir otro» (0.9.15), un otro pedido con un concepto sintético; edita cada uno
 * (cantidad 2) y los borra por el id que devolvió su lote; al final borra el proveedor. No confirma ni recibe nada: no toca
 * stock ni deja filas.
 */
test('supertécnico: pedido y otro pedido creados, editados y borrados con un proveedor de prueba', async ({ page }) => {
  const sku = process.env.E2E_SKU_PRUEBA
  test.skip(!sku, 'Falta E2E_SKU_PRUEBA')
  const marca = Date.now()
  const nombreProv = `e2e-proveedor-${marca}`
  const nombreProvB = `${nombreProv}-b`
  const concepto = `e2e-concepto-${marca}`
  await entrar(page)

  const idProv = await crearProveedorDePrueba(page, nombreProv)
  const idProvB = await crearProveedorDePrueba(page, nombreProvB)
  // Rutas de los pedidos creados que siguen existiendo: se vacían al borrarlos por la interfaz; lo que quede se borra
  // por API al final.
  const porBorrar = new Set<string>()
  try {
    await page.getByRole('navigation', { name: 'Sub-navegación' }).getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expect(page).toHaveURL(/\/stock\/pedidos$/)
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible()
    await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

    await test.step('pedido de componentes: crear, editar y borrar', async () => {
      await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
      const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
      await expect(dlg.getByRole('region', { name: 'Pedido sin proveedor', exact: true })).toBeVisible()
      await elegirProveedorDelPedido(page, 'Proveedor', nombreProv)
      await dlg.getByRole('button', { name: '+ Añadir línea' }).click()
      await dlg.getByPlaceholder('Escribe componente...').fill(sku!)
      // La lista del autocompletar va en un portal fuera del diálogo (114ca65): se busca en la página.
      await page.getByRole('option', { name: sku!, exact: true }).click()
      // Elegir la pieza pone su «Pedir 60 d» (0.9.9), que depende de cómo esté el SKU en el entorno: el test cuenta con 1.
      await dlg.getByLabel('Cantidad línea 1').fill('1')

      // La espera se registra ANTES del clic: waitForResponse solo atrapa respuestas posteriores al registro.
      const respuestaLote = page.waitForResponse(esRespuesta('/api/compras/lote', 'POST'))
      await dlg.getByRole('button', { name: 'Confirmar pedido' }).click()
      const respuesta = await respuestaLote
      // Se registra cada id devuelto en porBorrar ANTES de cualquier otra aserción: si algo de lo que sigue falla, el
      // finally ya sabe qué pedidos borrar y no deja basura en el entorno de destino.
      if (respuesta.ok()) {
        const { idsCreados } = (await respuesta.json()) as RespuestaLote
        for (const idCreado of idsCreados) porBorrar.add(`/api/compras/${idCreado}`)
      }
      expect(respuesta.ok(), `POST /api/compras/lote respondió ${respuesta.status()}`).toBe(true)
      const peticion = respuesta.request()
      expect(peticion.headers()['idempotency-key']).toBeTruthy()
      expect(peticion.postDataJSON()).toEqual({
        lineas: [{ idCom: expect.any(Number), idProv, cantidad: 1, esUrgente: false, precioUnidad: 0 }],
        solicitudes: { urgentes: [], preventivas: [] },
        destinos: null,
        otros: [],
      })
      const { idsCreados } = (await respuesta.json()) as RespuestaLote
      expect(idsCreados).toHaveLength(1)
      const id = idsCreados[0]
      await expect(dlg).toBeHidden()

      await page.getByPlaceholder('Buscar componente o nº de bloque…').fill(sku!)
      // El proveedor es nuevo y solo tiene este pedido: su nombre identifica la fila.
      // 0.9.9: por defecto agrupada; su bloque nuevo sale con el proveedor en la cabecera. El resto del test, en la plana.
      await expect(page.locator('tr[data-cabecera]').filter({ hasText: nombreProv })).toHaveCount(1)
      await page.getByRole('switch', { name: 'Agrupar por bloque' }).click()
      const fila = page.getByRole('row').filter({ hasText: nombreProv })
      await expect(fila).toHaveCount(1)
      await expect(fila.getByText('pendiente', { exact: true })).toBeVisible()
      await expect(fila.getByRole('cell').nth(5)).toHaveText('1')

      await fila.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Editar' }).click()
      const editor = page.getByRole('dialog', { name: `Editar pedido #${id}` })
      await expect(editor.getByLabel('Cantidad:')).toHaveValue('1')
      await editor.getByLabel('Cantidad:').fill('2')
      const guardado = page.waitForResponse(esRespuesta(`/api/compras/${id}`, 'PUT'))
      await editor.getByRole('button', { name: 'Guardar' }).click()
      expect((await guardado).ok()).toBe(true)
      await expect(editor).toBeHidden()
      await expect(fila.getByRole('cell').nth(5)).toHaveText('2')

      await soloBorrar(page, '**/api/compras/*', `/api/compras/${id}`)
      const borrado = page.waitForResponse(esRespuesta(`/api/compras/${id}`, 'DELETE'))
      await fila.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Borrar' }).click()
      await page.getByRole('dialog', { name: 'Borrar pedido' }).getByRole('button', { name: 'Borrar' }).click()
      expect((await borrado).ok()).toBe(true)
      porBorrar.delete(`/api/compras/${id}`)
      await expect(fila).toHaveCount(0)
      // La ruta de solo borrar ese pedido se quita: el paso siguiente borra los suyos por la API.
      await page.unroute('**/api/compras/*')
    })

    await test.step('pedido a dos proveedores: dos recuadros, dos bloques; se borran', async () => {
      await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
      const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
      await elegirProveedorDelPedido(page, 'Proveedor', nombreProv)
      const recuadroA = dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })
      await recuadroA.getByRole('button', { name: '+ Añadir línea' }).click()
      await recuadroA.getByPlaceholder('Escribe componente...').fill(sku!)
      await page.getByRole('option', { name: sku!, exact: true }).click()
      await recuadroA.getByLabel('Cantidad línea 1').fill('1')
      await elegirProveedorDelPedido(page, 'Otro proveedor', nombreProvB)
      const recuadroB = dlg.getByRole('region', { name: `Pedido a ${nombreProvB}`, exact: true })
      await recuadroB.getByRole('button', { name: '+ Añadir línea' }).click()
      await recuadroB.getByPlaceholder('Escribe componente...').fill(sku!)
      await page.getByRole('option', { name: sku!, exact: true }).click()
      // La misma pieza a dos proveedores se puede (0.9.9): cada recuadro avisa del otro. La cantidad, 1 a mano.
      await recuadroB.getByLabel('Cantidad línea 1').fill('1')
      await expect(recuadroA).toContainText(`también va a ${nombreProvB} (1).`)

      const respuestaLote = page.waitForResponse(esRespuesta('/api/compras/lote', 'POST'))
      await dlg.getByRole('button', { name: 'Confirmar pedido (2 bloques)' }).click()
      const respuesta = await respuestaLote
      if (respuesta.ok()) {
        const { idsCreados } = (await respuesta.json()) as RespuestaLote
        for (const idCreado of idsCreados) porBorrar.add(`/api/compras/${idCreado}`)
      }
      expect(respuesta.ok(), `POST /api/compras/lote respondió ${respuesta.status()}`).toBe(true)
      expect(respuesta.request().postDataJSON()).toEqual({
        lineas: [
          { idCom: expect.any(Number), idProv, cantidad: 1, esUrgente: false, precioUnidad: 0 },
          { idCom: expect.any(Number), idProv: idProvB, cantidad: 1, esUrgente: false, precioUnidad: 0 },
        ],
        solicitudes: { urgentes: [], preventivas: [] },
        destinos: null,
        otros: [],
      })
      await expect(dlg).toBeHidden()

      // Vista agrupada: un bloque nuevo por proveedor. El paso anterior dejó la plana; se vuelve a pulsar al final.
      const interruptor = page.getByRole('switch', { name: 'Agrupar por bloque' })
      await interruptor.click()
      await expect(page.locator('tr[data-cabecera]').filter({ hasText: nombreProvB })).toHaveCount(1)
      await expect(page.locator('tr[data-cabecera]').filter({ hasText: new RegExp(`${nombreProv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!-b)`) })).toHaveCount(1)
      // Se borran por API, por el id que devolvió el lote (solo lo creado aquí).
      for (const ruta of [...porBorrar].filter((r) => r.startsWith('/api/compras/'))) {
        const r = await llamarApi(page, 'DELETE', ruta)
        expect(r.status, `DELETE ${ruta}`).toBe(200)
        porBorrar.delete(ruta)
      }
      // Vuelve a la vista plana, como la dejó el paso anterior, para que «otro pedido» empiece igual.
      await interruptor.click()
    })

    await test.step('otro pedido con «+ Añadir otro»: crear, encontrarlo con el buscador, editar y borrar', async () => {
      await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
      const dlg = page.getByRole('dialog', { name: 'Nuevo pedido', exact: true })
      await elegirProveedorDelPedido(page, 'Proveedor', nombreProv)
      const recuadro = dlg.getByRole('region', { name: `Pedido a ${nombreProv}`, exact: true })
      await recuadro.getByRole('button', { name: '+ Añadir otro' }).click()
      // La línea de otro nace con el cursor en su concepto (0.9.15).
      const campoConcepto = recuadro.getByLabel('Concepto línea 1')
      await expect(campoConcepto).toBeFocused()
      await expect(campoConcepto).toHaveAttribute('placeholder', 'Escribe el concepto…')
      await campoConcepto.fill(concepto)

      const respuestaLote = page.waitForResponse(esRespuesta('/api/compras/lote', 'POST'))
      await dlg.getByRole('button', { name: 'Confirmar pedido' }).click()
      const respuesta = await respuestaLote
      // Mismo orden que en el pedido de componentes: registrar los ids devueltos antes de cualquier otra aserción.
      if (respuesta.ok()) {
        const { idsOtrosCreados } = (await respuesta.json()) as RespuestaLote
        for (const idCreado of idsOtrosCreados) porBorrar.add(`/api/compras-otros/${idCreado}`)
      }
      expect(respuesta.ok(), `POST /api/compras/lote respondió ${respuesta.status()}`).toBe(true)
      expect(respuesta.request().headers()['idempotency-key']).toBeTruthy()
      expect(respuesta.request().postDataJSON()).toEqual({
        lineas: [],
        solicitudes: { urgentes: [], preventivas: [] },
        destinos: null,
        otros: [{ idProv, concepto, cantidad: 1, esUrgente: false, precioUnidad: 0 }],
      })
      const { idsCreados, idsOtrosCreados } = (await respuesta.json()) as RespuestaLote
      expect(idsCreados).toHaveLength(0)
      expect(idsOtrosCreados).toHaveLength(1)
      const id = idsOtrosCreados[0]
      await expect(dlg).toBeHidden()

      // Una sola lista (0.9.15): el buscador encuentra el otro por su concepto. Sigue la vista plana del paso anterior.
      await page.getByPlaceholder('Buscar componente o nº de bloque…').fill(concepto)
      const fila = page.getByRole('row').filter({ hasText: nombreProv })
      await expect(fila).toHaveCount(1)
      await expect(fila.locator('td[data-columna="id"]')).toHaveText(`O-${id}`)
      await expect(fila.locator('td[data-columna="componente"]').getByText('otro', { exact: true })).toBeVisible()
      await expect(fila.locator('td[data-columna="componente"]')).toContainText(concepto)
      await expect(fila.getByText('pendiente', { exact: true })).toBeVisible()

      await fila.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Editar' }).click()
      const editor = page.getByRole('dialog', { name: `Editar pedido #O-${id}` })
      await expect(editor.getByLabel('Concepto:')).toHaveValue(concepto)
      await expect(editor.getByLabel('Cantidad:')).toHaveValue('1')
      await editor.getByLabel('Cantidad:').fill('2')
      const guardado = page.waitForResponse(esRespuesta(`/api/compras-otros/${id}`, 'PUT'))
      await editor.getByRole('button', { name: 'Guardar' }).click()
      const put = await guardado
      expect(put.ok()).toBe(true)
      expect(put.request().postDataJSON()).toMatchObject({ idProv, concepto, cantidad: 2, destino: null })
      await expect(editor).toBeHidden()
      // Vista plana: ID, Bloque, Pedido, Componente / concepto, Proveedor, Cant.
      await expect(fila.getByRole('cell').nth(5)).toHaveText('2')

      await soloBorrar(page, '**/api/compras-otros/*', `/api/compras-otros/${id}`)
      const borrado = page.waitForResponse(esRespuesta(`/api/compras-otros/${id}`, 'DELETE'))
      await fila.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Borrar' }).click()
      await page.getByRole('dialog', { name: 'Borrar pedido' }).getByRole('button', { name: 'Borrar' }).click()
      expect((await borrado).ok()).toBe(true)
      porBorrar.delete(`/api/compras-otros/${id}`)
      await expect(fila).toHaveCount(0)
      await page.unroute('**/api/compras-otros/*')

      // La dirección antigua de «Otros» abre Pedidos (0.9.15).
      await page.goto('/stock/pedidos/otros')
      await expect(page).toHaveURL(/\/stock\/pedidos$/)
    })
  } finally {
    // Limpieza por id: primero los pedidos que queden (solo los creados por este test, siguen pendientes), después el
    // proveedor (un pedido que siga vivo le daría 409). Los fallos de limpieza se señalan sin tapar el fallo original.
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    for (const ruta of porBorrar) {
      try {
        const r = await llamarApi(page, 'DELETE', ruta)
        expect.soft(r.status, `limpieza DELETE ${ruta}`).toBe(200)
      } catch (e) {
        console.warn(`limpieza DELETE ${ruta} lanzó`, e)
      }
    }
    try {
      const r = await llamarApi(page, 'DELETE', `/api/proveedores/${idProv}`)
      expect.soft(r.status, `limpieza DELETE /api/proveedores/${idProv}`).toBe(204)
    } catch (e) {
      console.warn(`limpieza DELETE /api/proveedores/${idProv} lanzó`, e)
    }
    try {
      const r = await llamarApi(page, 'DELETE', `/api/proveedores/${idProvB}`)
      expect.soft(r.status, `limpieza DELETE /api/proveedores/${idProvB}`).toBe(204)
    } catch (e) {
      console.warn(`limpieza DELETE /api/proveedores/${idProvB} lanzó`, e)
    }
  }
})
