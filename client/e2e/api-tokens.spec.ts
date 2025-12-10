import { test, expect } from '@playwright/test';

test.describe('API Tokens Page', () => {

  test('api-tokens redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});
