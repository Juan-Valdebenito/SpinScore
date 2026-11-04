const { test, expect } = require('@playwright/test');
const { abrirApp } = require('./helpers');

test('guarda un partido rápido terminado y lo muestra en su historial', async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(async () => {
    initMatch('Ana', 'Beto', { cfg: { sets: 3, pts: 11 } });
    Object.assign(MATCH, { sets: [2, 0], setHistory: [[11, 7], [11, 9]] });
    await finishMatch();
    goTo('screen-quick-history');
  });
  await expect.poll(() => page.evaluate(() => quickHistoryGetAll().length)).toBe(1);
  await expect(page.locator('#quick-history-content')).toContainText('Ana');
  await expect(page.locator('#quick-history-content')).toContainText('11-7');
  await expect(page.locator('#quick-history-content')).toContainText('2');
});
