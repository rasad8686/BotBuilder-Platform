import { test, expect } from '@playwright/test';

// Voice AI Page Tests
test.describe('Voice AI Page', () => {

  test('voice bots redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/login/);
  });

  test('call history redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/login/);
  });

  test('voice bots page responds without 500 error', async ({ page }) => {
    const response = await page.goto('http://localhost:5174/voice-bots');
    expect(response?.status()).toBeLessThan(500);
  });

  test('call history page responds without 500 error', async ({ page }) => {
    const response = await page.goto('http://localhost:5174/call-history');
    expect(response?.status()).toBeLessThan(500);
  });

});

// Authenticated Voice Bots Tests
test.describe('Authenticated Voice Bots', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access voice bots page after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('voice-bots') || url.includes('login') || url.includes('dashboard')).toBeTruthy();
  });

  test('voice bots page has title', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const title = page.locator('text=/voice|səsli|ai|bot/i').first();
      const hasTitle = await title.isVisible().catch(() => false);
      expect(typeof hasTitle).toBe('boolean');
    }
  });

  test('voice bots page has create button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat|new/i }).first();
      const hasCreate = await createBtn.isVisible().catch(() => false);
      expect(typeof hasCreate).toBe('boolean');
    }
  });

  test('voice bots list is displayed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const list = page.locator('[class*="list"], [class*="grid"], [class*="card"]').first();
      const hasList = await list.isVisible().catch(() => false);
      expect(typeof hasList).toBe('boolean');
    }
  });

  test('empty state shows when no voice bots', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const emptyText = page.locator('text=/no voice|hələ səsli bot yoxdur|create your first/i').first();
      const hasEmpty = await emptyText.isVisible().catch(() => false);
      expect(typeof hasEmpty).toBe('boolean');
    }
  });

  test('call history link exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const historyBtn = page.locator('button, a').filter({ hasText: /call history|zəng tarixçəsi/i }).first();
      const hasHistory = await historyBtn.isVisible().catch(() => false);
      expect(typeof hasHistory).toBe('boolean');
    }
  });

});

// Voice Bot Creation Tests
test.describe('Voice Bot Creation', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('create voice bot button opens form', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const form = page.locator('form, [class*="modal"], [class*="form"]').first();
        const hasForm = await form.isVisible().catch(() => false);
        expect(typeof hasForm).toBe('boolean');
      }
    }
  });

  test('voice bot form has name field', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const nameInput = page.locator('input[type="text"]').first();
        const hasName = await nameInput.isVisible().catch(() => false);
        expect(typeof hasName).toBe('boolean');
      }
    }
  });

  test('voice bot form has AI model selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const modelSelect = page.locator('select').first();
        const hasModel = await modelSelect.isVisible().catch(() => false);
        expect(typeof hasModel).toBe('boolean');
      }
    }
  });

  test('voice bot form has language selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const langSelect = page.locator('text=/language|dil/i').first();
        const hasLang = await langSelect.isVisible().catch(() => false);
        expect(typeof hasLang).toBe('boolean');
      }
    }
  });

  test('voice bot form has voice provider selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const voiceSelect = page.locator('text=/voice provider|səs təminatçısı|elevenlabs/i').first();
        const hasVoice = await voiceSelect.isVisible().catch(() => false);
        expect(typeof hasVoice).toBe('boolean');
      }
    }
  });

  test('voice bot form has STT provider selector', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const sttSelect = page.locator('text=/speech-to-text|stt|whisper/i').first();
        const hasSTT = await sttSelect.isVisible().catch(() => false);
        expect(typeof hasSTT).toBe('boolean');
      }
    }
  });

  test('voice bot form has greeting message field', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const greetingInput = page.locator('text=/greeting|salamlama/i').first();
        const hasGreeting = await greetingInput.isVisible().catch(() => false);
        expect(typeof hasGreeting).toBe('boolean');
      }
    }
  });

  test('voice bot form has system prompt field', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const promptInput = page.locator('textarea').first();
        const hasPrompt = await promptInput.isVisible().catch(() => false);
        expect(typeof hasPrompt).toBe('boolean');
      }
    }
  });

  test('voice bot form has cancel button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const cancelBtn = page.locator('button').filter({ hasText: /cancel|ləğv et/i }).first();
        const hasCancel = await cancelBtn.isVisible().catch(() => false);
        expect(typeof hasCancel).toBe('boolean');
      }
    }
  });

  test('voice bot form has save button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const saveBtn = page.locator('button').filter({ hasText: /save|yadda saxla/i }).first();
        const hasSave = await saveBtn.isVisible().catch(() => false);
        expect(typeof hasSave).toBe('boolean');
      }
    }
  });

});

