import { expect, test } from '@playwright/test'

// La asociación de Amazon: una fila sin asociar dice «sin asociar» (y no enseña el número), la asociada enseña el suyo, y la píldora
// «Asociación Amazon» abre la lista «para revisar». En Chromium real, con la API falsa por `page.route` (datos inventados).
// Solo local: `npx playwright test -c playwright.local.config.ts pedidos-asociacion`.

const base = {
  fecha: '2026-11-09', plataforma: 'Plataforma A', imei: null as string | null, fechaCompra: '2026-11-09', estado: 'PENDIENTE', editable: true,
  envioFecha: null, impresaEn: null, tieneEtiqueta: false, transportista: null, seguimiento: null, nivel: null, motivo: null, skuMovil: null,
  caja: null, faltaEnviarEn: null, sincronizadaEn: null, marca: null, marcaNota: null, marcaEn: null, marcaPor: null,
}
const filas = [
  { ...base, idFila: 1, canal: 'AMAZON', sku: 'i14128NegroA', pedido: '111-0000000-0000001', asociadaEn: null, asociadaOrigen: null },
  { ...base, idFila: 2, canal: 'AMAZON', sku: 'i14128AzulA', pedido: '222-0000000-0000002', asociadaEn: '2026-11-13T09:30:00', asociadaOrigen: 'LIBRO' },
  { ...base, idFila: 3, canal: 'PARTICULARES', sku: 'i13128AzulA', pedido: 'W-ASOC-3', asociadaEn: null, asociadaOrigen: null },
]
const pasadas = [{
  canal: 'AMAZON', cuando: '2026-11-13T09:30:00', confirmadas: 1, intercambiadas: 0, puestas: 0, yaEstaban: 0, paraRevisar: 1, descartadas: 0,
  revisar: [{ pedido: '999-0000000-0000009', imei: '350000000000009', motivo: 'SIN_HUECO', vistoEn: '2026-11-13T09:30:00' }],
}]

test('Amazon sin asociar dice «sin asociar» sin el número; la asociada y la web lo enseñan; la píldora abre la lista para revisar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super', passwordTemporal: false }))
    localStorage.setItem('fsgr.latido', String(Date.now()))
  })
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta === '/api/pedidos/filas') return route.fulfill({ json: { filas, hayMas: false } })
    if (ruta === '/api/pedidos/fuentes') return route.fulfill({ json: [] })
    if (ruta === '/api/pedidos/asociaciones') return route.fulfill({ json: { canales: pasadas } })
    if (ruta.endsWith('/cambios')) return route.fulfill({ json: [] })
    if (ruta.endsWith('/recomendados')) return route.fulfill({ json: [] })
    return route.fulfill({ json: ruta.includes('estado') ? {} : [] })
  })
  await page.goto('/telefonos/pedidos')
  await page.getByLabel('Periodo:').selectOption({ label: 'Todo' })

  const sin = page.getByRole('row').nth(1)
  await expect(sin.getByRole('button', { name: 'sin asociar' })).toBeVisible()
  await expect(page.getByText('111-0000000-0000001')).toHaveCount(0)
  await expect(page.getByRole('row').nth(2).getByRole('button', { name: '222-0000000-0000002' })).toBeVisible()
  await expect(page.getByRole('row').nth(3).getByRole('button', { name: 'W-ASOC-3' })).toBeVisible()

  // La píldora y su lista.
  await page.getByRole('button', { name: /Asociación Amazon: 09:30 · 1 para revisar/ }).click()
  const lista = page.getByRole('dialog', { name: 'Asociación de Amazon' })
  await expect(lista.getByText('999-0000000-0000009')).toBeVisible()
  await expect(lista.getByText('el pedido no tiene hueco')).toBeVisible()
  await page.keyboard.press('Escape')

  // El filtro «Sin asociar» deja solo la de Amazon sin asociar.
  await page.getByRole('button', { name: 'Filtrar IMEI' }).click()
  await page.getByRole('checkbox', { name: /Sin asociar/ }).click()
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'sin asociar', exact: true })).toHaveCount(1)
})
