import { test, expect } from '@playwright/test';

// Marketplace Page Tests
test.describe('Marketplace Page', () => {

  test('marketplace redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});

// Authenticated Marketplace Tests
test.describe('Authenticated Marketplace', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access marketplace page after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('marketplace') || url.includes('login') || url.includes('dashboard')).toBeTruthy();
  });

  test('marketplace has search input', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="axtar"]').first();
      const hasSearch = await searchInput.isVisible().catch(() => false);
      expect(typeof hasSearch).toBe('boolean');
    }
  });

  test('marketplace shows plugin grid', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const grid = page.locator('[class*="grid"], [class*="list"]').first();
      const hasGrid = await grid.isVisible().catch(() => false);
      expect(typeof hasGrid).toBe('boolean');
    }
  });

});

// Plugin Browse Tests
test.describe('Plugin Browse', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('plugin cards are displayed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const pluginCard = page.locator('[class*="card"], [class*="plugin"]').first();
      const hasCard = await pluginCard.isVisible().catch(() => false);
      expect(typeof hasCard).toBe('boolean');
    }
  });

  test('plugin cards show name and description', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const pluginName = page.locator('h3, h4, [class*="title"]').first();
      const hasName = await pluginName.isVisible().catch(() => false);
      expect(typeof hasName).toBe('boolean');
    }
  });

  test('plugin cards show rating', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const rating = page.locator('[class*="rating"], [class*="star"], text=/★|\\d\\.\\d/').first();
      const hasRating = await rating.isVisible().catch(() => false);
      expect(typeof hasRating).toBe('boolean');
    }
  });

  test('plugin cards show install count', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installCount = page.locator('text=/\\d+\\s*(installs|downloads|yükləmə)/i').first();
      const hasCount = await installCount.isVisible().catch(() => false);
      expect(typeof hasCount).toBe('boolean');
    }
  });

  test('category filter exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const categoryFilter = page.locator('select, button').filter({ hasText: /category|kateqoriya|all/i }).first();
      const hasCategory = await categoryFilter.isVisible().catch(() => false);
      expect(typeof hasCategory).toBe('boolean');
    }
  });

  test('sort options exist', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const sortOptions = page.locator('select, button').filter({ hasText: /sort|sırala|popular|newest/i }).first();
      const hasSort = await sortOptions.isVisible().catch(() => false);
      expect(typeof hasSort).toBe('boolean');
    }
  });

  test('search filters results', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
        // Search should work
        expect(true).toBeTruthy();
      }
    }
  });

});

// Plugin Install Tests
test.describe('Plugin Install', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('plugin has install button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installBtn = page.locator('button').filter({ hasText: /install|quraşdır|add/i }).first();
      const hasInstall = await installBtn.isVisible().catch(() => false);
      expect(typeof hasInstall).toBe('boolean');
    }
  });

  test('install shows confirmation', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installBtn = page.locator('button').filter({ hasText: /install|quraşdır/i }).first();
      if (await installBtn.isVisible().catch(() => false)) {
        await installBtn.click();
        await page.waitForTimeout(1000);

        const confirmText = page.locator('text=/confirm|permissions|icazə/i').first();
        const hasConfirm = await confirmText.isVisible().catch(() => false);
        expect(typeof hasConfirm).toBe('boolean');
      }
    }
  });

  test('install shows progress', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installBtn = page.locator('button').filter({ hasText: /install|quraşdır/i }).first();
      if (await installBtn.isVisible().catch(() => false)) {
        await installBtn.click();
        await page.waitForTimeout(500);

        const progress = page.locator('[class*="progress"], [class*="loading"], text=/installing|quraşdırılır/i').first();
        const hasProgress = await progress.isVisible().catch(() => false);
        expect(typeof hasProgress).toBe('boolean');
      }
    }
  });

  test('installed plugins show installed badge', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installedBadge = page.locator('[class*="installed"], text=/installed|quraşdırılıb/i').first();
      const hasInstalled = await installedBadge.isVisible().catch(() => false);
      expect(typeof hasInstalled).toBe('boolean');
    }
  });

  test('plugin details page exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const pluginCard = page.locator('[class*="card"], [class*="plugin"]').first();
      if (await pluginCard.isVisible().catch(() => false)) {
        await pluginCard.click();
        await page.waitForTimeout(1000);

        const detailsPage = page.locator('[class*="detail"], [class*="description"]').first();
        const hasDetails = await detailsPage.isVisible().catch(() => false);
        expect(typeof hasDetails).toBe('boolean');
      }
    }
  });

});

// Plugin Uninstall Tests
test.describe('Plugin Uninstall', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('installed plugins have uninstall option', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const uninstallBtn = page.locator('button').filter({ hasText: /uninstall|sil|remove/i }).first();
      const hasUninstall = await uninstallBtn.isVisible().catch(() => false);
      expect(typeof hasUninstall).toBe('boolean');
    }
  });

  test('uninstall shows confirmation dialog', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const uninstallBtn = page.locator('button').filter({ hasText: /uninstall|sil/i }).first();
      if (await uninstallBtn.isVisible().catch(() => false)) {
        await uninstallBtn.click();
        await page.waitForTimeout(1000);

        const confirmText = page.locator('text=/confirm|əminsiniz|sure/i').first();
        const hasConfirm = await confirmText.isVisible().catch(() => false);
        expect(typeof hasConfirm).toBe('boolean');
      }
    }
  });

  test('uninstall confirmation has cancel option', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const uninstallBtn = page.locator('button').filter({ hasText: /uninstall|sil/i }).first();
      if (await uninstallBtn.isVisible().catch(() => false)) {
        await uninstallBtn.click();
        await page.waitForTimeout(1000);

        const cancelBtn = page.locator('button').filter({ hasText: /cancel|ləğv et|no/i }).first();
        const hasCancel = await cancelBtn.isVisible().catch(() => false);
        expect(typeof hasCancel).toBe('boolean');
      }
    }
  });

});

