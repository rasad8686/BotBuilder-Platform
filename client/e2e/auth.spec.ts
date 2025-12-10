import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {

  test('login page loads', async ({ page }) => {
    await page.goto('http://localhost:5174/login');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check h1 exists with BotBuilder text
    const heading = page.locator('h1');
    await expect(heading).toContainText('BotBuilder');
  });

  test('login page has email input', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('login page has password input', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('login page has submit button', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('login page has register link', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
  });

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const forgotLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading).toContainText('BotBuilder');
  });

  test('register page has name input', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('input[type="text"]');
    await expect(nameInput).toBeVisible();
  });

  test('register page has email input', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('register page has password input', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('register page has login link', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test('can navigate from login to register', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    await page.click('a[href="/register"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/register/);
  });

  test('can navigate from register to login', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    await page.click('a[href="/login"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

  test('can type in login form', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    await expect(page.locator('input[type="email"]')).toHaveValue('test@example.com');
    await expect(page.locator('input[type="password"]')).toHaveValue('password123');
  });

  test('landing page loads', async ({ page }) => {
    await page.goto('http://localhost:5174/');
    await page.waitForLoadState('networkidle');

    // Landing page should load without error
    await expect(page).toHaveURL('http://localhost:5174/');
  });

});
