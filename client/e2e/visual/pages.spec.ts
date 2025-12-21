/**
 * Visual Regression Tests using Playwright
 *
 * These tests capture screenshots and compare them against baseline images
 * to detect visual regressions.
 *
 * Usage:
 *   npx playwright test e2e/visual/
 *   npx playwright test e2e/visual/ --update-snapshots
 *
 * Configuration:
 *   - Screenshots are stored in e2e/visual/screenshots/
 *   - Baseline images are in e2e/visual/screenshots/baseline/
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Helper function to wait for page to be stable
async function waitForPageStable(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for any animations to complete
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════
// Login Page Visual Tests
// ═══════════════════════════════════════════
test.describe('Login Page', () => {
  test('should match login page screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match login page with error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForPageStable(page);

    // Fill in invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('.error-message, .alert-error, [role="alert"]', {
      timeout: 5000,
    }).catch(() => {});

    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('login-page-error.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match login page mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/login`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('login-page-mobile.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });
});

// ═══════════════════════════════════════════
// Dashboard Visual Tests
// ═══════════════════════════════════════════
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  });

  test('should match dashboard screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      threshold: 0.2, // Slightly higher threshold for dynamic content
    });
  });

  test('should match dashboard sidebar collapsed', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);

    // Click sidebar toggle if exists
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"], .sidebar-toggle');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await waitForPageStable(page);
    }

    await expect(page).toHaveScreenshot('dashboard-sidebar-collapsed.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});

// ═══════════════════════════════════════════
// Bot List Visual Tests
// ═══════════════════════════════════════════
test.describe('Bot List', () => {
  test.beforeEach(async ({ page }) => {
    // Setup auth cookie/token
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
  });

  test('should match bot list page', async ({ page }) => {
    await page.goto(`${BASE_URL}/bots`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('bot-list.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should match empty bot list', async ({ page }) => {
    // Use a user with no bots
    await page.goto(`${BASE_URL}/bots`);
    await waitForPageStable(page);

    // Check for empty state
    const emptyState = page.locator('.empty-state, [data-testid="empty-bots"]');
    if (await emptyState.isVisible()) {
      await expect(page).toHaveScreenshot('bot-list-empty.png', {
        fullPage: true,
        threshold: 0.1,
      });
    }
  });

  test('should match bot card component', async ({ page }) => {
    await page.goto(`${BASE_URL}/bots`);
    await waitForPageStable(page);

    const botCard = page.locator('.bot-card, [data-testid="bot-card"]').first();
    if (await botCard.isVisible()) {
      await expect(botCard).toHaveScreenshot('bot-card.png', {
        threshold: 0.1,
      });
    }
  });
});

// ═══════════════════════════════════════════
// Settings Page Visual Tests
// ═══════════════════════════════════════════
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
  });

  test('should match settings page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('settings.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match profile settings tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/profile`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('settings-profile.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match billing settings tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/billing`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('settings-billing.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });
});

// ═══════════════════════════════════════════
// Component Visual Tests
// ═══════════════════════════════════════════
test.describe('Components', () => {
  test('should match modal component', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);

    // Open a modal (e.g., create bot modal)
    const createButton = page.locator('[data-testid="create-bot"], .create-bot-btn');
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForSelector('.modal, [role="dialog"]', { timeout: 5000 });
      await waitForPageStable(page);

      const modal = page.locator('.modal, [role="dialog"]');
      await expect(modal).toHaveScreenshot('modal-component.png', {
        threshold: 0.1,
      });
    }
  });

  test('should match dropdown component', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);

    // Open user dropdown
    const userMenu = page.locator('[data-testid="user-menu"], .user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('dropdown-open.png', {
        clip: {
          x: 0,
          y: 0,
          width: 400,
          height: 300,
        },
        threshold: 0.1,
      });
    }
  });
});

// ═══════════════════════════════════════════
// Dark Mode Visual Tests
// ═══════════════════════════════════════════
test.describe('Dark Mode', () => {
  test('should match login page in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${BASE_URL}/login`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('login-dark-mode.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match dashboard in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});
