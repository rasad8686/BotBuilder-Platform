import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {

  test('settings redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});