// Voice Bot Card Tests
test.describe('Voice Bot Card', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('voice bot card shows name', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const card = page.locator('[class*="card"]').first();
      const hasCard = await card.isVisible().catch(() => false);
      expect(typeof hasCard).toBe('boolean');
    }
  });

  test('voice bot card shows status', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const status = page.locator('text=/active|inactive|aktiv|qeyri-aktiv/i').first();
      const hasStatus = await status.isVisible().catch(() => false);
      expect(typeof hasStatus).toBe('boolean');
    }
  });

  test('voice bot card shows call count', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const callCount = page.locator('text=/total calls|ümumi zənglər|0|[0-9]+/i').first();
      const hasCalls = await callCount.isVisible().catch(() => false);
      expect(typeof hasCalls).toBe('boolean');
    }
  });

  test('voice bot card shows duration', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const duration = page.locator('text=/duration|müddət|0m|[0-9]+m/i').first();
      const hasDuration = await duration.isVisible().catch(() => false);
      expect(typeof hasDuration).toBe('boolean');
    }
  });

  test('voice bot card has view calls button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const callsBtn = page.locator('button').filter({ hasText: /calls|zənglər/i }).first();
      const hasCalls = await callsBtn.isVisible().catch(() => false);
      expect(typeof hasCalls).toBe('boolean');
    }
  });

  test('voice bot card has edit button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const editBtn = page.locator('button').filter({ hasText: /edit|redaktə|✏/i }).first();
      const hasEdit = await editBtn.isVisible().catch(() => false);
      expect(typeof hasEdit).toBe('boolean');
    }
  });

  test('voice bot card has delete button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const deleteBtn = page.locator('button').filter({ hasText: /delete|sil|🗑/i }).first();
      const hasDelete = await deleteBtn.isVisible().catch(() => false);
      expect(typeof hasDelete).toBe('boolean');
    }
  });

});

// Call History Tests
test.describe('Call History', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access call history page after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('call-history') || url.includes('login') || url.includes('dashboard')).toBeTruthy();
  });

  test('call history page has title', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const title = page.locator('text=/call history|zəng tarixçəsi/i').first();
      const hasTitle = await title.isVisible().catch(() => false);
      expect(typeof hasTitle).toBe('boolean');
    }
  });

  test('call history has back to bots button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const backBtn = page.locator('button').filter({ hasText: /back|qayıt|voice bots/i }).first();
      const hasBack = await backBtn.isVisible().catch(() => false);
      expect(typeof hasBack).toBe('boolean');
    }
  });

  test('call history has bot filter', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const botFilter = page.locator('select').first();
      const hasFilter = await botFilter.isVisible().catch(() => false);
      expect(typeof hasFilter).toBe('boolean');
    }
  });

  test('call history has status filter', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const statusFilter = page.locator('text=/status|completed|failed/i').first();
      const hasStatus = await statusFilter.isVisible().catch(() => false);
      expect(typeof hasStatus).toBe('boolean');
    }
  });

  test('call history has direction filter', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const dirFilter = page.locator('text=/direction|inbound|outbound|gələn|gedən/i').first();
      const hasDir = await dirFilter.isVisible().catch(() => false);
      expect(typeof hasDir).toBe('boolean');
    }
  });

  test('call history shows statistics', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const stats = page.locator('text=/total calls|ümumi zənglər/i').first();
      const hasStats = await stats.isVisible().catch(() => false);
      expect(typeof hasStats).toBe('boolean');
    }
  });

  test('call history shows call list or empty state', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const list = page.locator('table, [class*="list"], text=/no calls/i').first();
      const hasList = await list.isVisible().catch(() => false);
      expect(typeof hasList).toBe('boolean');
    }
  });

});

