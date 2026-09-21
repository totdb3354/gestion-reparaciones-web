import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  // En serie: cada test inicia sesión y el entorno desplegado limita los inicios de sesión por minuto;
  // en paralelo, los últimos se quedan en la pantalla de login.
  workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', trace: 'retain-on-failure' },
  reporter: 'list',
})
