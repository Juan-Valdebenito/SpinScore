const { test, expect } = require('@playwright/test');

test('al cerrar el aviso de instalación no vuelve a mostrarse en visitas posteriores', async ({ page }) => {
  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator('#install-banner')).toBeVisible({ timeout: 3_000 });
  await page.locator('.install-close').click();
  await expect(page.locator('#install-banner')).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('spinscore_install_prompt_dismissed')))
    .toBe('true');

  await page.reload();
  await page.waitForTimeout(1_700);
  await expect(page.locator('#install-banner')).toBeHidden();
});
