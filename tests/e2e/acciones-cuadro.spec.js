const { test, expect } = require('@playwright/test');
const { abrirApp, armarTorneo } = require('./helpers');

test('el cuadro eliminatorio ofrece compartir, vista pública y PDF', async ({ page }) => {
  await abrirApp(page);
  await armarTorneo(page, { jugadores: 4, grupos: 2, nombre: 'Copa cuadro' });
  await page.evaluate(() => iniciarEliminacion());
  const bar = page.locator('#elimination-action-bar');
  await expect(bar.getByRole('button', { name: 'Compartir link' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Vista pública' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Exportar PDF' })).toBeVisible();

  const opened = await page.evaluate(() => {
    let url = '';
    const original = window.open;
    window.open = value => { url = String(value); return null; };
    abrirVistaPublica();
    window.open = original;
    return url;
  });
  expect(opened).toContain('public.html?id=');

  const printed = await page.evaluate(() => {
    let called = false;
    window.print = () => { called = true; };
    exportarPDF();
    return called;
  });
  expect(printed).toBe(true);
});
