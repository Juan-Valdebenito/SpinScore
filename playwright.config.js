// Pruebas de la app en un navegador real: npm run test:e2e
// Por defecto usan el Google Chrome instalado. Para usar el Chromium de Playwright:
//   npx playwright install chromium   y luego   PW_CHANNEL=chromium npm run test:e2e
const { defineConfig } = require('@playwright/test');

const PORT = 5310;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL || 'chrome',
    viewport: { width: 390, height: 844 },
    // El service worker se prueba aparte; aquí se bloquea para que cada prueba parta limpia.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/e2e/server.js',
    port: PORT,
    reuseExistingServer: true,
  },
});
