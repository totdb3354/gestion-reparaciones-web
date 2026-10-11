import { expect, test, type Page } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Formas de las respuestas que usa el test (schema.d.ts: TrabajoCerrado, Cliente). Se repiten aquí a mano porque el e2e
 *  no importa código de la app. */
type TrabajoCerrado = { idRep: string; fechaFin: string; descripcion: string | null; idCli: number | null; cliente: string | null }
type Cliente = { idCli: number; nombre: string }
type Eleccion = { idRep: string; imei: string; original: Cliente; otro: Cliente }

async function entrar(page: Page, variableUsuario: string, variableClave: string) {
  const { usuario, clave } = credenciales(variableUsuario, variableClave)
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
}

/** Petición a la API con el token de la sesión de la página (patrón de pedidos.spec.ts). */
async function llamarApi(page: Page, metodo: 'GET' | 'PATCH', ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown }> {
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

/** Un trabajo cerrado de reparación con cliente guardado, ese cliente activo (el modal solo ofrece activos: así se puede
 *  devolver desde la interfaz) y otro cliente activo al que cambiarlo. Se elige dentro de la página para no traer el
 *  historial entero por el protocolo del navegador. Sin candidato, null. */
async function elegirTrabajo(page: Page): Promise<Eleccion | null> {
  return page.evaluate(async () => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const headers = { Authorization: `Bearer ${sesion.token}` }
    const activos = (await (await fetch('/api/clientes/activos', { headers })).json()) as { idCli: number; nombre: string }[]
    const historial = (await (await fetch('/api/reparaciones/historial', { headers })).json()) as
      { idRep: string; imei: string; fechaFin: string | null; cliente: string | null }[]
    const porNombre = new Map(activos.map((c) => [c.nombre, c]))
    const rep = historial.find((r) => r.idRep.startsWith('R') && r.fechaFin && r.cliente && porNombre.has(r.cliente))
    if (!rep?.cliente) return null
    const original = porNombre.get(rep.cliente)!
    const otro = activos.find((c) => c.idCli !== original.idCli && c.nombre !== original.nombre)
    if (!otro) return null
    return { idRep: rep.idRep, imei: rep.imei, original: { idCli: original.idCli, nombre: original.nombre }, otro: { idCli: otro.idCli, nombre: otro.nombre } }
  })
}

async function cerradosDe(page: Page, imei: string): Promise<TrabajoCerrado[]> {
  const r = await llamarApi(page, 'GET', `/api/reparaciones/imei/${encodeURIComponent(imei)}/cerrados`)
  expect(r.status, `GET /cerrados respondió ${r.status}`).toBe(200)
  return r.json as TrabajoCerrado[]
}

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** La fila cuya celda de id es EXACTAMENTE `idRep` (DataTable pone `data-columna` en cada `<td>`). */
function filaDeId(page: Page, idRep: string) {
  const exacto = new RegExp(`^\\s*${escaparRegex(idRep)}\\s*$`)
  return page.getByRole('row').filter({ has: page.locator('td[data-columna="id"]', { hasText: exacto }) })
}

/** Abre «Corregir cliente» en la fila, elige `destino` y deja marcado SOLO `idRep` (de entrada salen también los del
 *  mismo día con el mismo cliente). Devuelve el estado del PATCH. */
