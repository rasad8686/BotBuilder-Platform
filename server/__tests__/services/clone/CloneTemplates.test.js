/**
 * CloneTemplates Service Tests
 */

const CloneTemplates = require('../../../services/clone/CloneTemplates');

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

const db = require('../../../db');

describe('CloneTemplates Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBuiltInTemplates', () => {
    it('should return all built-in templates', async () => {
      const result = await CloneTemplates.getBuiltInTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(Array.isArray(result.templates)).toBe(true);
      expect(result.templates.length).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const result = await CloneTemplates.getBuiltInTemplates({ type: 'personality' });

      expect(result.success).toBe(true);
      expect(result.templates.every(t => t.type === 'personality')).toBe(true);
    });

    it('should filter by category', async () => {
      const result = await CloneTemplates.getBuiltInTemplates({ category: 'professional' });

      expect(result.success).toBe(true);
      expect(result.templates.every(t => t.category === 'professional')).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should return built-in template by ID', async () => {
      const templates = await CloneTemplates.getBuiltInTemplates();
      const templateId = templates.templates[0].id;

      const result = await CloneTemplates.getTemplate(templateId);

      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template.id).toBe(templateId);
    });

    it('should return custom template by ID', async () => {
      const mockTemplate = {
        id: 'custom-123',
        name: 'Custom Template',
        type: 'personality',
        config: {}
      };

      db.query.mockResolvedValueOnce({ rows: [mockTemplate] });

      const result = await CloneTemplates.getTemplate('custom-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.template.id).toBe('custom-123');
    });

    it('should return error for non-existent template', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneTemplates.getTemplate('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('createFromTemplate', () => {
    const builtInTemplates = [
      {
        id: 'professional-assistant',
        name: 'Professional Assistant',
        type: 'personality',
        config: { traits: { openness: 0.6 } }
      }
    ];

    beforeEach(async () => {
      // Get actual template ID
      const templates = await CloneTemplates.getBuiltInTemplates();
      if (templates.templates.length > 0) {
        builtInTemplates[0] = templates.templates[0];
      }
    });

    it('should create clone from built-in template', async () => {
      const newClone = {
        id: 'new-clone-123',
        name: 'My Clone',
        type: 'personality'
      };

      db.query.mockResolvedValueOnce({ rows: [newClone] });

      const result = await CloneTemplates.createFromTemplate(
        builtInTemplates[0].id,
        'user-456',
        { name: 'My Clone' }
      );

      expect(result.success).toBe(true);
      expect(result.clone).toBeDefined();
    });

    it('should create clone from custom template', async () => {
      const customTemplate = {
        id: 'custom-template',
        name: 'Custom Template',
        type: 'style',
        config: { formality: 0.8 },
        is_public: true
      };

      const newClone = {
        id: 'new-clone-456',
        name: 'From Custom',
        type: 'style'
      };

      db.query
        .mockResolvedValueOnce({ rows: [customTemplate] }) // Get template
        .mockResolvedValueOnce({ rows: [newClone] }); // Create clone

      const result = await CloneTemplates.createFromTemplate(
        'custom-template',
        'user-456',
        { name: 'From Custom' }
      );

      expect(result.success).toBe(true);
    });

    it('should override config values', async () => {
      const newClone = {
        id: 'new-clone-789',
        name: 'Custom Config Clone',
        type: 'personality'
      };

      db.query.mockResolvedValueOnce({ rows: [newClone] });

      const result = await CloneTemplates.createFromTemplate(
        builtInTemplates[0].id,
        'user-456',
        {
          name: 'Custom Config Clone',
          configOverrides: { traits: { openness: 0.9 } }
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getUserTemplates', () => {
    it('should return user custom templates', async () => {
      const mockTemplates = [
        { id: 'template-1', name: 'Template 1', user_id: 'user-456' },
        { id: 'template-2', name: 'Template 2', user_id: 'user-456' }
      ];

      db.query.mockResolvedValueOnce({ rows: mockTemplates });

      const result = await CloneTemplates.getUserTemplates('user-456');

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2);
    });

    it('should return empty array for user with no templates', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneTemplates.getUserTemplates('user-456');

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(0);
    });
  });

  describe('saveAsTemplate', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'user-456',
      name: 'Source Clone',
      type: 'personality',
      config: { traits: { openness: 0.7 } }
    };

    it('should save clone as template', async () => {
      const newTemplate = {
        id: 'template-new',
        name: 'My Template',
        type: 'personality'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [newTemplate] });

      const result = await CloneTemplates.saveAsTemplate(
        'clone-123',
        'user-456',
        { name: 'My Template', description: 'A custom template' }
      );

      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
    });

    it('should reject saving non-owned clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockClone, user_id: 'other-user' }] });

      const result = await CloneTemplates.saveAsTemplate(
        'clone-123',
        'user-456',
        { name: 'My Template' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should save as public template when specified', async () => {
      const publicTemplate = {
        id: 'template-public',
        name: 'Public Template',
        is_public: true
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [publicTemplate] });

      const result = await CloneTemplates.saveAsTemplate(
        'clone-123',
        'user-456',
        { name: 'Public Template', isPublic: true }
      );

      expect(result.success).toBe(true);
      expect(result.template.is_public).toBe(true);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete user template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'template-123' }] });

      const result = await CloneTemplates.deleteTemplate('template-123', 'user-456');

      expect(result.success).toBe(true);
    });

    it('should reject deleting non-owned template', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneTemplates.deleteTemplate('template-123', 'wrong-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject deleting built-in template', async () => {
      const templates = await CloneTemplates.getBuiltInTemplates();
      const builtInId = templates.templates[0]?.id;

      if (builtInId) {
        const result = await CloneTemplates.deleteTemplate(builtInId, 'user-456');

        expect(result.success).toBe(false);
        expect(result.error).toContain('built-in');
      }
    });
  });

  describe('getPublicTemplates', () => {
    it('should return public templates', async () => {
      const publicTemplates = [
        { id: 'public-1', name: 'Public 1', is_public: true },
        { id: 'public-2', name: 'Public 2', is_public: true }
      ];

      db.query.mockResolvedValueOnce({ rows: publicTemplates });

      const result = await CloneTemplates.getPublicTemplates();

      expect(result.success).toBe(true);
      expect(result.templates.every(t => t.is_public)).toBe(true);
    });

    it('should paginate results', async () => {
      const templates = Array.from({ length: 25 }, (_, i) => ({
        id: `public-${i}`,
        name: `Public ${i}`,
        is_public: true
      }));

      db.query.mockResolvedValueOnce({ rows: templates.slice(0, 20) });

      const result = await CloneTemplates.getPublicTemplates({ limit: 20, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.templates.length).toBeLessThanOrEqual(20);
    });
  });
});
