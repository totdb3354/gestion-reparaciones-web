import { defineConfig } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: 'tests/e2e',
  // En serie: cada test inicia sesión y el entorno desplegado limita los inicios de sesión por minuto;
  // en paralelo, los últimos se quedan en la pantalla de login.
  workers: 1,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // 0.9.20: el panel de carga de técnicos sale abierto de fábrica para el supertécnico y el admin, y flota arriba a la
    // derecha, encima de la vista. Las E2E entran con él cerrado, como si el usuario lo hubiera cerrado, para que no tape
    // botones. panel-carga.spec.ts lo prueba desde cero con su propio `test.use`.
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'panelCarga', value: JSON.stringify({ estado: 'cerrado' }) }] }],
    },
  },
  reporter: 'list',
})
