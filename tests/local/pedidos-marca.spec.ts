import { expect, test } from '@playwright/test'

// Las marcas de la fila: poner «En espera de stock» con nota desde la celda del IMEI y ver que la marca se va al teclear un IMEI.
// En Chromium real, con la API falsa por `page.route` (datos inventados). Solo local: `npx playwright test -c playwright.local.config.ts pedidos-marca`.

/** IMEI sintético con la cifra de control de Luhn válida (14 cifras + dígito de control). No es de ningún móvil real. */
function imeiValido(n: number): string {
  const base = `3500${String(n).padStart(10, '0')}`
  let suma = 0
  for (let i = 0; i < base.length; i++) {
    let d = Number(base[base.length - 1 - i])
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return base + String((10 - (suma % 10)) % 10)
}

const filas = [1, 2].map((k) => ({
  idFila: k, fecha: '2026-11-09', plataforma: 'Web', canal: 'PARTICULARES', sku: 'i14128NegroA', imei: null as string | null, pedido: `W-MARCA-${k}`,
  fechaCompra: '2026-11-09', estado: 'PENDIENTE', editable: true, envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null,
  seguimiento: null, nivel: null, motivo: null, skuMovil: null, caja: null, faltaEnviarEn: null, sincronizadaEn: null,
  marca: null as string | null, marcaNota: null as string | null, marcaEn: null as string | null, marcaPor: null as string | null,
}))

test('poner «En espera de stock» con nota desde la celda del IMEI, ver la etiqueta y que teclear un IMEI la quita', async ({ page }) => {
  const marcas: { id: string; marca: string | null; nota: string | null; marcaAnterior: string | null; clave: string | null }[] = []
  const imeis: { id: string; imei: string | null }[] = []
  await page.addInitScript(() => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
  })
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    const peticion = route.request()
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [{ fuente: 'SHIPPYPRO', ultimaOk: new Date().toISOString(), ultimoIntento: new Date().toISOString(), ultimoError: null, ok: true }] })
    if (ruta.endsWith('/cambios')) return route.fulfill({ json: [] })
    const marca = /\/api\/pedidos\/filas\/(\d+)\/marca$/.exec(ruta)
    if (marca && peticion.method() === 'PUT') {
      const c = peticion.postDataJSON() as { marca: string | null; nota: string | null; marcaAnterior: string | null }
      marcas.push({ id: marca[1], ...c, clave: peticion.headers()['idempotency-key'] ?? null })
      const f = filas[Number(marca[1]) - 1]
      Object.assign(f, { marca: c.marca, marcaNota: c.marca ? c.nota : null, marcaEn: c.marca ? '2026-11-13T10:00:00' : null, marcaPor: c.marca ? 'tecnico_f' : null })
      return route.fulfill({ json: f })
    }
    const imei = /\/api\/pedidos\/filas\/(\d+)\/imei$/.exec(ruta)
    if (imei && peticion.method() === 'PUT') {
      const c = peticion.postDataJSON() as { imei: string | null }
      imeis.push({ id: imei[1], imei: c.imei })
      const f = filas[Number(imei[1]) - 1]
      // Como el servidor: poner un IMEI en una fila «En espera de stock» le quita la marca.
      Object.assign(f, { imei: c.imei }, c.imei && f.marca === 'ESPERA_STOCK' ? { marca: null, marcaNota: null, marcaEn: null, marcaPor: null } : {})
      return route.fulfill({ json: f })
    }
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  const fila1 = page.getByRole('row').nth(1)
  await expect(fila1.getByRole('button', { name: 'W-MARCA-1' })).toBeVisible()

  // Se abre la celda de la fila 1: el foco está en el IMEI (lector) y la marca va debajo.
  await fila1.getByRole('button', { name: 'pulsa para poner el IMEI…' }).click()
  const abierto = page.locator('[data-state="open"][data-slot="popover-content"]')
  await expect(abierto.getByRole('textbox', { name: 'IMEI' })).toBeFocused()
  await abierto.getByRole('combobox', { name: 'Marca' }).selectOption('ESPERA_STOCK')
  await abierto.getByRole('textbox', { name: 'Nota de la marca' }).fill('llega el lunes')
  await abierto.getByRole('button', { name: 'Guardar marca' }).click()
  await expect.poll(() => marcas).toEqual([{ id: '1', marca: 'ESPERA_STOCK', nota: 'llega el lunes', marcaAnterior: '', clave: expect.any(String) }])
  await expect(fila1.getByText('En espera de stock')).toBeVisible()
  await expect(fila1.getByText('pulsa para poner el IMEI…')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '2 pendientes' })).toBeVisible()

  // El desplegable se cierra al guardar (sigue un instante en pantalla por la animación de salida).
  await expect(page.getByRole('dialog', { name: 'Poner el IMEI' })).toHaveCount(0)
  // Se reabre y se teclea un IMEI con el teclado: se guarda y la marca se va (el servidor la quita).
  await fila1.getByRole('button', { name: /En espera de stock/ }).click()
  const campo = page.locator('[data-state="open"] input[aria-label="IMEI"]')
  await expect(campo).toBeFocused()
  const imeiA = imeiValido(31)
  await page.keyboard.type(imeiA)
  await expect.poll(() => imeis).toEqual([{ id: '1', imei: imeiA }])
  await expect(fila1.getByText(imeiA)).toBeVisible()
  await expect(fila1.getByText('En espera de stock')).toHaveCount(0)
})
