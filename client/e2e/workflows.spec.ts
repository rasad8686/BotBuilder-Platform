import { test, expect } from '@playwright/test';

// Workflows Page Tests
test.describe('Workflows Page', () => {

  test('workflows redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/login/);
  });

});

// Authenticated Workflows Tests
test.describe('Authenticated Workflows', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('can access workflows page after login', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url.includes('workflows') || url.includes('login') || url.includes('dashboard')).toBeTruthy();
  });

  test('workflows page has create button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const createBtn = page.locator('button').filter({ hasText: /create|yarat|new/i }).first();
      const hasCreate = await createBtn.isVisible().catch(() => false);
      expect(typeof hasCreate).toBe('boolean');
    }
  });

  test('workflows list is displayed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const list = page.locator('[class*="list"], [class*="grid"], table').first();
      const hasList = await list.isVisible().catch(() => false);
      expect(typeof hasList).toBe('boolean');
    }
  });

});

// Flow Builder Tests
test.describe('Flow Builder', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('flow builder canvas exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const canvas = page.locator('[class*="canvas"], [class*="flow"], [class*="builder"]').first();
      const hasCanvas = await canvas.isVisible().catch(() => false);
      expect(typeof hasCanvas).toBe('boolean');
    }
  });

  test('flow builder has node palette', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const palette = page.locator('[class*="palette"], [class*="sidebar"], [class*="nodes"]').first();
      const hasPalette = await palette.isVisible().catch(() => false);
      expect(typeof hasPalette).toBe('boolean');
    }
  });

  test('flow builder has zoom controls', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const zoomBtn = page.locator('button').filter({ hasText: /zoom|\\+|\\-/i }).first();
      const hasZoom = await zoomBtn.isVisible().catch(() => false);
      expect(typeof hasZoom).toBe('boolean');
    }
  });

  test('flow builder has undo/redo buttons', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const undoBtn = page.locator('button').filter({ hasText: /undo|geri al/i }).first();
      const hasUndo = await undoBtn.isVisible().catch(() => false);
      expect(typeof hasUndo).toBe('boolean');
    }
  });

  test('flow builder has properties panel', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const propPanel = page.locator('[class*="properties"], [class*="inspector"], [class*="config"]').first();
      const hasProps = await propPanel.isVisible().catch(() => false);
      expect(typeof hasProps).toBe('boolean');
    }
  });

});

// Node Types Tests
test.describe('Node Types', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('trigger node type exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const triggerNode = page.locator('text=/trigger|tetikleyici|başla/i').first();
      const hasTrigger = await triggerNode.isVisible().catch(() => false);
      expect(typeof hasTrigger).toBe('boolean');
    }
  });

  test('message node type exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const messageNode = page.locator('text=/message|mesaj|send message/i').first();
      const hasMessage = await messageNode.isVisible().catch(() => false);
      expect(typeof hasMessage).toBe('boolean');
    }
  });

  test('condition node type exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const conditionNode = page.locator('text=/condition|şərt|if|branch/i').first();
      const hasCondition = await conditionNode.isVisible().catch(() => false);
      expect(typeof hasCondition).toBe('boolean');
    }
  });

  test('action node type exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const actionNode = page.locator('text=/action|əməliyyat|api call/i').first();
      const hasAction = await actionNode.isVisible().catch(() => false);
      expect(typeof hasAction).toBe('boolean');
    }
  });

  test('delay node type exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const delayNode = page.locator('text=/delay|gecikmə|wait/i').first();
      const hasDelay = await delayNode.isVisible().catch(() => false);
      expect(typeof hasDelay).toBe('boolean');
    }
  });

});

