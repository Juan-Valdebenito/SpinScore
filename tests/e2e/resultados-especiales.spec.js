const { test, expect } = require('@playwright/test');
const { abrirApp, armarTorneo } = require('./helpers');

test('registra W.O. en un partido de grupo y lo muestra como resultado especial', async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(() => {
    nuevoTorneoGrupos(); selectGroups(2);
    ['Ana', 'Beto', 'Cami', 'Dani'].forEach(name => { document.getElementById('gp-input').value = name; addGPlayer(); });
    sortearGrupos(); confirmarGrupos(); abrirResultado(0, 'group');
  });
  await page.getByRole('button', { name: /^W\.O\./ }).first().click();
  await page.locator('.ss-dialog-ok').click();
  await expect.poll(() => page.evaluate(() => ({ done: GT.groupMatches[0].done, type: GT.groupMatches[0].resultType })))
    .toEqual({ done: true, type: 'walkover' });
  await expect(page.locator('#groups-main-content')).toContainText('W.O.');
});

test('registra retiro en eliminatoria y avanza al rival', async ({ page }) => {
  await abrirApp(page);
  await armarTorneo(page, { jugadores: 4, grupos: 2 });
  await page.evaluate(() => { iniciarEliminacion(); abrirResultadoElim(0, 0); });
  await page.getByRole('button', { name: /^Retiro/ }).first().click();
  await page.locator('.ss-dialog-ok').click();
  await expect.poll(() => page.evaluate(() => ({ done: GT.elimRounds[0][0].done, type: GT.elimRounds[0][0].resultType })))
    .toEqual({ done: true, type: 'retired' });
  await expect.poll(() => page.evaluate(() => GT.elimRounds[1][0].p1name || GT.elimRounds[1][0].p2name)).not.toBe('TBD');
});
