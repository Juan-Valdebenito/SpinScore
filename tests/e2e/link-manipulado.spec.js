const { test, expect } = require('@playwright/test');
const { capturarErrores } = require('./helpers');

// Quien arma un link puede poner cualquier cosa en sus datos: nada de eso debe ejecutarse.
const CODIGO = '<img src=x onerror="window.__xss=1">';

const base = { name: 'Copa', phase: 'elimination', players: ['Ana', 'Beto', 'Caro', 'Dani'], groups: [[0, 1], [2, 3]], podio: null };
const partido = { groupIdx: 0, p1: 0, p2: 1, sets1: 2, sets2: 0, setScores: [[11, 5], [11, 5]], done: true };
const llave = { p1: 0, p2: 1, p1name: 'Ana', p2name: 'Beto', sets1: 2, sets2: 0, setScores: [[11, 5], [11, 5]], done: true, winner: 0 };

const CASOS = {
  'sets del ganador en un grupo': { ...base, groupMatches: [{ ...partido, sets1: CODIGO }], elimRounds: [] },
  'sets del perdedor en un grupo': { ...base, groupMatches: [{ ...partido, sets2: CODIGO }], elimRounds: [] },
  'puntos de un set en un grupo': { ...base, groupMatches: [{ ...partido, setScores: [[CODIGO, 5]] }], elimRounds: [] },
  'sets en el cuadro': { ...base, groupMatches: [], elimRounds: [[{ ...llave, sets1: CODIGO }]] },
  'puntos de un set en el cuadro': { ...base, groupMatches: [], elimRounds: [[{ ...llave, setScores: [[5, CODIGO]] }]] },
  'sets en la ronda previa': { ...base, groupMatches: [], elimRounds: [], prelimMatches: [{ ...llave, sets2: CODIGO }] },
  'puntos de un set en la ronda previa': { ...base, groupMatches: [], elimRounds: [], prelimMatches: [{ ...llave, setScores: [[CODIGO, 5]] }] },
  'nombres en el cuadro y el podio': {
    ...base, groupMatches: [],
    elimRounds: [[{ ...llave, p1name: CODIGO }]],
    prelimDirect: [{ id: 0 }], prelimMatches: [{ ...llave, p2name: CODIGO }], podio: [CODIGO],
  },
};

test.describe('Link compartido manipulado', () => {
  for (const [nombre, datos] of Object.entries(CASOS)) {
    test(`no ejecuta código puesto en: ${nombre}`, async ({ page }) => {
      await page.goto('/public.html');
      const hash = await page.evaluate(d => encodeShare(d), datos);
      const pub = await page.context().newPage();
      const errores = capturarErrores(pub);
      await pub.goto('/public.html#' + hash);
      await expect(pub.locator('#pub-name')).toHaveText('Copa');

      // Recorre todas las pestañas: cada una dibuja datos distintos del link.
      for (const pestana of await pub.locator('.gtab').all()) {
        await pestana.click();
        await expect(pub.locator('#pub-content img')).toHaveCount(0);
      }
      expect(await pub.evaluate(() => window.__xss)).toBeUndefined();
      expect(errores).toEqual([]);
    });
  }

  test('un link normal se sigue viendo igual', async ({ page }) => {
    await page.goto('/public.html');
    const hash = await page.evaluate(d => encodeShare(d), { ...base, groupMatches: [partido], elimRounds: [[llave]], prelimMatches: [llave] });
    await page.goto('/public.html#' + hash);
    await page.reload();
    await expect(page.locator('.match-row .match-score').first()).toHaveText('2');
    await expect(page.locator('.match-detail').first()).toHaveText('11-5 | 11-5');
    await expect(page.locator('.gplayer').nth(1)).toContainText('2-0');
    await page.click('.gtab:has-text("Eliminatoria")');
    await expect(page.locator('.elim-sets').first()).toHaveText('2');
    await expect(page.locator('.elim-detail').first()).toHaveText('11-5 | 11-5');
  });
});