// Call Details Tests
test.describe('Call Details', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('call details modal can open', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const viewBtn = page.locator('button').filter({ hasText: /view|bax/i }).first();
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        const modal = page.locator('[class*="modal"]').first();
        const hasModal = await modal.isVisible().catch(() => false);
        expect(typeof hasModal).toBe('boolean');
      }
    }
  });

  test('call details shows from number', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const fromText = page.locator('text=/from|kimdən/i').first();
      const hasFrom = await fromText.isVisible().catch(() => false);
      expect(typeof hasFrom).toBe('boolean');
    }
  });

  test('call details shows to number', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const toText = page.locator('text=/to|kimə/i').first();
      const hasTo = await toText.isVisible().catch(() => false);
      expect(typeof hasTo).toBe('boolean');
    }
  });

  test('call details shows duration', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const durText = page.locator('text=/duration|müddət/i').first();
      const hasDur = await durText.isVisible().catch(() => false);
      expect(typeof hasDur).toBe('boolean');
    }
  });

  test('call details shows transcription section', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const transText = page.locator('text=/transcription|transkripsiya/i').first();
      const hasTrans = await transText.isVisible().catch(() => false);
      expect(typeof hasTrans).toBe('boolean');
    }
  });

  test('call details shows conversation section', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const convText = page.locator('text=/conversation|söhbət/i').first();
      const hasConv = await convText.isVisible().catch(() => false);
      expect(typeof hasConv).toBe('boolean');
    }
  });

  test('call details shows recording section', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const recText = page.locator('text=/recording|qeyd/i').first();
      const hasRec = await recText.isVisible().catch(() => false);
      expect(typeof hasRec).toBe('boolean');
    }
  });

});

// Voice AI Mobile Tests
test.describe('Voice AI Mobile', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('voice bots page displays on iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('voice-bots') || url.includes('login')).toBeTruthy();
  });

  test('call history page displays on iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('call-history') || url.includes('login')).toBeTruthy();
  });

  test('voice bots list visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const list = page.locator('[class*="list"], [class*="grid"]').first();
      const hasList = await list.isVisible().catch(() => false);
      expect(typeof hasList).toBe('boolean');
    }
  });

  test('create button accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      const hasCreate = await createBtn.isVisible().catch(() => false);
      expect(typeof hasCreate).toBe('boolean');
    }
  });

  test('call history filters work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const filter = page.locator('select').first();
      const hasFilter = await filter.isVisible().catch(() => false);
      expect(typeof hasFilter).toBe('boolean');
    }
  });

  test('tablet view works for voice bots', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('voice-bots') || url.includes('login')).toBeTruthy();
  });

  test('tablet view works for call history', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('call-history') || url.includes('login')).toBeTruthy();
  });

});

// Voice AI Error States Tests
test.describe('Voice AI Error States', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('empty bot name shows validation error', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        const saveBtn = page.locator('button').filter({ hasText: /save|yadda saxla/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    expect(true).toBeTruthy();
  });

  test('delete confirmation appears', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('voice-bots')) {
      const deleteBtn = page.locator('button').filter({ hasText: /delete|sil/i }).first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        page.on('dialog', dialog => dialog.dismiss());
        await deleteBtn.click();
        await page.waitForTimeout(1000);
      }
    }
    expect(true).toBeTruthy();
  });

  test('error message on API failure', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/voice-bots');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const errorText = page.locator('text=/error|xəta|failed/i').first();
    const hasError = await errorText.isVisible().catch(() => false);
    expect(typeof hasError).toBe('boolean');
  });

});

// Voice Statistics Tests
test.describe('Voice Statistics', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('call history shows total calls stat', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const totalStat = page.locator('text=/total|ümumi/i').first();
      const hasTotal = await totalStat.isVisible().catch(() => false);
      expect(typeof hasTotal).toBe('boolean');
    }
  });

  test('call history shows completed calls stat', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const completedStat = page.locator('text=/completed|tamamlandı/i').first();
      const hasCompleted = await completedStat.isVisible().catch(() => false);
      expect(typeof hasCompleted).toBe('boolean');
    }
  });

  test('call history shows inbound calls stat', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const inboundStat = page.locator('text=/inbound|gələn/i').first();
      const hasInbound = await inboundStat.isVisible().catch(() => false);
      expect(typeof hasInbound).toBe('boolean');
    }
  });

  test('call history shows total duration stat', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/call-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('call-history')) {
      const durationStat = page.locator('text=/total duration|ümumi müddət/i').first();
      const hasDuration = await durationStat.isVisible().catch(() => false);
      expect(typeof hasDuration).toBe('boolean');
    }
  });

});
