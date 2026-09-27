import { expect, test, type Page, type Response } from '@playwright/test'
import { credenciales } from './credenciales.ts'

/** Forma de GET /api/usuarios/tecnicos (schema.d.ts: Usuario). Se repite a mano porque el e2e no importa código de la app. */
type UsuarioApi = { idUsu: number; nombreUsuario: string; rol: string; idTec: number; nombreTecnico: string; activo: boolean }

/** Usuario de prueba que puede seguir vivo si el test falla antes del borrado por la interfaz; afterAll lo borra por la API. */
let pendiente: { nombreUsuario: string } | null = null

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const esRespuesta = (ruta: string, metodo: string) => (r: Response) => new URL(r.url()).pathname === ruta && r.request().method() === metodo

/** Fecha civil de hoy en Madrid ('yyyy-MM-dd'), el formato de los <input type="date"> de RangoFechas. */
const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

async function entrarCon(page: Page, usuario: string, clave: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Usuario').fill(usuario)
  await page.getByPlaceholder('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.getByText('FSGR:')).toBeVisible()
  // La barra se pinta antes de que `<Navigate>` lleve de /reparaciones a /historial (ADMIN) o /pendientes (TECNICO):
  // se espera la URL final porque `origen` y la `ruta` de `cambiarPassword` leen `page.url()` después de la redirección.
  await expect(page).toHaveURL(/\/reparaciones\/(historial|pendientes)$/)
}

async function menuUsuario(page: Page, item: string) {
  await page.getByRole('button', { name: /Hola,/ }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

async function cerrarSesion(page: Page) {
  await menuUsuario(page, 'Cerrar Sesión')
  await expect(page).toHaveURL(/\/login$/)
}

/** GET /api/usuarios/tecnicos con el token de la sesión de la página (misma origin que la app; patrón de pedidos.spec.ts). */
async function usuariosTecnicos(page: Page): Promise<UsuarioApi[]> {
  return page.evaluate(async () => {
    const sesion = JSON.parse(localStorage.getItem('fsgr.sesion') ?? '{}') as { token?: string }
    const r = await fetch('/api/usuarios/tecnicos', { headers: { Authorization: `Bearer ${sesion.token}` } })
    if (!r.ok) throw new Error(`GET /api/usuarios/tecnicos: ${r.status}`)
    return (await r.json()) as UsuarioApi[]
  })
}

/** Abre "Cambiar contraseña" desde el menú, comprueba que no navega y cambia `actual` por `nueva`. */
async function cambiarPassword(page: Page, actual: string, nueva: string) {
  const ruta = new URL(page.url()).pathname
  await menuUsuario(page, 'Cambiar contraseña')
  const dlg = page.getByRole('dialog', { name: 'Cambiar contraseña' })
  await expect(dlg).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${escaparRegex(ruta)}$`))
  await dlg.getByPlaceholder('Contraseña actual', { exact: true }).fill(actual)
  await dlg.getByPlaceholder('Nueva contraseña', { exact: true }).fill(nueva)
  await dlg.getByPlaceholder('Confirmar contraseña', { exact: true }).fill(nueva)
  const respuesta = page.waitForResponse(esRespuesta('/api/auth/cambiar-password', 'PATCH'))
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  expect((await respuesta).status(), 'PATCH /api/auth/cambiar-password').toBe(204)
  await expect(dlg).toBeHidden()
  const aviso = page.getByRole('dialog', { name: 'Mensaje' })
  await expect(aviso.getByText('Contraseña cambiada correctamente.')).toBeVisible()
  await aviso.getByRole('button', { name: 'Aceptar' }).click()
  await expect(page).toHaveURL(new RegExp(`${escaparRegex(ruta)}$`))
}

/**
 * ESCRIBE en el entorno de destino: con ADMIN_USER registra un técnico de prueba `e2e-tecnico-<marca>` (usuario
 * `e2e-usuario-<marca>`, rol TECNICO, contraseña sintética), lo desactiva y lo activa, busca su CREAR_USUARIO en el visor de
 * logs, entra con él y cambia su contraseña por el diálogo (y la restaura), y por último lo borra como ADMIN desde la
 * papelera. Solo toca ese usuario: las escrituras de /api/usuarios/tecnicos/{id} a otro id se abortan.
 */
test('admin: técnico de prueba registrado, bloqueado y desbloqueado, visto en el log, con contraseña cambiada y borrado', async ({ page }) => {
  test.setTimeout(180_000)
  const admin = credenciales('ADMIN_USER', 'ADMIN_PASS')
  const marca = Date.now()
  const nombreTecnico = `e2e-tecnico-${marca}`
  const nombreUsuario = `e2e-usuario-${marca}`
  const clave = `e2e-clave-${marca}`
  const claveNueva = `e2e-nueva-${marca}`

  await entrarCon(page, admin.usuario, admin.clave) // inicio de sesión 1/4
  const origen = new URL(page.url()).pathname

  let idTec = 0
  let idUsu = 0
  await test.step('alta desde "Gestionar técnicos"', async () => {
    const lista = page.waitForResponse(esRespuesta('/api/usuarios/tecnicos', 'GET'))
    await menuUsuario(page, 'Gestionar técnicos')
    await expect(page).toHaveURL(/\/gestion\/tecnicos$/)
    await expect(page.getByText('Gestión de usuarios', { exact: true })).toBeVisible()
    expect((await lista).ok()).toBe(true)

    await page.getByPlaceholder('Nombre visible en reparaciones').fill(nombreTecnico)
    await page.getByPlaceholder('Credencial de login').fill(nombreUsuario)
    await page.getByPlaceholder('Contraseña', { exact: true }).fill(clave)
    await page.getByPlaceholder('Repite la contraseña').fill(clave)

    // Se registra ANTES del clic: si el alta llega a escribir y el test cae después, afterAll sabe qué borrar.
    pendiente = { nombreUsuario }
    test.info().annotations.push({ type: 'e2e-creado', description: `técnico ${nombreTecnico} / usuario ${nombreUsuario}` })
    const alta = page.waitForResponse(esRespuesta('/api/usuarios/tecnicos', 'POST'))
    await page.getByRole('button', { name: 'Registrar técnico' }).click()
    const respuesta = await alta
    expect(respuesta.status(), 'POST /api/usuarios/tecnicos').toBe(201)
    expect(respuesta.request().postDataJSON()).toEqual({ nombreTecnico, nombreUsuario, password: clave, rol: 'TECNICO' })
    // Sin mensaje de éxito (calco): el formulario se vacía.
    await expect(page.getByPlaceholder('Nombre visible en reparaciones')).toHaveValue('')

    const creados = (await usuariosTecnicos(page)).filter((u) => u.nombreUsuario === nombreUsuario)
    expect(creados).toHaveLength(1)
    expect(creados[0]).toMatchObject({ nombreTecnico, rol: 'TECNICO', activo: true })
    idTec = creados[0].idTec
    idUsu = creados[0].idUsu
  })

  // A partir de aquí solo se deja escribir sobre el técnico de prueba (patrón soloBorrar de pedidos.spec.ts).
  const propias = new Set([
    `/api/usuarios/tecnicos/${idTec}`, `/api/usuarios/tecnicos/${idTec}/activar`, `/api/usuarios/tecnicos/${idTec}/desactivar`,
  ])
  await page.route('**/api/usuarios/tecnicos/**', (route) => {
    const req = route.request()
    if (req.method() !== 'GET' && !propias.has(new URL(req.url()).pathname)) return route.abort()
    return route.continue()
  })
  const fila = page.getByRole('row').filter({ hasText: nombreTecnico })

  await test.step('fila nueva, desactivar y activar con el candado', async () => {
    await expect(fila).toHaveCount(1)
    await expect(fila).toContainText(nombreUsuario)
    await expect(fila).toContainText('TECNICO')
    await expect(fila.getByText('Activo', { exact: true })).toBeVisible()

    const desactivar = page.waitForResponse(esRespuesta(`/api/usuarios/tecnicos/${idTec}/desactivar`, 'PATCH'))
    await fila.getByRole('button', { name: 'Desactivar acceso' }).click()
    expect((await desactivar).status(), `PATCH /api/usuarios/tecnicos/${idTec}/desactivar`).toBe(204)
    await expect(fila.getByText('Inactivo', { exact: true })).toBeVisible()

    const activar = page.waitForResponse(esRespuesta(`/api/usuarios/tecnicos/${idTec}/activar`, 'PATCH'))
    await fila.getByRole('button', { name: 'Activar acceso' }).click()
    expect((await activar).status(), `PATCH /api/usuarios/tecnicos/${idTec}/activar`).toBe(204)
    await expect(fila.getByText('Activo', { exact: true })).toBeVisible()
    await expect(fila.getByRole('button', { name: 'Desactivar acceso' })).toBeVisible()

    // "Cerrar" vuelve a la vista desde la que el menú abrió la página (volverA).
    await page.getByText('Cerrar', { exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${escaparRegex(origen)}$`))
  })

  await test.step('CREAR_USUARIO en "Ver logs" filtrando por acción y por el día de hoy', async () => {
    const hoy = hoyMadrid()
    await menuUsuario(page, 'Ver logs')
    await expect(page).toHaveURL(/\/gestion\/logs$/)
    await expect(page.getByText('Log de actividad', { exact: true })).toBeVisible()
    await page.getByLabel('Desde:').fill(hoy)
    await page.getByLabel('Hasta:').fill(hoy)

    // La espera se registra ANTES de elegir la acción y exige los tres filtros y el tope de 1.000 en la query.
    const filtrada = page.waitForResponse((r) => {
      const u = new URL(r.url())
      return u.pathname === '/api/logs' && r.request().method() === 'GET' && u.searchParams.get('accion') === 'CREAR_USUARIO'
        && u.searchParams.get('desde') === hoy && u.searchParams.get('hasta') === hoy && u.searchParams.get('limite') === '1000'
    })
    await page.getByPlaceholder('Acción...').fill('CREAR_USUARIO')
    await page.getByRole('option', { name: 'CREAR_USUARIO', exact: true }).click()
    expect((await filtrada).ok(), 'GET /api/logs?accion=CREAR_USUARIO').toBe(true)

    // El filtro "Técnico..." no lista ADMIN (calco), así que el autor se comprueba en la celda Usuario.
    const detalle = `NOMBRE_USUARIO: ${nombreUsuario}, ROL: TECNICO, TECNICO: ${nombreTecnico}`
    const filaLog = page.getByRole('row').filter({ hasText: detalle })
    await expect(filaLog).toHaveCount(1)
    await expect(filaLog.getByRole('cell').nth(1)).toHaveText(admin.usuario)
    await expect(filaLog).toContainText('CREAR_USUARIO')

    // Buscador en memoria (sin volver al servidor) y detalle por doble clic.
    await page.getByPlaceholder('Buscar...').fill(nombreUsuario)
    await expect(filaLog).toHaveCount(1)
    await filaLog.dblclick()
    const popup = page.getByRole('dialog', { name: 'Detalle del log' })
    await expect(popup).toContainText(detalle)
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })

  await test.step('el usuario de prueba cambia su contraseña desde el menú y vuelve a entrar con la nueva', async () => {
    await cerrarSesion(page)
    await entrarCon(page, nombreUsuario, clave) // inicio de sesión 2/4
    await cambiarPassword(page, clave, claveNueva)
    await cerrarSesion(page)
    await entrarCon(page, nombreUsuario, claveNueva) // inicio de sesión 3/4
    await cambiarPassword(page, claveNueva, clave) // restaurada: si el borrado fallase, el usuario queda con la original
    await cerrarSesion(page)
  })

  await test.step('el ADMIN lo borra desde la papelera', async () => {
    await entrarCon(page, admin.usuario, admin.clave) // inicio de sesión 4/4
    await menuUsuario(page, 'Gestionar técnicos')
    await expect(fila).toHaveCount(1)
    const comprobacion = page.waitForResponse(esRespuesta(`/api/usuarios/tecnicos/${idTec}/tiene-reparaciones`, 'GET'))
    await fila.locator('button:has(img[src="/borrar.png"])').click()
    const tiene = await comprobacion
    expect(tiene.ok()).toBe(true)
    expect(await tiene.json()).toEqual({ value: false })

    const confirmar = page.getByRole('dialog', { name: 'Eliminar técnico' })
    await expect(confirmar).toContainText(`¿Eliminar a "${nombreTecnico}" definitivamente?`)
    const borrado = page.waitForResponse(esRespuesta(`/api/usuarios/tecnicos/${idTec}`, 'DELETE'))
    await confirmar.getByRole('button', { name: 'Eliminar', exact: true }).click()
    const respuesta = await borrado
    expect(respuesta.status(), `DELETE /api/usuarios/tecnicos/${idTec}`).toBe(204)
    expect(new URL(respuesta.url()).searchParams.get('idUsu')).toBe(String(idUsu))
    pendiente = null
    await expect(fila).toHaveCount(0)
  })
})