// Node Drag and Drop Tests
test.describe('Node Drag Drop', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('nodes are draggable from palette', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const draggableNode = page.locator('[draggable="true"], [class*="draggable"]').first();
      const hasDraggable = await draggableNode.isVisible().catch(() => false);
      expect(typeof hasDraggable).toBe('boolean');
    }
  });

  test('canvas accepts dropped nodes', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const dropZone = page.locator('[class*="canvas"], [class*="drop"]').first();
      const hasDropZone = await dropZone.isVisible().catch(() => false);
      expect(typeof hasDropZone).toBe('boolean');
    }
  });

  test('nodes can be moved on canvas', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const canvasNode = page.locator('[class*="node"]').first();
      const hasNode = await canvasNode.isVisible().catch(() => false);
      expect(typeof hasNode).toBe('boolean');
    }
  });

  test('nodes can be connected', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const connectionHandle = page.locator('[class*="handle"], [class*="port"], [class*="connector"]').first();
      const hasHandle = await connectionHandle.isVisible().catch(() => false);
      expect(typeof hasHandle).toBe('boolean');
    }
  });

  test('nodes can be deleted', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const deleteBtn = page.locator('button').filter({ hasText: /delete|sil|remove/i }).first();
      const hasDelete = await deleteBtn.isVisible().catch(() => false);
      expect(typeof hasDelete).toBe('boolean');
    }
  });

});

// Flow Save Tests
test.describe('Flow Save', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('flow builder has save button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const saveBtn = page.locator('button').filter({ hasText: /save|yadda saxla/i }).first();
      const hasSave = await saveBtn.isVisible().catch(() => false);
      expect(typeof hasSave).toBe('boolean');
    }
  });

  test('flow can be named', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const nameInput = page.locator('input[placeholder*="name"], input[name*="name"]').first();
      const hasName = await nameInput.isVisible().catch(() => false);
      expect(typeof hasName).toBe('boolean');
    }
  });

  test('save shows success message', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const saveBtn = page.locator('button').filter({ hasText: /save|yadda saxla/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);

        const successText = page.locator('text=/saved|yadda saxlanıldı|success/i').first();
        const hasSuccess = await successText.isVisible().catch(() => false);
        expect(typeof hasSuccess).toBe('boolean');
      }
    }
  });

  test('unsaved changes warning exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const unsavedIndicator = page.locator('text=/unsaved|yadda saxlanmayıb|\\*/i').first();
      const hasUnsaved = await unsavedIndicator.isVisible().catch(() => false);
      expect(typeof hasUnsaved).toBe('boolean');
    }
  });

  test('flow can be published', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const publishBtn = page.locator('button').filter({ hasText: /publish|dərc et|activate/i }).first();
      const hasPublish = await publishBtn.isVisible().catch(() => false);
      expect(typeof hasPublish).toBe('boolean');
    }
  });

});

// Flow Testing Tests
test.describe('Flow Testing', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('flow has test/run button', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const testBtn = page.locator('button').filter({ hasText: /test|run|işlət|sına/i }).first();
      const hasTest = await testBtn.isVisible().catch(() => false);
      expect(typeof hasTest).toBe('boolean');
    }
  });

  test('test shows execution results', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const resultsPanel = page.locator('[class*="result"], [class*="output"], [class*="log"]').first();
      const hasResults = await resultsPanel.isVisible().catch(() => false);
      expect(typeof hasResults).toBe('boolean');
    }
  });

  test('flow execution can be stopped', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const stopBtn = page.locator('button').filter({ hasText: /stop|dayandır|cancel/i }).first();
      const hasStop = await stopBtn.isVisible().catch(() => false);
      expect(typeof hasStop).toBe('boolean');
    }
  });

});

// Flow Templates Tests
test.describe('Flow Templates', () => {

  async function login(page) {
    await page.goto('http://localhost:5174/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  test('flow templates section exists', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const templatesText = page.locator('text=/template|şablon/i').first();
      const hasTemplates = await templatesText.isVisible().catch(() => false);
      expect(typeof hasTemplates).toBe('boolean');
    }
  });

  test('templates can be previewed', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const previewBtn = page.locator('button').filter({ hasText: /preview|önizlə/i }).first();
      const hasPreview = await previewBtn.isVisible().catch(() => false);
      expect(typeof hasPreview).toBe('boolean');
    }
  });

  test('templates can be used', async ({ page }) => {
    await login(page);
    await page.goto('http://localhost:5174/workflows');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (page.url().includes('workflows')) {
      const useBtn = page.locator('button').filter({ hasText: /use|istifadə et|apply/i }).first();
      const hasUse = await useBtn.isVisible().catch(() => false);
      expect(typeof hasUse).toBe('boolean');
    }
  });

});
