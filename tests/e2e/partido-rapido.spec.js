const { test, expect } = require('@playwright/test');
const { abrirApp, capturarErrores } = require('./helpers');

test.describe('Partido rápido (marcador en vivo)', () => {
  let errores;
  test.beforeEach(async ({ page }) => {
    errores = capturarErrores(page);
    await abrirApp(page);
    await page.click('.home-play');
    await page.fill('#qs-p1', 'Ana Pérez');
    await page.fill('#qs-p2', 'Beto');
  });
  test.afterEach(() => expect(errores).toEqual([]));

  test('sumar puntos, cerrar un set y deshacer el punto que lo cerró', async ({ page }) => {
    await page.click('text=Iniciar Partido');
    for (let i = 0; i < 11; i++) await page.click('#score-p1-btn');
    await expect(page.locator('#score-p1-sets')).toHaveText('1');
    await expect(page.locator('#set-dots')).toContainText('11-0');
    await expect(page.locator('#undo-detail')).toHaveText('punto de Ana');

    await page.click('#btn-undo-main');
    await expect(page.locator('#score-p1-sets')).toHaveText('0');
    await expect(page.locator('#score-p1-pts')).toHaveText('10');
    await expect(page.locator('#toast')).toHaveText('Deshecho: punto de Ana');
  });

  test('tarjeta roja da el punto al rival y deshacer la revierte', async ({ page }) => {
    await page.click('text=Iniciar Partido');
    await page.click('#card-btn-r-0');
    await page.click('#card-modal-confirm');
    await expect(page.locator('#score-p2-pts')).toHaveText('1');
    await expect(page.locator('#card-r-0')).toHaveText('1');

    await page.click('#btn-undo-main');
    await expect(page.locator('#score-p2-pts')).toHaveText('0');
    await expect(page.locator('#card-r-0')).toBeHidden();
  });

  test('elegir quién saca primero y cambio de saque cada 2 puntos', async ({ page }) => {
    await page.click('#qs-serve [data-val="1"]');
    await page.click('text=Iniciar Partido');
    await expect(page.locator('#score-p2-name')).toHaveClass(/serving/);
    await page.click('#score-p1-btn');
    await page.click('#score-p1-btn');
    await expect(page.locator('#score-p1-name')).toHaveClass(/serving/);
    await expect(page.locator('#btn-swap-serve')).toBeHidden();   // solo antes del primer punto
  });

  test('el partido se puede reanudar después de recargar la página', async ({ page }) => {
    await page.click('text=Iniciar Partido');
    for (let i = 0; i < 4; i++) await page.click('#score-p1-btn');
    await page.reload();
    await expect(page.locator('#home-active-torneos')).toContainText('Partido en vivo');
    await page.click('.active-torneo-btn:has-text("Ana Pérez vs Beto")');
    await expect(page.locator('#score-p1-pts')).toHaveText('4');
  });

  test('pantalla de ganador, deshacer desde ella y terminar', async ({ page }) => {
    await page.click('text=Iniciar Partido');   // al mejor de 3 sets
    for (let i = 0; i < 22; i++) await page.click('#score-p1-btn');
    await expect(page.locator('#win-screen')).toHaveClass(/show/);
    await expect(page.locator('#win-name')).toHaveText('Ana Pérez');

    await page.click('#win-screen >> text=Deshacer último punto');
    await expect(page.locator('#win-screen')).not.toHaveClass(/show/);
    await expect(page.locator('#score-p1-pts')).toHaveText('10');

    await page.click('#score-p1-btn');
    await page.click('#win-screen >> text=Continuar');
    expect(await page.evaluate(() => localStorage.getItem('spinscore_live_match'))).toBeNull();
  });
});
