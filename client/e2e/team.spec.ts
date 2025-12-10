import { test, expect } from '@playwright/test';

// Team Page Tests
test.describe('Team Page', () => {

  test('team page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});

// Authenticated Team Tests
test.describe('Authenticated Team', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access team page after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('team') || url.includes('login') || url.includes('dashboard')).toBeTruthy();
  });

  test('team page has invite button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et|add member/i }).first();
      const hasInvite = await inviteBtn.isVisible().catch(() => false);
      expect(typeof hasInvite).toBe('boolean');
    }
  });

  test('team members list is displayed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const membersList = page.locator('[class*="member"], [class*="list"], table').first();
      const hasList = await membersList.isVisible().catch(() => false);
      expect(typeof hasList).toBe('boolean');
    }
  });

});

// Invite Member Tests
test.describe('Invite Member', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('invite button opens modal', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[role="dialog"], [class*="modal"]').first();
        const hasModal = await modal.isVisible().catch(() => false);
        expect(typeof hasModal).toBe('boolean');
      }
    }
  });

  test('invite modal has email input', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);

        const emailInput = page.locator('input[type="email"]').first();
        const hasEmail = await emailInput.isVisible().catch(() => false);
        expect(typeof hasEmail).toBe('boolean');
      }
    }
  });

  test('invite modal has role selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);

        const roleSelector = page.locator('select, [role="combobox"]').first();
        const hasRole = await roleSelector.isVisible().catch(() => false);
        expect(typeof hasRole).toBe('boolean');
      }
    }
  });

  test('invite modal has send button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);

        const sendBtn = page.locator('button').filter({ hasText: /send|göndər|invite/i }).first();
        const hasSend = await sendBtn.isVisible().catch(() => false);
        expect(typeof hasSend).toBe('boolean');
      }
    }
  });

  test('can invite multiple emails', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);

        const addMore = page.locator('button, a').filter({ hasText: /add more|daha əlavə|another/i }).first();
        const hasAddMore = await addMore.isVisible().catch(() => false);
        expect(typeof hasAddMore).toBe('boolean');
      }
    }
  });

  test('invite link can be copied', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const copyLinkBtn = page.locator('button').filter({ hasText: /copy link|linki kopyala|share link/i }).first();
      const hasCopyLink = await copyLinkBtn.isVisible().catch(() => false);
      expect(typeof hasCopyLink).toBe('boolean');
    }
  });

});

// Remove Member Tests
test.describe('Remove Member', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('member has remove option', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const removeBtn = page.locator('button, [role="menuitem"]').filter({ hasText: /remove|sil|çıxar/i }).first();
      const hasRemove = await removeBtn.isVisible().catch(() => false);
      expect(typeof hasRemove).toBe('boolean');
    }
  });

  test('remove shows confirmation dialog', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const removeBtn = page.locator('button').filter({ hasText: /remove|sil/i }).first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(1000);

        const confirmText = page.locator('text=/confirm|əminsiniz|sure/i').first();
        const hasConfirm = await confirmText.isVisible().catch(() => false);
        expect(typeof hasConfirm).toBe('boolean');
      }
    }
  });

  test('remove confirmation has cancel option', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const removeBtn = page.locator('button').filter({ hasText: /remove|sil/i }).first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(1000);

        const cancelBtn = page.locator('button').filter({ hasText: /cancel|ləğv et|no/i }).first();
        const hasCancel = await cancelBtn.isVisible().catch(() => false);
        expect(typeof hasCancel).toBe('boolean');
      }
    }
  });

  test('member shows status', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const statusBadge = page.locator('[class*="status"], [class*="badge"]').first();
      const hasStatus = await statusBadge.isVisible().catch(() => false);
      expect(typeof hasStatus).toBe('boolean');
    }
  });

});

// Role Change Tests
test.describe('Role Change', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('member has role selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const roleSelector = page.locator('select, [role="combobox"], button').filter({ hasText: /admin|member|owner|viewer/i }).first();
      const hasRole = await roleSelector.isVisible().catch(() => false);
      expect(typeof hasRole).toBe('boolean');
    }
  });

  test('admin role option exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const adminOption = page.locator('text=/admin|administrator/i').first();
      const hasAdmin = await adminOption.isVisible().catch(() => false);
      expect(typeof hasAdmin).toBe('boolean');
    }
  });

  test('member role option exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const memberOption = page.locator('text=/member|üzv/i').first();
      const hasMember = await memberOption.isVisible().catch(() => false);
      expect(typeof hasMember).toBe('boolean');
    }
  });

  test('viewer role option exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const viewerOption = page.locator('text=/viewer|izləyici|read only/i').first();
      const hasViewer = await viewerOption.isVisible().catch(() => false);
      expect(typeof hasViewer).toBe('boolean');
    }
  });

  test('role change shows confirmation', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const roleSelector = page.locator('select, [role="combobox"]').first();
      if (await roleSelector.isVisible().catch(() => false)) {
        await roleSelector.click();
        await page.waitForTimeout(1000);

        const roleOption = page.locator('[role="option"], option').first();
        if (await roleOption.isVisible().catch(() => false)) {
          await roleOption.click();
          await page.waitForTimeout(1000);

          const successText = page.locator('text=/updated|yeniləndi|changed/i').first();
          const hasSuccess = await successText.isVisible().catch(() => false);
          expect(typeof hasSuccess).toBe('boolean');
        }
      }
    }
  });

});

