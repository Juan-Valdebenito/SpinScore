const { test, expect } = require('@playwright/test');
const { abrirApp, capturarErrores, cargarResultado } = require('./helpers');

/** Registra un partido pendiente igual que el marcador al terminarlo (sin jugar punto a punto). */
async function jugarPartidoLiga(page, id, sets) {
  await page.evaluate(({ id, sets }) => {
    const s1 = sets.filter(([a, b]) => a > b).length;
    ligaRegistrarResultado(id, [s1, sets.length - s1], sets);
  }, { id, sets });
}

/** Crea una liga desde la pantalla de inscripción. */
async function crearLiga(page, nombre, jugadores) {
  await page.click('.home-row:has-text("Liga")');
  await page.fill('#t-name', nombre);
  for (const j of jugadores) {
    await page.fill('#t-player-input', j);
    await page.press('#t-player-input', 'Enter');
  }
  await page.click('#btn-start-tournament');
}

test.describe('Liga (todos contra todos)', () => {
  let errores;
  test.beforeEach(async ({ page }) => { errores = capturarErrores(page); await abrirApp(page); });
  test.afterEach(() => expect(errores).toEqual([]));

  test('jugar un partido con el marcador y que quede guardado al recargar', async ({ page }) => {
    await crearLiga(page, 'Liga del viernes', ['Ana', 'Beto', 'Caro']);
    await expect(page.locator('#t-header-progress')).toContainText('0/3 partidos');

    await page.locator('#bracket-content button.match-row').first().click();
    for (let i = 0; i < 22; i++) await page.click('#score-p1-btn');   // 2 sets a 11
    await page.click('#win-screen >> text=Continuar');
    await expect(page.locator('#t-header-progress')).toContainText('1/3 partidos');

    await page.reload();
    await expect(page.locator('#home-active-torneos')).toContainText('Liga · 1/3 partidos');
  });

  test('corregir un resultado actualiza la tabla y, si ya terminó, el podio', async ({ page }) => {
    await crearLiga(page, 'Liga test', ['Ana', 'Beto', 'Caro']);
    await jugarPartidoLiga(page, '0-1', [[11, 5], [11, 6]]);      // Ana - Beto
    await jugarPartidoLiga(page, '1-2', [[11, 9], [11, 7]]);      // Beto - Caro
    await jugarPartidoLiga(page, '0-2', [[11, 3], [11, 3]]);      // Ana - Caro → termina
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('podio-screen').classList.remove('show'));
    expect(await page.evaluate(() => LIGA.podio.slice(0, 3))).toEqual(['Ana', 'Beto', 'Caro']);

    await page.click('#bracket-content button.match-row.done:has-text("Beto"):has-text("Caro")');
    await expect(page.locator('#screen-result-entry')).toBeVisible();
    await cargarResultado(page, 'liga', '1-2', [[5, 11], [5, 11]]);      // ahora gana Caro
    await expect(page.locator('#toast')).toHaveText('Resultado corregido · podio actualizado');
    expect(await page.evaluate(() => LIGA.podio.slice(0, 3))).toEqual(['Ana', 'Caro', 'Beto']);
  });

  test('crear otra liga con un partido a medias pregunta y lo descarta; la anterior queda en Mis torneos', async ({ page }) => {
    await crearLiga(page, 'Liga A', ['Ana', 'Beto']);
    await jugarPartidoLiga(page, '0-1', [[11, 5], [11, 5]]);   // Liga A termina
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('podio-screen').classList.remove('show'));
    await page.click('#screen-tournament-bracket .btn-back');

    await crearLiga(page, 'Liga B', ['Caro', 'Dani', 'Eli']);
    await page.locator('#bracket-content button.match-row').first().click();
    await page.click('#score-p1-btn');                                     // partido a medias
    await page.evaluate(() => goTo('screen-home'));

    await page.click('.home-row:has-text("Liga")');
    await page.fill('#t-player-input', 'Fran'); await page.press('#t-player-input', 'Enter');
    await page.fill('#t-player-input', 'Gabi'); await page.press('#t-player-input', 'Enter');
    await page.click('#btn-start-tournament');
    await expect(page.locator('.ss-dialog-msg')).toContainText('El partido sin terminar Caro vs Dani se descartará');
    await page.click('.ss-dialog-ok');
    expect(await page.evaluate(() => localStorage.getItem('spinscore_live_match'))).toBeNull();

    await page.evaluate(() => goTo('screen-mis-torneos'));
    await expect(page.locator('#mis-torneos-content')).toContainText('Liga B');     // en curso, se puede continuar
    await expect(page.locator('#mis-torneos-content')).toContainText('Liga A');     // terminada, en el historial
  });

  test('un partido de una liga reemplazada no se guarda en la liga nueva', async ({ page }) => {
    await crearLiga(page, 'Liga vieja', ['Ana', 'Beto', 'Caro']);
    await page.locator('#bracket-content button.match-row').first().click();
    await page.click('#score-p1-btn');
    // Simula un partido guardado por una versión anterior (sin el id de la liga) y una liga nueva con otros jugadores
    await page.evaluate(async () => {
      const live = JSON.parse(localStorage.getItem('spinscore_live_match'));
      delete live.ligaId;
      liveMatchClear();
      _ligaDraft = ['Xavi', 'Yoli', 'Zoe']; await startTournament();
      localStorage.setItem('spinscore_live_match', JSON.stringify(live));
      resumeLiveMatch();
    });
    for (let i = 0; i < 21; i++) await page.click('#score-p1-btn');   // ya tenía 1 punto: 21 más cierran 2 sets a 11
    await page.click('#win-screen >> text=Continuar');
    await expect(page.locator('.ss-dialog-msg')).toContainText('El resultado no se guardó');
    expect(await page.evaluate(() => LIGA.matches.some(m => m.done))).toBe(false);
  });
});
