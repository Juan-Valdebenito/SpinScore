const { test, expect } = require('@playwright/test');
const { capturarErrores } = require('./helpers');

const torneo = {
  name: 'Copa', phase: 'elimination', cfg: { sets: 3, pts: 11 }, players: ['Ana', 'Beto'], groups: [[0, 1]],
  groupMatches: [{ groupIdx: 0, p1: 0, p2: 1, sets1: 2, sets2: 0, setScores: [[11, 5], [11, 5]], done: true }],
  elimRounds: [[{ p1: 0, p2: 1, p1name: 'Ana', p2name: 'Beto', sets1: 2, sets2: 0, setScores: [[11, 5], [11, 5]], done: true, winner: 0 }]],
  podio: ['Ana', 'Beto'],
};

/** Abre el torneo por link y registra lo que la política de seguridad bloquee. */
async function abrirLink(page) {
  await page.addInitScript(() => {
    window.__bloqueos = [];
    document.addEventListener('securitypolicyviolation', e => window.__bloqueos.push(e.violatedDirective));
  });
  await page.goto('/public.html');
  const hash = await page.evaluate(d => encodeShare(d), torneo);
  await page.goto('/public.html#' + hash);
  await page.reload();
  await expect(page.locator('#pub-name')).toHaveText('Copa');
}

test.describe('Política de seguridad de la vista pública', () => {
  test('la página funciona completa sin que se bloquee nada propio', async ({ page }) => {
    const errores = capturarErrores(page);
    await abrirLink(page);
    for (const pestana of await page.locator('.gtab').all()) await pestana.click();
    await expect(page.locator('#pub-content')).toContainText('Podio Final');
    expect(await page.evaluate(() => window.__bloqueos)).toEqual([]);
    expect(errores).toEqual([]);
  });

  test('si se colara código en la página, el navegador no lo ejecuta', async ({ page }) => {
    await abrirLink(page);
    await page.evaluate(() => {
      document.getElementById('pub-content').innerHTML = '<img src="images/favicon-32.png?x" onload="window.__xss=1" onerror="window.__xss=1">';
    });
    await expect.poll(() => page.evaluate(() => window.__bloqueos.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('no permite enviar datos a otros sitios', async ({ page }) => {
    await abrirLink(page);
    const enviado = await page.evaluate(() => fetch('https://example.com/robo').then(() => true, () => false));
    expect(enviado).toBe(false);
    expect(await page.evaluate(() => window.__bloqueos)).toContain('connect-src');
  });
});

test.describe('Vista pública sin conexión', () => {
  test.use({ serviceWorkers: 'allow' });

  test('abre un link compartido sin internet', async ({ page, context }) => {
    await page.goto('/app.html');
    await page.evaluate(() => navigator.serviceWorker.ready);
    const hash = await page.evaluate(d => encodeShare(d), torneo);

    await context.setOffline(true);
    await page.goto('/public.html#' + hash);
    await expect(page.locator('#pub-name')).toHaveText('Copa');
    await page.click('.gtab:has-text("Eliminatoria")');
    await expect(page.locator('#pub-content')).toContainText('Podio Final');
  });
});
