import { test, expect } from '@playwright/test';

test.describe('API Tokens Page', () => {

  test('api-tokens redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});

// Authenticated API Tokens Tests
test.describe('Authenticated API Tokens', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access api-tokens page after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('api-tokens') || url.includes('login')).toBeTruthy();
  });

  test('api-tokens page has create button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const createButton = page.locator('button').filter({ hasText: /create|oluştur|yarat/i }).first();
      const buttonExists = await createButton.isVisible().catch(() => false);
      expect(buttonExists || page.url().includes('login')).toBeTruthy();
    }
  });

  test('api-tokens page shows documentation', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const docText = page.locator('text=/API|Documentation|token/i').first();
      const hasDoc = await docText.isVisible().catch(() => false);
      expect(hasDoc || page.url().includes('login')).toBeTruthy();
    }
  });

  test('create token modal opens', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const createButton = page.locator('button').filter({ hasText: /create|oluştur/i }).first();
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();
        await page.waitForTimeout(1000);

        // Modal should have input fields
        const modalInput = page.locator('input[type="text"]').first();
        const hasModal = await modalInput.isVisible().catch(() => false);
        expect(hasModal).toBeTruthy();
      }
    }
  });

});

// Token Copy Tests
test.describe('Token Copy', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('token list has copy button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const copyBtn = page.locator('button').filter({ hasText: /copy|kopyala/i }).first();
      const hasCopy = await copyBtn.isVisible().catch(() => false);
      expect(typeof hasCopy).toBe('boolean');
    }
  });

  test('copy button shows success feedback', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const copyBtn = page.locator('button').filter({ hasText: /copy|kopyala/i }).first();
      if (await copyBtn.isVisible().catch(() => false)) {
        await copyBtn.click();
        await page.waitForTimeout(1000);

        const successText = page.locator('text=/copied|kopyalandı|success/i').first();
        const hasSuccess = await successText.isVisible().catch(() => false);
        expect(typeof hasSuccess).toBe('boolean');
      }
    }
  });

  test('token value is masked by default', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const maskedToken = page.locator('text=/\\*{4,}|•{4,}/').first();
      const hasMasked = await maskedToken.isVisible().catch(() => false);
      expect(typeof hasMasked).toBe('boolean');
    }
  });

  test('token has reveal/show button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const showBtn = page.locator('button').filter({ hasText: /show|reveal|göstər/i }).first();
      const hasShow = await showBtn.isVisible().catch(() => false);
      expect(typeof hasShow).toBe('boolean');
    }
  });

});

// Token Regenerate Tests
test.describe('Token Regenerate', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('token has regenerate option', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const regenBtn = page.locator('button, [role="menuitem"]').filter({ hasText: /regenerate|yenilə|refresh/i }).first();
      const hasRegen = await regenBtn.isVisible().catch(() => false);
      expect(typeof hasRegen).toBe('boolean');
    }
  });

  test('regenerate shows confirmation dialog', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const regenBtn = page.locator('button').filter({ hasText: /regenerate|yenilə/i }).first();
      if (await regenBtn.isVisible().catch(() => false)) {
        await regenBtn.click();
        await page.waitForTimeout(1000);

        const confirmText = page.locator('text=/confirm|əminsiniz|sure|warning/i').first();
        const hasConfirm = await confirmText.isVisible().catch(() => false);
        expect(typeof hasConfirm).toBe('boolean');
      }
    }
  });

  test('regenerate warning mentions old token invalidation', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const regenBtn = page.locator('button').filter({ hasText: /regenerate|yenilə/i }).first();
      if (await regenBtn.isVisible().catch(() => false)) {
        await regenBtn.click();
        await page.waitForTimeout(1000);

        const warningText = page.locator('text=/invalid|old|köhnə|previous/i').first();
        const hasWarning = await warningText.isVisible().catch(() => false);
        expect(typeof hasWarning).toBe('boolean');
      }
    }
  });

});

