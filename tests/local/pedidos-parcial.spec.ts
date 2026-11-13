import { expect, test } from '@playwright/test'

// Envío parcial de web: marcar «Falta por enviar» desde el panel y ver la etiqueta ámbar en la tabla, y quitar la marca. En Chromium
// real, con la API falsa por `page.route` (datos inventados). Solo local: `npx playwright test -c playwright.local.config.ts pedidos-parcial`.
const filas = [1, 2, 3].map((k) => ({
  idFila: k, fecha: '2026-11-09', plataforma: 'Cliente Web', canal: 'PARTICULARES', sku: 'i14128NegroA', imei: null as string | null, pedido: 'W-TRES',
  fechaCompra: '2026-11-09', estado: 'ENVIADA', editable: true, envioFecha: '2026-11-09T10:30:00', impresaEn: null, tieneEtiqueta: false, transportista: null,
  seguimiento: null, nivel: null, motivo: null, skuMovil: null, caja: null, faltaEnviarEn: null as string | null, sincronizadaEn: null,
}))

test('marcar «Falta por enviar» desde el panel pone la etiqueta ámbar, el «3/3» sigue y «Ya ha salido» la quita', async ({ page }) => {
  const puts: { id: string; falta: boolean; clave: string | null }[] = []
  await page.addInitScript(() => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
  })
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [{ fuente: 'SHIPPYPRO', ultimaOk: new Date().toISOString(), ultimoIntento: new Date().toISOString(), ultimoError: null, ok: true }] })
    if (ruta.endsWith('/cambios')) return route.fulfill({ json: [] })
    const m = /\/api\/pedidos\/filas\/(\d+)\/falta-enviar$/.exec(ruta)
    if (m && route.request().method() === 'PUT') {
      const { falta } = route.request().postDataJSON() as { falta: boolean }
      puts.push({ id: m[1], falta, clave: route.request().headers()['idempotency-key'] ?? null })
      const f = filas[Number(m[1]) - 1]
      f.faltaEnviarEn = falta ? '2026-11-13T10:00:00' : null
      return route.fulfill({ json: f })
    }
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })
  const marcas = page.locator('[data-numero-pedido]')
  await expect(marcas).toHaveText(['1/3', '2/3', '3/3'])

  // Se elige la tercera fila (la que falta por salir) y se marca desde el panel.
  await page.getByRole('row').nth(3).getByRole('button', { name: 'W-TRES' }).click()
  const panel = page.getByRole('region', { name: 'Detalle del pedido' })
  await panel.getByRole('button', { name: 'Falta por enviar' }).click()
  await expect.poll(() => puts).toEqual([{ id: '3', falta: true, clave: expect.any(String) }])
  await expect(page.getByRole('row').nth(3).getByText('Envío parcial · falta por enviar')).toBeVisible()
  await expect(page.getByRole('row').nth(1).getByText(/^Etiqueta generada/)).toBeVisible()
  await expect(panel.getByText('Envío parcial: falta por enviar desde 13/11 10:00')).toBeVisible()
  await expect(page.getByRole('button', { name: '1 pendientes' })).toBeVisible()
  await expect(marcas).toHaveText(['1/3', '2/3', '3/3'])

  await panel.getByRole('button', { name: 'Ya ha salido' }).click()
  await expect.poll(() => puts.map((p) => p.falta)).toEqual([true, false])
  await expect(page.getByText('Envío parcial · falta por enviar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '0 pendientes' })).toBeVisible()
})
