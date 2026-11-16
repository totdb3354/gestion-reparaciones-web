import { expect, test } from '@playwright/test'

// «Validar SKU»: en Chromium real, con la API falsa por `page.route` (datos inventados). Una fila naranja por «otro color o grado» se valida
// desde el desplegable del IMEI (el foco sigue en el campo), la celda pasa a «validado» y el contador baja; «Quitar validación» la devuelve.
// Una naranja por «no está en NSYS» no ofrece el botón. Solo local: `npx playwright test -c playwright.local.config.ts pedidos-validar`.

const base = (k: number) => ({
  idFila: k, fecha: '2026-11-09', plataforma: 'Web', canal: 'PARTICULARES', sku: 'i14128NegroA', pedido: `W-VALIDAR-${k}`,
  fechaCompra: '2026-11-09', estado: 'PENDIENTE', editable: true, envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null,
  seguimiento: null, caja: null, faltaEnviarEn: null, sincronizadaEn: null, marca: null, marcaNota: null, marcaEn: null, marcaPor: null,
  validadaEn: null as string | null, validadaPor: null as string | null, motivoValidado: null as string | null,
})
const filas = [
  { ...base(1), imei: '350000000000011', nivel: 'MAL', motivo: 'COLOR_O_GRADO', skuMovil: 'i14128AzulA' },
  { ...base(2), imei: '350000000000029', nivel: 'MAL', motivo: 'NO_EN_NSYS', skuMovil: null },
]

test('validar y quitar la validacion desde el desplegable del IMEI, sin quitarle el foco al campo', async ({ page }) => {
  const puts: { id: string; validar: boolean; imeiAnterior: string | null; clave: string | null }[] = []
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
    const v = /\/api\/pedidos\/filas\/(\d+)\/validacion$/.exec(ruta)
    if (v && peticion.method() === 'PUT') {
      const c = peticion.postDataJSON() as { validar: boolean; imeiAnterior: string | null }
      puts.push({ id: v[1], ...c, clave: peticion.headers()['idempotency-key'] ?? null })
      const f = filas[Number(v[1]) - 1]
      // Como el servidor: validada = nivel OK con el motivo guardado; quitada = vuelve el naranja.
      if (c.validar) Object.assign(f, { nivel: 'OK', motivoValidado: f.motivo, validadaPor: 'tecnico_f', validadaEn: '2026-11-16T10:00:00' })
      else Object.assign(f, { nivel: 'MAL', motivoValidado: null, validadaPor: null, validadaEn: null })
      return route.fulfill({ json: f })
    }
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  const fila1 = page.getByRole('row').nth(1)
  await expect(fila1.getByRole('button', { name: 'W-VALIDAR-1' })).toBeVisible()
  await expect(page.getByRole('button', { name: '2 no cuadran' })).toBeVisible()

  // Fila 2 (no está en NSYS): sin botón. Se cierra con Escape.
  const fila2 = page.getByRole('row').nth(2)
  await fila2.getByRole('button', { name: /350000000000029/ }).click()
  const abierto = page.locator('[data-state="open"][data-slot="popover-content"]')
  await expect(abierto.getByRole('textbox', { name: 'IMEI' })).toBeFocused()
  await expect(abierto.getByRole('button', { name: /Validar SKU|Quitar validación/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Poner el IMEI' })).toHaveCount(0)

  // Fila 1 (otro color o grado): el foco está en el IMEI y el botón va debajo; validar la deja «validado».
  await fila1.getByRole('button', { name: /350000000000011/ }).click()
  await expect(abierto.getByRole('textbox', { name: 'IMEI' })).toBeFocused()
  await abierto.getByRole('button', { name: 'Validar SKU' }).click()
  await expect.poll(() => puts).toEqual([{ id: '1', validar: true, imeiAnterior: '350000000000011', clave: expect.any(String) }])
  await expect(abierto.getByRole('button', { name: 'Quitar validación' })).toBeVisible()
  await expect(fila1.locator('[data-validado]')).toHaveText('validado')
  await expect(fila1.getByText('otro color o grado')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '1 no cuadran' })).toBeVisible()

  // Quitar la validación devuelve el naranja y el contador.
  await abierto.getByRole('button', { name: 'Quitar validación' }).click()
  await expect.poll(() => puts.length).toBe(2)
  expect(puts[1]).toEqual({ id: '1', validar: false, imeiAnterior: '350000000000011', clave: expect.any(String) })
  await expect(fila1.locator('[data-validado]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '2 no cuadran' })).toBeVisible()
})
