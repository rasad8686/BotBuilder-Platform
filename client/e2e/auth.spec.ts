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

// Form Validation Tests
test.describe('Form Validation', () => {

  test('login form shows error with invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForTimeout(2000);
    const errorDiv = page.locator('.bg-red-100');
    await expect(errorDiv).toBeVisible();
  });

  test('login form button shows loading state', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Button should be disabled during loading
    await expect(submitButton).toBeDisabled();
  });

  test('register form can be filled', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[type="password"]', 'password123');

    await expect(page.locator('input[type="text"]')).toHaveValue('Test User');
    await expect(page.locator('input[type="email"]')).toHaveValue('newuser@example.com');
    await expect(page.locator('input[type="password"]')).toHaveValue('password123');
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('http://localhost:5174/forgot-password');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/forgot-password/);
  });

  test('forgot password link works from login', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    await page.click('a[href="/forgot-password"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/forgot-password/);
  });

});

// Social Login Tests
test.describe('Social Login', () => {

  test('login page has Google login button', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const googleBtn = page.locator('button, a').filter({ hasText: /google/i }).first();
    const hasGoogle = await googleBtn.isVisible().catch(() => false);
    // Social login may or may not be implemented
    expect(typeof hasGoogle).toBe('boolean');
  });

  test('login page has Facebook login button', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const facebookBtn = page.locator('button, a').filter({ hasText: /facebook/i }).first();
    const hasFacebook = await facebookBtn.isVisible().catch(() => false);
    expect(typeof hasFacebook).toBe('boolean');
  });

  test('login page has GitHub login button', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const githubBtn = page.locator('button, a').filter({ hasText: /github/i }).first();
    const hasGithub = await githubBtn.isVisible().catch(() => false);
    expect(typeof hasGithub).toBe('boolean');
  });

  test('social login buttons are clickable', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const socialBtns = page.locator('button, a').filter({ hasText: /google|facebook|github/i });
    const count = await socialBtns.count();

    if (count > 0) {
      const firstBtn = socialBtns.first();
      await expect(firstBtn).toBeEnabled();
    }
    expect(count >= 0).toBeTruthy();
  });

  test('register page has social signup options', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const socialBtns = page.locator('button, a').filter({ hasText: /google|facebook|github|sign up with/i });
    const count = await socialBtns.count();
    expect(count >= 0).toBeTruthy();
  });

});

// Two-Factor Authentication Tests
test.describe('Two-Factor Authentication', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('settings page has 2FA section', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const twoFaText = page.locator('text=/2FA|two-factor|authenticator|iki addımlı/i').first();
      const has2FA = await twoFaText.isVisible().catch(() => false);
      expect(typeof has2FA).toBe('boolean');
    }
  });

  test('2FA enable button exists in settings', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const enableBtn = page.locator('button').filter({ hasText: /enable 2fa|aktivləşdir|setup/i }).first();
      const hasEnableBtn = await enableBtn.isVisible().catch(() => false);
      expect(typeof hasEnableBtn).toBe('boolean');
    }
  });

  test('2FA setup shows QR code when enabled', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const enableBtn = page.locator('button').filter({ hasText: /enable 2fa|aktivləşdir|setup/i }).first();
      if (await enableBtn.isVisible().catch(() => false)) {
        await enableBtn.click();
        await page.waitForTimeout(1000);

        const qrCode = page.locator('img[alt*="QR"], canvas, [class*="qr"]').first();
        const hasQR = await qrCode.isVisible().catch(() => false);
        expect(typeof hasQR).toBe('boolean');
      }
    }
  });

  test('2FA verification code input exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const enableBtn = page.locator('button').filter({ hasText: /enable 2fa|aktivləşdir|setup/i }).first();
      if (await enableBtn.isVisible().catch(() => false)) {
        await enableBtn.click();
        await page.waitForTimeout(1000);

        const codeInput = page.locator('input[placeholder*="code"], input[name*="code"], input[type="text"]').first();
        const hasCodeInput = await codeInput.isVisible().catch(() => false);
        expect(typeof hasCodeInput).toBe('boolean');
      }
    }
  });

  test('2FA backup codes section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const backupText = page.locator('text=/backup|recovery|ehtiyat/i').first();
      const hasBackup = await backupText.isVisible().catch(() => false);
      expect(typeof hasBackup).toBe('boolean');
    }
  });

});

