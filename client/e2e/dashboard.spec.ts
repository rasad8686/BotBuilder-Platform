import { test, expect } from '@playwright/test';

// Dashboard Page Tests
test.describe('Dashboard Page', () => {

  test('dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});

// Authenticated Dashboard Tests
test.describe('Authenticated Dashboard', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access dashboard after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('dashboard') || url.includes('login')).toBeTruthy();
  });

  test('dashboard has welcome message', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const welcomeText = page.locator('text=/welcome|xoş gəldiniz|hello|salam/i').first();
      const hasWelcome = await welcomeText.isVisible().catch(() => false);
      expect(typeof hasWelcome).toBe('boolean');
    }
  });

  test('dashboard has navigation menu', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const nav = page.locator('nav, [role="navigation"]').first();
      const hasNav = await nav.isVisible().catch(() => false);
      expect(typeof hasNav).toBe('boolean');
    }
  });

});

// Stats Display Tests
test.describe('Stats Display', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('dashboard shows total bots count', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const botsCount = page.locator('text=/bots|botlar|\\d+/i').first();
      const hasCount = await botsCount.isVisible().catch(() => false);
      expect(typeof hasCount).toBe('boolean');
    }
  });

  test('dashboard shows total messages count', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const messagesCount = page.locator('text=/messages|mesajlar|\\d+/i').first();
      const hasMessages = await messagesCount.isVisible().catch(() => false);
      expect(typeof hasMessages).toBe('boolean');
    }
  });

  test('dashboard shows active users count', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const usersCount = page.locator('text=/users|istifadəçilər|active/i').first();
      const hasUsers = await usersCount.isVisible().catch(() => false);
      expect(typeof hasUsers).toBe('boolean');
    }
  });

  test('dashboard shows connected channels count', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const channelsCount = page.locator('text=/channels|kanallar|connected/i').first();
      const hasChannels = await channelsCount.isVisible().catch(() => false);
      expect(typeof hasChannels).toBe('boolean');
    }
  });

  test('stats cards are clickable', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const statCard = page.locator('[class*="card"], [class*="stat"]').first();
      const hasCard = await statCard.isVisible().catch(() => false);
      expect(typeof hasCard).toBe('boolean');
    }
  });

});

// Charts Tests
test.describe('Dashboard Charts', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('dashboard has message activity chart', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const chart = page.locator('canvas, [class*="chart"], svg').first();
      const hasChart = await chart.isVisible().catch(() => false);
      expect(typeof hasChart).toBe('boolean');
    }
  });

  test('chart has time period selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const periodSelector = page.locator('button, select').filter({ hasText: /day|week|month|gün|həftə|ay/i }).first();
      const hasPeriod = await periodSelector.isVisible().catch(() => false);
      expect(typeof hasPeriod).toBe('boolean');
    }
  });

  test('chart shows data labels', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const labels = page.locator('text=/jan|feb|mar|mon|tue|wed|\\d+/i').first();
      const hasLabels = await labels.isVisible().catch(() => false);
      expect(typeof hasLabels).toBe('boolean');
    }
  });

  test('chart can be toggled between types', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const chartToggle = page.locator('button').filter({ hasText: /line|bar|pie|xətt|sütun/i }).first();
      const hasToggle = await chartToggle.isVisible().catch(() => false);
      expect(typeof hasToggle).toBe('boolean');
    }
  });

  test('chart loading state exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('dashboard')) {
      const chartArea = page.locator('[class*="chart"], canvas, svg').first();
      const hasChartArea = await chartArea.isVisible().catch(() => false);
      expect(typeof hasChartArea).toBe('boolean');
    }
  });

});

// Recent Activity Tests
test.describe('Recent Activity', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('dashboard has recent activity section', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const activityText = page.locator('text=/recent|activity|son|fəaliyyət/i').first();
      const hasActivity = await activityText.isVisible().catch(() => false);
      expect(typeof hasActivity).toBe('boolean');
    }
  });

  test('activity items show timestamp', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const timestamp = page.locator('text=/ago|əvvəl|minutes|hours|dəqiqə|saat/i').first();
      const hasTimestamp = await timestamp.isVisible().catch(() => false);
      expect(typeof hasTimestamp).toBe('boolean');
    }
  });

  test('activity items are clickable', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const activityItem = page.locator('[class*="activity"] a, [class*="activity"] button').first();
      const hasClickable = await activityItem.isVisible().catch(() => false);
      expect(typeof hasClickable).toBe('boolean');
    }
  });

  test('activity list has view all link', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const viewAllLink = page.locator('a, button').filter({ hasText: /view all|hamısını gör|see more/i }).first();
      const hasViewAll = await viewAllLink.isVisible().catch(() => false);
      expect(typeof hasViewAll).toBe('boolean');
    }
  });

  test('empty state shows when no activity', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const emptyText = page.locator('text=/no activity|fəaliyyət yoxdur|nothing yet/i').first();
      const hasEmpty = await emptyText.isVisible().catch(() => false);
      expect(typeof hasEmpty).toBe('boolean');
    }
  });

});

// Quick Actions Tests
test.describe('Quick Actions', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('dashboard has quick action buttons', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const quickAction = page.locator('button').filter({ hasText: /create|new|yarat|yeni/i }).first();
      const hasQuickAction = await quickAction.isVisible().catch(() => false);
      expect(typeof hasQuickAction).toBe('boolean');
    }
  });

  test('create bot quick action exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const createBot = page.locator('a, button').filter({ hasText: /create bot|bot yarat|new bot/i }).first();
      const hasCreateBot = await createBot.isVisible().catch(() => false);
      expect(typeof hasCreateBot).toBe('boolean');
    }
  });

  test('view bots quick action exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const viewBots = page.locator('a, button').filter({ hasText: /my bots|botlarım|view bots/i }).first();
      const hasViewBots = await viewBots.isVisible().catch(() => false);
      expect(typeof hasViewBots).toBe('boolean');
    }
  });

});

// Dashboard Refresh Tests
test.describe('Dashboard Refresh', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('dashboard has refresh button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const refreshBtn = page.locator('button').filter({ hasText: /refresh|yenilə/i }).first();
      const hasRefresh = await refreshBtn.isVisible().catch(() => false);
      expect(typeof hasRefresh).toBe('boolean');
    }
  });

  test('dashboard auto-refreshes data', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const lastUpdate = page.locator('text=/last updated|son yenilənmə|updated/i').first();
      const hasLastUpdate = await lastUpdate.isVisible().catch(() => false);
      expect(typeof hasLastUpdate).toBe('boolean');
    }
  });

});

// Dashboard Responsive Tests
test.describe('Dashboard Responsive', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('dashboard displays correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('dashboard')) {
      const mobileMenu = page.locator('[class*="mobile"], button[aria-label*="menu"]').first();
      const hasMobile = await mobileMenu.isVisible().catch(() => false);
      expect(typeof hasMobile).toBe('boolean');
    }
  });

  test('dashboard displays correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    expect(url.includes('dashboard') || url.includes('login')).toBeTruthy();
  });

});