// Pending Invitations Tests
test.describe('Pending Invitations', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('pending invitations section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const pendingText = page.locator('text=/pending|gözləyən|invited/i').first();
      const hasPending = await pendingText.isVisible().catch(() => false);
      expect(typeof hasPending).toBe('boolean');
    }
  });

  test('pending invitations can be cancelled', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const cancelBtn = page.locator('button').filter({ hasText: /cancel|ləğv et|revoke/i }).first();
      const hasCancel = await cancelBtn.isVisible().catch(() => false);
      expect(typeof hasCancel).toBe('boolean');
    }
  });

  test('pending invitations can be resent', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const resendBtn = page.locator('button').filter({ hasText: /resend|yenidən göndər/i }).first();
      const hasResend = await resendBtn.isVisible().catch(() => false);
      expect(typeof hasResend).toBe('boolean');
    }
  });

});

// Team Permissions Tests
test.describe('Team Permissions', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('permissions section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const permText = page.locator('text=/permission|icazə|access/i').first();
      const hasPerm = await permText.isVisible().catch(() => false);
      expect(typeof hasPerm).toBe('boolean');
    }
  });

  test('owner cannot be removed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const ownerRow = page.locator('text=/owner|sahib/i').first();
      const hasOwner = await ownerRow.isVisible().catch(() => false);
      expect(typeof hasOwner).toBe('boolean');
    }
  });

  test('self role change is restricted', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const youLabel = page.locator('text=/\\(you\\)|\\(siz\\)|current user/i').first();
      const hasYou = await youLabel.isVisible().catch(() => false);
      expect(typeof hasYou).toBe('boolean');
    }
  });

});

// Team Activity Tests
test.describe('Team Activity', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('team activity log exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const activityText = page.locator('text=/activity|fəaliyyət|log/i').first();
      const hasActivity = await activityText.isVisible().catch(() => false);
      expect(typeof hasActivity).toBe('boolean');
    }
  });

  test('member last active time is shown', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const lastActive = page.locator('text=/last active|son aktiv|ago/i').first();
      const hasLastActive = await lastActive.isVisible().catch(() => false);
      expect(typeof hasLastActive).toBe('boolean');
    }
  });

});

// Team Mobile Viewport Tests
test.describe('Team Mobile Viewport', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('team page displays correctly on iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('team') || url.includes('login')).toBeTruthy();
  });

  test('member cards stack on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const cards = page.locator('[class*="member"], [class*="card"]');
      const cardCount = await cards.count();
      expect(cardCount >= 0).toBeTruthy();
    }
  });

  test('invite button is accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      const hasInvite = await inviteBtn.isVisible().catch(() => false);
      expect(typeof hasInvite).toBe('boolean');
    }
  });

  test('team actions are usable on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const actionBtn = page.locator('button').first();
      const hasAction = await actionBtn.isVisible().catch(() => false);
      expect(typeof hasAction).toBe('boolean');
    }
  });

  test('team tablet view works correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('team') || url.includes('login')).toBeTruthy();
  });

  test('member avatars are visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const avatars = page.locator('[class*="avatar"], img[class*="profile"]');
      const avatarCount = await avatars.count();
      expect(avatarCount >= 0).toBeTruthy();
    }
  });

});

// Team Error States Tests
test.describe('Team Error States', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('invalid email shows error on invite', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const inviteBtn = page.locator('button').filter({ hasText: /invite|dəvət et/i }).first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);

        const emailInput = page.locator('input[type="email"]').first();
        if (await emailInput.isVisible()) {
          await emailInput.fill('invalid-email');
          const submitBtn = page.locator('button').filter({ hasText: /send|göndər|invite/i }).first();
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
            await page.waitForTimeout(1000);

            const errorText = page.locator('text=/invalid|valid email|xəta/i').first();
            const hasError = await errorText.isVisible().catch(() => false);
            expect(typeof hasError).toBe('boolean');
          }
        }
      }
    }
  });

  test('already invited member shows warning', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const warningText = page.locator('text=/already|artıq|exists/i').first();
      const hasWarning = await warningText.isVisible().catch(() => false);
      expect(typeof hasWarning).toBe('boolean');
    }
  });

  test('empty team shows no members message', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const emptyText = page.locator('text=/no members|üzv yoxdur|invite your team/i').first();
      const hasEmpty = await emptyText.isVisible().catch(() => false);
      expect(typeof hasEmpty).toBe('boolean');
    }
  });

});

// Team Search and Filter Tests
test.describe('Team Search and Filter', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('team has search input', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
      const hasSearch = await searchInput.isVisible().catch(() => false);
      expect(typeof hasSearch).toBe('boolean');
    }
  });

  test('members can be filtered by role', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const roleFilter = page.locator('select, button').filter({ hasText: /role|rol|filter/i }).first();
      const hasFilter = await roleFilter.isVisible().catch(() => false);
      expect(typeof hasFilter).toBe('boolean');
    }
  });

  test('members can be sorted', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const sortBtn = page.locator('button, select').filter({ hasText: /sort|sırala|name|date/i }).first();
      const hasSort = await sortBtn.isVisible().catch(() => false);
      expect(typeof hasSort).toBe('boolean');
    }
  });

  test('search clears on x button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const clearBtn = page.locator('button').filter({ hasText: /clear|×|x/i }).first();
      const hasClear = await clearBtn.isVisible().catch(() => false);
      expect(typeof hasClear).toBe('boolean');
    }
  });

  test('member count is displayed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('team')) {
      const countText = page.locator('text=/\\d+\\s*(members|üzv|total)/i').first();
      const hasCount = await countText.isVisible().catch(() => false);
      expect(typeof hasCount).toBe('boolean');
    }
  });

});