/**
 * Limpieza por la API si el test cayó con el usuario de prueba creado. Busca por el nombre de usuario EXACTO y borra solo
 * esa fila; los fallos se señalan con expect.soft nombrando la ruta, sin tapar el fallo original.
 */
test.afterAll(async ({ playwright }, testInfo) => {
  const restante = pendiente
  const usuario = process.env.ADMIN_USER
  const clave = process.env.ADMIN_PASS
  if (!restante || !usuario || !clave) return
  // El test ya ha gastado hasta cuatro inicios de sesión; nginx admite 5 por minuto con ráfaga de 3 (uno nuevo cada 12 s).
  await new Promise((r) => setTimeout(r, 12_000))
  const ctx = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  try {
    const login = await ctx.post('/api/auth/login', { data: { usuario, password: clave } })
    expect.soft(login.status(), 'limpieza POST /api/auth/login').toBe(200)
    if (!login.ok()) return
    const { token } = (await login.json()) as { token: string }
    const headers = { Authorization: `Bearer ${token}` }
    const lista = await ctx.get('/api/usuarios/tecnicos', { headers })
    expect.soft(lista.status(), 'limpieza GET /api/usuarios/tecnicos').toBe(200)
    if (!lista.ok()) return
    const quedan = ((await lista.json()) as UsuarioApi[]).filter((u) => u.nombreUsuario === restante.nombreUsuario)
    for (const u of quedan) {
      const ruta = `/api/usuarios/tecnicos/${u.idTec}?idUsu=${u.idUsu}`
      const r = await ctx.delete(ruta, { headers })
      expect.soft(r.status(), `limpieza DELETE ${ruta}`).toBe(204)
    }
  } finally {
    await ctx.dispose()
  }
})
