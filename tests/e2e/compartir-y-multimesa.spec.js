const { test, expect } = require('@playwright/test');
const { abrirApp, capturarErrores, armarTorneo, jugarEliminatoria } = require('./helpers');

test.describe('Link compartido (vista pública)', () => {
  test('se abre en otro dispositivo sin datos y no ejecuta nombres con código', async ({ page, browser }) => {
    const errores = capturarErrores(page);
    await abrirApp(page);
    const malicioso = '<img src=x onerror="window.__xss=1">';
    await armarTorneo(page, { jugadores: [malicioso, 'Ñandú', "O'Higgins", 'Dora'], grupos: 2, nombre: 'Copa <script>' });
    await page.evaluate(() => iniciarEliminacion());
    await jugarEliminatoria(page);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    // Captura el link que se copiaría al portapapeles
    const url = await page.evaluate(async () => {
      let copiado = null;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { copiado = t; } }, configurable: true });
      await compartirTorneo();
      return copiado;
    });
    expect(url).toMatch(/\/public\.html#z/);

    // Otro "dispositivo": contexto nuevo, sin localStorage
    const otro = await browser.newContext();
    const pub = await otro.newPage();
    const erroresPub = capturarErrores(pub);
    await pub.goto(url);
    await expect(pub.locator('#pub-name')).toHaveText('Copa <script>');
    await pub.click('.gtab:has-text("Eliminatoria")');
    await expect(pub.locator('#pub-content')).toContainText('Podio Final');
    expect(await pub.evaluate(() => window.__xss)).toBeUndefined();
    await otro.close();

    expect(errores).toEqual([]);
    expect(erroresPub).toEqual([]);
  });
});

test.describe('Multimesa', () => {
  test('crear una mesa, deshacer el punto que cerró un set y conservar la mesa al recargar', async ({ page }) => {
    const errores = capturarErrores(page);
    await abrirApp(page, '/multimesa.html');
    await page.click('text=+ Nueva mesa');
    await page.fill('#modal-p1', 'Ana');
    await page.fill('#modal-p2', 'Beto');
    await page.click('text=Crear Mesa');

    for (let i = 0; i < 11; i++) await page.click('.mesa-player.left');
    await expect(page.locator('.mesa-sets-count').first()).toHaveText('1');
    await page.click('.btn-undo-sm');
    await expect(page.locator('.mesa-big-score').first()).toHaveText('10');
    await expect(page.locator('.mesa-sets-count').first()).toHaveText('0');

    await page.reload();
    await expect(page.locator('.mesa-big-score').first()).toHaveText('10');
    await expect(page.locator('.mesa-player-name').first()).toContainText('Ana');
    expect(errores).toEqual([]);
  });
});