async function corregirSoloEste(page: Page, idRep: string, guardadoAhora: string, destino: string): Promise<number> {
  await filaDeId(page, idRep).locator('td[data-columna="cliente"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Corregir cliente' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Corregir cliente' })
  await expect(dialogo.getByText(`guardado ahora: ${guardadoAhora}`)).toBeVisible()
  const casillas = dialogo.locator('li')
  await expect(casillas.filter({ hasText: idRep })).toHaveCount(1)
  await dialogo.getByLabel('Cliente correcto').selectOption({ label: destino })
  for (const li of await casillas.all()) {
    const casilla = li.getByRole('checkbox')
    const esEste = ((await li.textContent()) ?? '').includes(idRep)
    if ((await casilla.isChecked()) !== esEste) await casilla.click()
  }
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/reparaciones/cliente' && r.request().method() === 'PATCH')
  await dialogo.getByRole('button', { name: 'Corregir 1' }).click()
  const status = (await respuesta).status()
  await expect(dialogo).toBeHidden()
  return status
}

/**
 * ESCRIBE en el entorno de destino: corrige el cliente guardado de UN trabajo cerrado de reparación (el primero del
 * Historial con un cliente activo) a otro cliente activo y lo devuelve al suyo, las dos veces desde el modal. Si el test
 * cae a medias, lo devuelve por la API. Quedan dos líneas CORREGIR_CLIENTE_TRABAJO en el registro. Solo contra un
 * entorno de pruebas.
 */
test('supertécnico: columna y filtro Cliente, y corregir el cliente de un trabajo cerrado y deshacerlo', async ({ page }) => {
  await entrar(page, 'E2E_USER', 'E2E_PASS')
  await expect(page).toHaveURL(/\/reparaciones\/asignaciones$/)
  await page.getByRole('link', { name: 'Historial', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

  const eleccion = await elegirTrabajo(page)
  test.skip(!eleccion, 'No hay un trabajo cerrado de reparación con un cliente activo y otro cliente activo al que cambiarlo')
  const { idRep, imei, original, otro } = eleccion!

  // La lista del modal: cada trabajo una vez y las asignaciones con su descripción bien escrita (literal con tilde en SQL).
  const cerrados = await cerradosDe(page, imei)
  expect(new Set(cerrados.map((t) => t.idRep)).size).toBe(cerrados.length)
  for (const t of cerrados.filter((x) => x.idRep.startsWith('A'))) expect(t.descripcion).toBe('Asignación')
  expect(cerrados.find((t) => t.idRep === idRep)?.idCli).toBe(original.idCli)

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

  try {
    expect(await corregirSoloEste(page, idRep, original.nombre, otro.nombre)).toBe(204)
    await expect(celdaCliente).toHaveText(otro.nombre)
    expect(await corregirSoloEste(page, idRep, otro.nombre, original.nombre)).toBe(204)
    await expect(celdaCliente).toHaveText(original.nombre)
  } finally {
    const ahora = (await cerradosDe(page, imei)).find((t) => t.idRep === idRep)
    if (ahora && ahora.idCli !== original.idCli) {
      const r = await llamarApi(page, 'PATCH', '/api/reparaciones/cliente', { imei, idReps: [idRep], idCli: original.idCli })
      expect(r.status, `No se pudo devolver ${idRep} a su cliente (${original.nombre}): corregirlo a mano`).toBe(204)
    }
  }
})

/** El administrador no tiene el menú de edición del Historial, pero sí «Corregir cliente». Solo lectura: abre el modal y
 *  lo cierra sin corregir. */
test('admin: el menú de un trabajo cerrado ofrece Corregir cliente y no Editar', async ({ page }) => {
  await entrar(page, 'ADMIN_USER', 'ADMIN_PASS')
  await page.goto('/reparaciones/historial')
  await expect(page.getByRole('heading', { name: 'Historial de reparaciones' })).toBeVisible()
  await expect(page.getByText(/^Actualizado [0-9][0-9]:[0-9][0-9]$/)).toBeVisible()

  const eleccion = await elegirTrabajo(page)
  test.skip(!eleccion, 'No hay un trabajo cerrado de reparación con un cliente activo')
  const { idRep, imei, original } = eleccion!

  await page.getByPlaceholder('Filtrar por IMEI').fill(imei)
  await filaDeId(page, idRep).locator('td[data-columna="cliente"]').click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Corregir cliente' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Editar' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Corregir cliente' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Corregir cliente' })
  await expect(dialogo.getByText(`guardado ahora: ${original.nombre}`)).toBeVisible()
  await expect(dialogo.locator('li').filter({ hasText: idRep })).toHaveCount(1)
  await dialogo.getByRole('button', { name: 'Cerrar' }).click()
  await expect(dialogo).toBeHidden()
})