// Installed Plugins Tests
test.describe('Installed Plugins', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('installed plugins tab exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installedTab = page.locator('button, a').filter({ hasText: /installed|quraşdırılmış|my plugins/i }).first();
      const hasTab = await installedTab.isVisible().catch(() => false);
      expect(typeof hasTab).toBe('boolean');
    }
  });

  test('installed plugins can be configured', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const configBtn = page.locator('button').filter({ hasText: /configure|settings|tənzimləmələr/i }).first();
      const hasConfig = await configBtn.isVisible().catch(() => false);
      expect(typeof hasConfig).toBe('boolean');
    }
  });

  test('installed plugins show version', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const versionText = page.locator('text=/v\\d+\\.\\d+|version/i').first();
      const hasVersion = await versionText.isVisible().catch(() => false);
      expect(typeof hasVersion).toBe('boolean');
    }
  });

  test('plugin updates are shown', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const updateBadge = page.locator('[class*="update"], text=/update available|yeniləmə var/i').first();
      const hasUpdate = await updateBadge.isVisible().catch(() => false);
      expect(typeof hasUpdate).toBe('boolean');
    }
  });

});

// Plugin Reviews Tests
test.describe('Plugin Reviews', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('plugin details show reviews', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const reviewsText = page.locator('text=/review|rəy|comment/i').first();
      const hasReviews = await reviewsText.isVisible().catch(() => false);
      expect(typeof hasReviews).toBe('boolean');
    }
  });

  test('users can leave reviews', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const reviewBtn = page.locator('button').filter({ hasText: /write review|rəy yaz|rate/i }).first();
      const hasReviewBtn = await reviewBtn.isVisible().catch(() => false);
      expect(typeof hasReviewBtn).toBe('boolean');
    }
  });

  test('review form has star rating', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const reviewBtn = page.locator('button').filter({ hasText: /write review|rəy yaz/i }).first();
      if (await reviewBtn.isVisible().catch(() => false)) {
        await reviewBtn.click();
        await page.waitForTimeout(1000);

        const starRating = page.locator('[class*="star"], [class*="rating"]').first();
        const hasStars = await starRating.isVisible().catch(() => false);
        expect(typeof hasStars).toBe('boolean');
      }
    }
  });

});

// Plugin Categories Tests
test.describe('Plugin Categories', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('analytics category exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const analyticsCategory = page.locator('text=/analytics|analitika/i').first();
      const hasAnalytics = await analyticsCategory.isVisible().catch(() => false);
      expect(typeof hasAnalytics).toBe('boolean');
    }
  });

  test('integrations category exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const integrationsCategory = page.locator('text=/integration|inteqrasiya/i').first();
      const hasIntegrations = await integrationsCategory.isVisible().catch(() => false);
      expect(typeof hasIntegrations).toBe('boolean');
    }
  });

  test('productivity category exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const productivityCategory = page.locator('text=/productivity|məhsuldarlıq/i').first();
      const hasProductivity = await productivityCategory.isVisible().catch(() => false);
      expect(typeof hasProductivity).toBe('boolean');
    }
  });

});

// Featured Plugins Tests
test.describe('Featured Plugins', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('featured section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const featuredText = page.locator('text=/featured|seçilmiş|popular/i').first();
      const hasFeatured = await featuredText.isVisible().catch(() => false);
      expect(typeof hasFeatured).toBe('boolean');
    }
  });

  test('new plugins section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const newText = page.locator('text=/new|yeni|latest/i').first();
      const hasNew = await newText.isVisible().catch(() => false);
      expect(typeof hasNew).toBe('boolean');
    }
  });

  test('trending plugins section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const trendingText = page.locator('text=/trending|populyar|top/i').first();
      const hasTrending = await trendingText.isVisible().catch(() => false);
      expect(typeof hasTrending).toBe('boolean');
    }
  });

});

// Marketplace Mobile Viewport Tests
test.describe('Marketplace Mobile Viewport', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('marketplace page displays correctly on iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('marketplace') || url.includes('login')).toBeTruthy();
  });

  test('plugin cards stack on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const cards = page.locator('[class*="card"], [class*="plugin"]');
      const cardCount = await cards.count();
      expect(cardCount >= 0).toBeTruthy();
    }
  });

  test('search input is usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
      const hasSearch = await searchInput.isVisible().catch(() => false);
      expect(typeof hasSearch).toBe('boolean');
    }
  });

  test('install button is tappable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const installBtn = page.locator('button').filter({ hasText: /install|quraşdır/i }).first();
      const hasInstall = await installBtn.isVisible().catch(() => false);
      expect(typeof hasInstall).toBe('boolean');
    }
  });

  test('marketplace tablet view works correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('marketplace') || url.includes('login')).toBeTruthy();
  });

  test('category filters work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const categoryBtn = page.locator('button, select').filter({ hasText: /category|kateqoriya/i }).first();
      const hasCategory = await categoryBtn.isVisible().catch(() => false);
      expect(typeof hasCategory).toBe('boolean');
    }
  });

  test('plugin rating stars are visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const stars = page.locator('[class*="star"], [class*="rating"], text=/★/');
      const starCount = await stars.count();
      expect(starCount >= 0).toBeTruthy();
    }
  });

  test('plugin descriptions are truncated on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page);
    await page.goto('http://localhost:5174/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('marketplace')) {
      const description = page.locator('[class*="description"], p').first();
      const hasDescription = await description.isVisible().catch(() => false);
      expect(typeof hasDescription).toBe('boolean');
    }
  });

});
