import { test, expect } from '@playwright/test';

test.describe('Billing Page', () => {

  test('billing redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/billing');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});