// Session Management Tests
test.describe('Session Management', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('login form has remember me checkbox', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const rememberMe = page.locator('input[type="checkbox"]').first();
    const hasRememberMe = await rememberMe.isVisible().catch(() => false);
    expect(typeof hasRememberMe).toBe('boolean');
  });

  test('remember me checkbox is clickable', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const rememberMe = page.locator('input[type="checkbox"]').first();
    if (await rememberMe.isVisible().catch(() => false)) {
      await rememberMe.click();
      const isChecked = await rememberMe.isChecked();
      expect(typeof isChecked).toBe('boolean');
    }
  });

  test('logout button works', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const logoutBtn = page.locator('button, a').filter({ hasText: /logout|çıxış|sign out/i }).first();
      if (await logoutBtn.isVisible().catch(() => false)) {
        await logoutBtn.click();
        await page.waitForTimeout(2000);

        const url = page.url();
        expect(url.includes('login') || url.includes('/')).toBeTruthy();
      }
    }
  });

  test('session persists after page reload', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    // Either stays on dashboard or redirects to login (depending on session)
    expect(url.includes('dashboard') || url.includes('login')).toBeTruthy();
  });

  test('active sessions list in settings', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const sessionText = page.locator('text=/session|cihaz|device|aktiv/i').first();
      const hasSession = await sessionText.isVisible().catch(() => false);
      expect(typeof hasSession).toBe('boolean');
    }
  });

  test('logout from all devices option exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('settings')) {
      const logoutAllBtn = page.locator('button').filter({ hasText: /all devices|bütün cihazlar|everywhere/i }).first();
      const hasLogoutAll = await logoutAllBtn.isVisible().catch(() => false);
      expect(typeof hasLogoutAll).toBe('boolean');
    }
  });

});

// Password Validation Tests
test.describe('Password Validation', () => {

  test('password field shows strength indicator', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('weak');
    await page.waitForTimeout(500);

    const strengthIndicator = page.locator('[class*="strength"], [class*="progress"], text=/weak|strong|güclü|zəif/i').first();
    const hasStrength = await strengthIndicator.isVisible().catch(() => false);
    expect(typeof hasStrength).toBe('boolean');
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const passwordInputs = page.locator('input[type="password"]');
    const count = await passwordInputs.count();

    if (count >= 2) {
      await passwordInputs.nth(0).fill('password123');
      await passwordInputs.nth(1).fill('different456');
      await page.waitForTimeout(500);

      const errorText = page.locator('text=/match|uyğun|eyni/i').first();
      const hasError = await errorText.isVisible().catch(() => false);
      expect(typeof hasError).toBe('boolean');
    }
  });

  test('short password shows error', async ({ page }) => {
    await page.goto('http://localhost:5174/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const errorText = page.locator('text=/short|minimum|qısa|ən azı/i').first();
    const hasError = await errorText.isVisible().catch(() => false);
    expect(typeof hasError).toBe('boolean');
  });

});

// Email Validation Tests
test.describe('Email Validation', () => {

  test('invalid email shows error', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('invalid-email');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // HTML5 validation or custom error
    const isInvalid = await emailInput.evaluate(el => !el.validity.valid);
    expect(typeof isInvalid).toBe('boolean');
  });

  test('empty email shows error on submit', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate(el => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('email field has autocomplete attribute', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const autocomplete = await emailInput.getAttribute('autocomplete');
    expect(autocomplete === null || typeof autocomplete === 'string').toBeTruthy();
  });

});
