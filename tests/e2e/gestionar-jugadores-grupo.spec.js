const { test, expect } = require('@playwright/test');
const { abrirApp } = require('./helpers');

test('permite renombrar y retirar un jugador después del sorteo antes de jugar', async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(() => {
    nuevoTorneoGrupos(); selectGroups(2);
    ['Ana', 'Beto', 'Cami', 'Dani', 'Elena', 'Fabi'].forEach(name => { document.getElementById('gp-input').value = name; addGPlayer(); });
    sortearGrupos(); confirmarGrupos();
  });
  await expect(page.locator('.group-player-manager')).toBeVisible();
  const player = await page.evaluate(() => GT.groups[0][0]);
  const previous = await page.evaluate(id => GT.players[id], player);

  await page.evaluate((id) => { void renombrarJugadorGrupo(0, id); }, player);
  await page.locator('.ss-dialog-input').fill('Renombrada');
  await page.locator('.ss-dialog-ok').click();
  await expect.poll(() => page.evaluate(id => GT.players[id], player)).toBe('Renombrada');
  await expect(page.locator('#groups-main-content')).toContainText('Renombrada');
  expect(previous).not.toBe('Renombrada');

  await page.evaluate((id) => { void retirarJugadorGrupo(0, id); }, player);
  await page.locator('.ss-dialog-ok').click();
  await expect.poll(() => page.evaluate(id => GT.groups[0].includes(id), player)).toBe(false);
  await expect.poll(() => page.evaluate(id => GT.groupMatches.some(m => m.groupIdx === 0 && (m.p1 === id || m.p2 === id)), player)).toBe(false);
  await expect.poll(() => page.evaluate(() => storageGetAll()[0].groups[0].length)).toBe(2);
});
