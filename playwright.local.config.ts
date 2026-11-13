import { defineConfig } from '@playwright/test'

// Pruebas en Chromium contra `vite` en local y una API falsa con `page.route` (nada de preprod ni de produccion).
// Se lanzan aparte: `npx playwright test -c playwright.local.config.ts`. No entran en `npm run check` ni en la E2E de preprod.
export default defineConfig({
  testDir: 'tests/local',
  workers: 1,
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5199' },
  webServer: { command: 'npx vite build && npx vite preview --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true, timeout: 120_000 },
  reporter: 'list',
})
