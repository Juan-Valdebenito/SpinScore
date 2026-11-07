const { test, expect } = require('@playwright/test');
const { abrirApp, capturarErrores, armarTorneo, jugarEliminatoria } = require('./helpers');

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

// Datos que la app nunca genera y que antes rompían la página.
const DANADOS = {
  'sin jugadores': { name: 'Copa', groups: [] },
  'sin grupos': { name: 'Copa', players: ['Ana'] },
  'partido vacío': { ...base, groupMatches: [null] },
  'jugador inexistente': { ...base, groups: [[0, 99]] },
  'set mal formado': { ...base, groupMatches: [{ ...partido, setScores: [null] }] },
  'cuadro mal formado': { ...base, elimRounds: [null] },
  'sets con texto': { ...base, groupMatches: [{ ...partido, sets1: CODIGO }] },
  'no es un torneo': [1, 2, 3],
};

test.describe('Link compartido manipulado', () => {
  for (const [nombre, datos] of Object.entries(CASOS)) {
    test(`no ejecuta código puesto en: ${nombre}`, async ({ page }) => {
      const pub = page;
      const errores = capturarErrores(pub);
      await pub.goto('/public.html');
      // Dibuja sin pasar por la validación del link: el escape debe proteger por sí solo.
      await pub.evaluate(d => { data = d; fromLink = true; render(); }, datos);
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

  for (const [nombre, datos] of Object.entries(DANADOS)) {
    test(`avisa que el link está dañado: ${nombre}`, async ({ page }) => {
      const errores = capturarErrores(page);
      await page.goto('/public.html');
      const hash = await page.evaluate(d => encodeShare(d), datos);
      await page.goto('/public.html#' + hash);
      await page.reload();
      await expect(page.locator('#pub-name')).toHaveText('Torneo no encontrado');
      await expect(page.locator('#pub-content')).toContainText('incompleto o dañado');
      expect(errores).toEqual([]);
    });
  }

  test('un link que no se puede leer también avisa', async ({ page }) => {
    const errores = capturarErrores(page);
    await page.goto('/public.html#zEstoNoEsUnLink');
    await expect(page.locator('#pub-content')).toContainText('incompleto o dañado');
    expect(errores).toEqual([]);
  });

  test('un torneo guardado dañado no rompe la página y se muestra el que está bien', async ({ page }) => {
    const errores = capturarErrores(page);
    await page.goto('/public.html');
    await page.evaluate(d => localStorage.setItem('spinscore_torneos', JSON.stringify([null, { id: 'T1', status: 'active' }, d])),
      { ...base, id: 'T2', status: 'active', groupMatches: [partido], elimRounds: [] });
    await page.reload();
    await expect(page.locator('#pub-name')).toHaveText('Copa');

    await page.evaluate(() => localStorage.setItem('spinscore_torneos', '{"a":1}'));
    await page.reload();
    await expect(page.locator('#pub-name')).toHaveText('Torneo no encontrado');
    expect(errores).toEqual([]);
  });

  test('acepta un torneo real con W.O., retiro y cuadro completo', async ({ page }) => {
    await abrirApp(page);
    await armarTorneo(page, { jugadores: 8, grupos: 2 });
    await page.evaluate(async () => {
      const especial = async (i, tipo) => {
        abrirResultado(i, 'group');
        const accion = declararResultadoEspecial(tipo, 0);
        document.querySelector('.ss-dialog-ok').click();
        await accion;
      };
      await especial(0, 'walkover');
      await especial(1, 'retired');
      iniciarEliminacion();
    });
    await jugarEliminatoria(page);
    expect(await page.evaluate(() => GT.groupMatches.filter(m => m.resultType).length)).toBe(2);
    expect(await page.evaluate(() => torneoPublicoValido(_publicPayload(GT)))).toBe(true);
  });

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
