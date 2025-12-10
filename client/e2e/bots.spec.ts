import { test, expect } from '@playwright/test';

test.describe('Protected Routes', () => {

  test('mybots redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/mybots');
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('dashboard redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

  test('create-bot redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/create-bot');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});
