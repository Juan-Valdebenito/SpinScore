const { test, expect } = require('@playwright/test');
const { abrirApp, capturarErrores, armarTorneo, cargarResultado, jugarEliminatoria, crucesMismoGrupoEnPrimeraRonda } = require('./helpers');

test.describe('Torneo por grupos + eliminatoria', () => {
  test('el botón del resultado cambia según si el partido es nuevo o se está corrigiendo', async ({ page }) => {
    await abrirApp(page);
    await armarTorneo(page, { jugadores: 4, grupos: 2 });
    const guardar = page.locator('#result-save-btn');

    // Corregir: ya no se ofrece el marcador en vivo y guardar es la acción principal.
    await page.evaluate(() => abrirResultado(0, 'group'));
    await expect(guardar).toHaveText('Guardar corrección');
    await expect(guardar).toHaveClass(/btn-primary/);
    await expect(page.locator('#result-live-btn')).toBeHidden();
    await page.evaluate(() => document.querySelectorAll('#result-sets-container .set-input').forEach(el => {
      if (el.value === '5') el.value = '7';
    }));
    await guardar.click();
    await expect.poll(() => page.evaluate(() => GT.groupMatches[0].setScores.flat().includes(7))).toBe(true);

    // Partido nuevo: el marcador en vivo es lo principal y el ingreso manual, la alternativa.
    await page.evaluate(() => { iniciarEliminacion(); abrirResultadoElim(0, 0); });
    await expect(guardar).toHaveText('Ingresar resultado manualmente');
    await expect(guardar).toHaveClass(/btn-ghost/);
    await expect(page.locator('#result-live-btn')).toBeVisible();
  });

  let errores;
  test.beforeEach(async ({ page }) => { errores = capturarErrores(page); await abrirApp(page); });
  test.afterEach(() => expect(errores).toEqual([]));

  test('no deja sortear con menos de 2 jugadores por grupo', async ({ page }) => {
    await page.click('.home-row:has-text("Grupos + eliminación")');
    await page.click('#chips-groups [data-val="6"]');
    for (let i = 0; i < 11; i++) { await page.fill('#gp-input', 'J' + i); await page.press('#gp-input', 'Enter'); }
    await expect(page.locator('#btn-sortear')).toBeDisabled();
    await page.fill('#gp-input', 'J11'); await page.press('#gp-input', 'Enter');
    await expect(page.locator('#btn-sortear')).toBeEnabled();
  });

  test('6 grupos: cuadro de 16 con 4 BYE, sin cruces del mismo grupo, jugado hasta el podio', async ({ page }) => {
    await armarTorneo(page, { jugadores: 12, grupos: 6 });
    await page.evaluate(() => iniciarEliminacion());
    const cuadro = await page.evaluate(() => ({ cupos: GT.elimRounds[0].length * 2, byes: GT.elimRounds[0].filter(m => m.bye).length }));
    expect(cuadro).toEqual({ cupos: 16, byes: 4 });
    expect(await crucesMismoGrupoEnPrimeraRonda(page)).toBe(0);

    await jugarEliminatoria(page);
    await expect(page.locator('#podio-screen')).toHaveClass(/show/);
    await expect(page.locator('#podio-cards .podio-label')).toHaveText(['1° Lugar', '2° Lugar', '3° Lugar', '3° Lugar']);
    expect(await page.evaluate(() => storageGetAll()[0].status)).toBe('finished');
  });

  test('rechaza un set imposible (15-3 a 11 puntos)', async ({ page }) => {
    await armarTorneo(page, { jugadores: 4, grupos: 2 });
    await cargarResultado(page, 'group', 0, [[15, 3], [11, 0]]);
    await expect(page.locator('#toast')).toContainText('Set inválido');
    await expect(page.locator('#screen-result-entry')).toBeVisible();
  });

  test('el torneo se guarda al confirmar y los resultados de la eliminatoria persisten al recargar', async ({ page }) => {
    await armarTorneo(page, { jugadores: 8, grupos: 4, nombre: 'Copa Primavera' });
    await page.evaluate(() => iniciarEliminacion());
    await cargarResultado(page, 'elim', { ri: 0, mi: 0 }, [[11, 7], [11, 7]]);
    await page.reload();
    await expect(page.locator('#home-active-torneos')).toContainText('Copa Primavera');
    await page.click('.active-torneo-btn:has-text("Copa Primavera")');
    expect(await page.evaluate(() => GT.elimRounds[0][0].done)).toBe(true);
  });

  test('corregir un resultado del cuadro cambiando el ganador reabre los partidos que dependían de él', async ({ page }) => {
    await armarTorneo(page, { jugadores: 8, grupos: 4 });
    await page.evaluate(() => iniciarEliminacion());
    await jugarEliminatoria(page);
    await page.evaluate(() => document.getElementById('podio-screen').classList.remove('show'));

    await cargarResultado(page, 'elim', { ri: 0, mi: 1 }, [[5, 11], [5, 11]]);   // cambia el ganador de un cuarto
    await expect(page.locator('.ss-dialog-msg')).toContainText('Semifinal');
    await expect(page.locator('.ss-dialog-msg')).toContainText('Final');

    await page.click('.ss-dialog-cancel');                                       // cancelar no cambia nada
    expect(await page.evaluate(() => GT.elimRounds[2][0].done)).toBe(true);

    await expect(page.locator('#result-save-btn')).toHaveText('Guardar corrección');
    await page.click('#result-save-btn');                                     // ahora sí guarda la corrección
    await page.click('.ss-dialog-ok');
    await expect(page.locator('#toast')).toHaveText('Ganador corregido · el torneo vuelve a estar en curso');
    const estado = await page.evaluate(() => ({ semi: GT.elimRounds[1][0].done, final: GT.elimRounds[2][0].done, status: storageGetAll()[0].status }));
    expect(estado).toEqual({ semi: false, final: false, status: 'active' });
  });
});
