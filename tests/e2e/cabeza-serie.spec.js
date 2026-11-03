const { test, expect } = require('@playwright/test');
const { abrirApp, capturarErrores, armarTorneo, cargarResultado, jugarEliminatoria, crucesMismoGrupoEnPrimeraRonda } = require('./helpers');

/** Marcas de la tabla de cada grupo: '1*' clasifica, '3 P' va a la ronda previa. */
async function marcasDeGrupos(page) {
  return page.evaluate(() => GT.groups.map((_, gi) => {
    goTo('screen-groups-main'); switchGroupTab(gi);
    return [...document.querySelectorAll('#groups-main-content .group-player:not(.group-table-head) .group-player-num')].map(e => e.textContent.trim());
  }));
}

test.describe('Modo cabeza de serie y ronda previa', () => {
  let errores;
  test.beforeEach(async ({ page }) => { errores = capturarErrores(page); await abrirApp(page); });
  test.afterEach(() => expect(errores).toEqual([]));

  test('grupos de 4: clasifican 1.° y 2.°, el 3.° va a la ronda previa y el 4.° queda fuera', async ({ page }) => {
    await armarTorneo(page, { jugadores: 16, grupos: 4, cabezaDeSerie: true });
    for (const marcas of await marcasDeGrupos(page)) expect(marcas).toEqual(['1*', '2*', '3 P', '4']);
  });

  test('grupos de 5: pasan los 3 primeros y no hay ronda previa', async ({ page }) => {
    await armarTorneo(page, { jugadores: 10, grupos: 2, cabezaDeSerie: true });
    for (const marcas of await marcasDeGrupos(page)) expect(marcas).toEqual(['1*', '2*', '3*', '4', '5']);
  });

  test('sin el modo, el máximo sigue siendo 4 por grupo', async ({ page }) => {
    await page.click('.home-row:has-text("Grupos + eliminación")');
    await page.click('#chips-groups [data-val="2"]');
    await expect(page.locator('#gp-max')).toHaveText('8');
    await page.click('#seed-mode-toggle');
    await expect(page.locator('#gp-max')).toHaveText('10');
  });

  test('ronda previa → el cuadro se arma al terminarla, con los ganadores y sin cruces del mismo grupo', async ({ page }) => {
    await armarTorneo(page, { jugadores: 16, grupos: 4, cabezaDeSerie: true });
    await page.evaluate(() => iniciarEliminacion());
    await expect(page.locator('#elim-content')).toContainText('Ronda previa');
    expect(await page.evaluate(() => ({ previa: GT.prelimMatches.length, cuadro: GT.elimRounds.length }))).toEqual({ previa: 2, cuadro: 0 });

    await cargarResultado(page, 'previa', 0, [[11, 6], [11, 6]]);
    await cargarResultado(page, 'previa', 1, [[11, 6], [11, 6]]);
    await expect(page.locator('#toast')).toHaveText('Ronda previa terminada · se armó el cuadro');
    const cuadro = await page.evaluate(() => ({
      jugadores: GT.elimRounds[0].flatMap(m => [m.p1, m.p2]).filter(x => x !== null).length,
      cupos: GT.elimRounds[0].length * 2,
      byes: GT.elimRounds[0].filter(m => m.bye).length,
    }));
    expect(cuadro).toEqual({ jugadores: 10, cupos: 16, byes: 6 });
    expect(await crucesMismoGrupoEnPrimeraRonda(page)).toBe(0);
    await expect(page.locator('#elim-content .previa-section')).toContainText('Sus ganadores ya están en el cuadro');
  });

  test('corregir el ganador de la previa con el cuadro en juego pide confirmación y rearma el cuadro', async ({ page }) => {
    await armarTorneo(page, { jugadores: 16, grupos: 4, cabezaDeSerie: true });
    await page.evaluate(() => iniciarEliminacion());
    await cargarResultado(page, 'previa', 0, [[11, 6], [11, 6]]);
    await cargarResultado(page, 'previa', 1, [[11, 6], [11, 6]]);
    const jugable = await page.evaluate(() => GT.elimRounds[0].findIndex(m => !m.done));
    await cargarResultado(page, 'elim', { ri: 0, mi: jugable }, [[11, 6], [11, 6]]);

    await cargarResultado(page, 'previa', 0, [[6, 11], [6, 11]]);              // cambia el ganador
    await expect(page.locator('.ss-dialog-msg')).toContainText('borra sus 1 resultado');
    await page.click('.ss-dialog-ok');
    await expect(page.locator('#toast')).toHaveText('Ganador corregido · se rearmó el cuadro');
    const estado = await page.evaluate(() => ({
      jugados: GT.elimRounds.flat().filter(m => m.done && !m.bye).length,
      nuevoDentro: GT.elimRounds[0].some(m => m.p1 === GT.prelimMatches[0].winner || m.p2 === GT.prelimMatches[0].winner),
    }));
    expect(estado).toEqual({ jugados: 0, nuevoDentro: true });
  });

  test('grupos de 4 y 3: el cuadro se arma y se juega hasta la final (antes la app fallaba)', async ({ page }) => {
    for (let k = 0; k < 4; k++) {
      await page.evaluate(() => localStorage.clear());
      await armarTorneo(page, { jugadores: 7, grupos: 2, cabezaDeSerie: true });
      await page.evaluate(() => iniciarEliminacion());
      await jugarEliminatoria(page);
      expect(await page.evaluate(() => GT.elimRounds.at(-1)[0].done)).toBe(true);
      await page.evaluate(() => document.getElementById('podio-screen').classList.remove('show'));
    }
  });

  test('2 grupos de 2: el ganador de la previa no repite cruce con el 1.° de su grupo', async ({ page }) => {
    for (const ganaP1 of [true, false]) {
      await page.evaluate(() => localStorage.clear());
      await armarTorneo(page, { jugadores: 4, grupos: 2, cabezaDeSerie: true });
      await page.evaluate(() => iniciarEliminacion());
      await cargarResultado(page, 'previa', 0, ganaP1 ? [[11, 6], [11, 6]] : [[6, 11], [6, 11]]);
      expect(await crucesMismoGrupoEnPrimeraRonda(page)).toBe(0);
    }
  });
});