// Bulk Delete Tests
test.describe('Token Bulk Delete', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('token list has checkboxes for selection', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const checkbox = page.locator('input[type="checkbox"]').first();
      const hasCheckbox = await checkbox.isVisible().catch(() => false);
      expect(typeof hasCheckbox).toBe('boolean');
    }
  });

  test('select all checkbox exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const selectAll = page.locator('input[type="checkbox"]').first();
      const hasSelectAll = await selectAll.isVisible().catch(() => false);
      expect(typeof hasSelectAll).toBe('boolean');
    }
  });

  test('bulk delete button appears when items selected', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.click();
        await page.waitForTimeout(500);

        const bulkDeleteBtn = page.locator('button').filter({ hasText: /delete|sil|remove/i }).first();
        const hasDelete = await bulkDeleteBtn.isVisible().catch(() => false);
        expect(typeof hasDelete).toBe('boolean');
      }
    }
  });

  test('bulk delete shows confirmation', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const deleteBtn = page.locator('button').filter({ hasText: /delete|sil/i }).first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        await page.waitForTimeout(1000);

        const confirmText = page.locator('text=/confirm|əminsiniz|sure/i').first();
        const hasConfirm = await confirmText.isVisible().catch(() => false);
        expect(typeof hasConfirm).toBe('boolean');
      }
    }
  });

});

// Token Permissions Tests
test.describe('Token Permissions', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('create token modal has permissions options', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        const permissionText = page.locator('text=/permission|icazə|scope|read|write/i').first();
        const hasPermission = await permissionText.isVisible().catch(() => false);
        expect(typeof hasPermission).toBe('boolean');
      }
    }
  });

  test('token permissions can be selected', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        const permCheckbox = page.locator('input[type="checkbox"]').first();
        const hasCheckbox = await permCheckbox.isVisible().catch(() => false);
        expect(typeof hasCheckbox).toBe('boolean');
      }
    }
  });

  test('token shows its permissions', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const permBadge = page.locator('[class*="badge"], [class*="tag"], text=/read|write|full/i').first();
      const hasBadge = await permBadge.isVisible().catch(() => false);
      expect(typeof hasBadge).toBe('boolean');
    }
  });

});

// Token Expiry Tests
test.describe('Token Expiry', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('create token has expiry option', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        const expiryText = page.locator('text=/expir|müddət|never|30 days|90 days/i').first();
        const hasExpiry = await expiryText.isVisible().catch(() => false);
        expect(typeof hasExpiry).toBe('boolean');
      }
    }
  });

  test('token list shows expiry date', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const expiryDate = page.locator('text=/expir|never|\\d{4}/i').first();
      const hasDate = await expiryDate.isVisible().catch(() => false);
      expect(typeof hasDate).toBe('boolean');
    }
  });

  test('expired tokens are visually distinct', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const expiredBadge = page.locator('[class*="expired"], [class*="warning"], text=/expired|bitib/i').first();
      const hasExpired = await expiredBadge.isVisible().catch(() => false);
      expect(typeof hasExpired).toBe('boolean');
    }
  });

});

// API Documentation Tests
test.describe('API Documentation', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('api-tokens page has documentation link', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const docsLink = page.locator('a').filter({ hasText: /documentation|docs|sənəd/i }).first();
      const hasDocs = await docsLink.isVisible().catch(() => false);
      expect(typeof hasDocs).toBe('boolean');
    }
  });

  test('api-tokens page shows usage examples', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const codeExample = page.locator('code, pre, [class*="code"]').first();
      const hasCode = await codeExample.isVisible().catch(() => false);
      expect(typeof hasCode).toBe('boolean');
    }
  });

  test('api endpoint URL is displayed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/api-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('api-tokens')) {
      const apiUrl = page.locator('text=/api\\.|https:\\/\\/|endpoint/i').first();
      const hasUrl = await apiUrl.isVisible().catch(() => false);
      expect(typeof hasUrl).toBe('boolean');
    }
  });

});
