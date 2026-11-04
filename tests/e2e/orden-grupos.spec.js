const { test, expect } = require('@playwright/test');
const { abrirApp } = require('./helpers');

test('el calendario de grupo sigue el método Berger y no repite jugadores por fecha', async ({ page }) => {
  await abrirApp(page);
  const matches = await page.evaluate(() => generarCalendarioGrupo([0, 1, 2, 3], 0));
  expect(matches.map(m => [m.round, m.p1, m.p2])).toEqual([
    [1, 0, 3], [1, 1, 2],
    [2, 0, 2], [2, 3, 1],
    [3, 0, 1], [3, 2, 3],
  ]);
  for (const round of [1, 2, 3]) {
    const players = matches.filter(m => m.round === round).flatMap(m => [m.p1, m.p2]);
    expect(new Set(players).size).toBe(4);
  }
});

test('con número impar rota el descanso y conserva todos los cruces', async ({ page }) => {
  await abrirApp(page);
  const matches = await page.evaluate(() => generarCalendarioGrupo([0, 1, 2], 0));
  expect(matches).toHaveLength(3);
  expect(new Set(matches.map(m => [m.p1, m.p2].sort().join('-'))).size).toBe(3);
});
