const { test, expect } = require('@playwright/test');
const { abrirApp, armarTorneo } = require('./helpers');

async function ganarEnVivo(page, player = 0) {
  await page.evaluate(async player => {
    for (let set = 0; set < 2; set++) for (let point = 0; point < 11; point++) addPoint(player);
    await new Promise(resolve => setTimeout(resolve, 350));
    await finishMatch();
  }, player);
}

test('un partido de grupo se juega en el marcador en vivo y guarda su resultado', async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(() => {
    nuevoTorneoGrupos(); selectGroups(2);
    ['Ana', 'Beto', 'Cami', 'Dani'].forEach(name => { document.getElementById('gp-input').value = name; addGPlayer(); });
    sortearGrupos(); confirmarGrupos(); abrirResultado(0, 'group');
  });
  await expect(page.locator('#result-live-btn')).toBeVisible();
  await page.locator('#result-live-btn').click();
  await expect(page.locator('#screen-score')).toHaveClass(/active/);

  await ganarEnVivo(page);
  await expect.poll(() => page.evaluate(() => GT.groupMatches[0].done)).toBe(true);
  await expect.poll(() => page.evaluate(() => GT.groupMatches[0].setScores)).toEqual([[11, 0], [11, 0]]);
});

test('un partido eliminatorio se juega en vivo y propaga su ganador', async ({ page }) => {
  await abrirApp(page);
  await armarTorneo(page, { jugadores: 4, grupos: 2 });
  await page.evaluate(() => { iniciarEliminacion(); abrirResultadoElim(0, 0); });
  await page.locator('#result-live-btn').click();
  await ganarEnVivo(page);

  await expect.poll(() => page.evaluate(() => GT.elimRounds[0][0].done)).toBe(true);
  await expect.poll(() => page.evaluate(() => GT.elimRounds[1][0].p1name || GT.elimRounds[1][0].p2name)).not.toBe('TBD');
});

test('un partido de torneo a medias se puede reanudar tras recargar', async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(() => {
    nuevoTorneoGrupos(); selectGroups(2);
    ['Ana', 'Beto', 'Cami', 'Dani'].forEach(name => { document.getElementById('gp-input').value = name; addGPlayer(); });
    sortearGrupos(); confirmarGrupos(); abrirResultado(0, 'group');
  });
  await page.locator('#result-live-btn').click();
  await page.evaluate(() => addPoint(0));
  await page.reload();
  await page.evaluate(() => resumeLiveMatch());

  await expect.poll(() => page.evaluate(() => ({ points: MATCH.pts[0], source: MATCH.source, tournament: GT.id === MATCH.tournamentId })))
    .toEqual({ points: 1, source: 'torneo', tournament: true });
});
