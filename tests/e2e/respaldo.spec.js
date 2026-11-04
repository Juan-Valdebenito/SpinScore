const { test, expect } = require('@playwright/test');
const { abrirApp } = require('./helpers');

test('configuración permite descargar y restaurar un respaldo válido', async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(() => goTo('screen-settings'));

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar respaldo' }).click();
  expect((await download).suggestedFilename()).toMatch(/^spinscore-respaldo-.*\.json$/);

  const backup = {
    format: 'spinscore-backup', version: 1, createdAt: new Date().toISOString(),
    data: {
      torneos: [{ id: 'T1', name: 'Copa respaldo', players: ['Ana', 'Beto'], status: 'active' }],
      categorias: [{ id: 'C1', name: 'Adultos' }],
      ligaAbierta: null, ligas: [], partidoEnVivo: null,
      configuracion: { sets: 5, pts: 21 }, tema: 'dark',
    },
  };
  await page.locator('#backup-file-input').setInputFiles({
    name: 'respaldo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator('.ss-dialog-overlay')).toBeVisible();
  await page.locator('.ss-dialog-ok').click();
  await page.waitForLoadState('domcontentloaded');

  await expect.poll(() => page.evaluate(() => storageGetAll()[0]?.name)).toBe('Copa respaldo');
  await expect.poll(() => page.evaluate(() => cfgGet().sets)).toBe(5);
  await expect.poll(() => page.evaluate(() => themeGet())).toBe('dark');
});
