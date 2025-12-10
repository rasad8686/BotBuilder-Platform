import { test, expect } from '@playwright/test';

test.describe('Channels Page', () => {

  test('channels redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/channels');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});
