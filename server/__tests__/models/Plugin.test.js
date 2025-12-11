/**
 * Plugin Model Tests
 * Tests for server/models/Plugin.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Plugin = require('../../models/Plugin');

describe('Plugin Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return all plugins with default options', async () => {
      const mockPlugins = [
        { id: 1, name: 'Plugin 1', downloads: 100 },
        { id: 2, name: 'Plugin 2', downloads: 50 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockPlugins });

      const result = await Plugin.findAll();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $1"),
        ['published', 50, 0]
      );
    });

    it('should use custom options', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Plugin.findAll({ status: 'pending', limit: 10, offset: 20, orderBy: 'rating' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('rating DESC'),
        ['pending', 10, 20]
      );
    });

    it('should fallback to downloads for invalid orderBy', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Plugin.findAll({ orderBy: 'invalid' });

      expect(db.query.mock.calls[0][0]).toContain('downloads DESC');
    });
  });

  describe('findById()', () => {
    it('should return plugin if found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Plugin' }] });

      const result = await Plugin.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Plugin.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findBySlug()', () => {
    it('should return plugin by slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, slug: 'test-plugin' }] });

      const result = await Plugin.findBySlug('test-plugin');

      expect(result.slug).toBe('test-plugin');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Plugin.findBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create plugin with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Plugin' }] });

      const result = await Plugin.create({
        developer_id: 1,
        name: 'New Plugin',
        slug: 'new-plugin',
        description: 'A new plugin',
        category_id: 1
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plugins'),
        expect.any(Array)
      );
    });

    it('should use default values', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Plugin.create({
        developer_id: 1,
        name: 'Plugin',
        slug: 'plugin',
        description: 'Desc'
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('1.0.0'); // default version
      expect(insertValues).toContain(0); // default price
      expect(insertValues).toContain(true); // default is_free
      expect(insertValues).toContain('pending'); // default status
    });

    it('should stringify manifest and permissions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Plugin.create({
        developer_id: 1,
        name: 'Plugin',
        slug: 'plugin',
        description: 'Desc',
        manifest: { entry: 'index.js' },
        permissions: ['read', 'write']
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('{"entry":"index.js"}');
      expect(insertValues).toContain('["read","write"]');
    });
  });

  describe('update()', () => {
    it('should update allowed fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });

      const result = await Plugin.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Plugin.update(1, {
        name: 'Updated',
        description: 'New desc',
        version: '2.0.0'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('description = $2');
      expect(updateQuery).toContain('version = $3');
    });

    it('should stringify manifest on update', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Plugin.update(1, { manifest: { new: 'config' } });

      expect(db.query.mock.calls[0][1]).toContain('{"new":"config"}');
    });

    it('should stringify permissions on update', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Plugin.update(1, { permissions: ['admin'] });

      expect(db.query.mock.calls[0][1]).toContain('["admin"]');
    });

    it('should return current plugin if no updates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Plugin.update(1, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });
  });

  describe('delete()', () => {
    it('should delete plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await Plugin.delete(1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        [1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Plugin.delete(999);

      expect(result).toBeNull();
    });
  });

  describe('search()', () => {
    it('should search plugins by query', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'AI Plugin' }] });

      const result = await Plugin.search('AI');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%AI%'])
      );
    });

    it('should filter by category_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Plugin.search('test', { category_id: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('category_id = $3'),
        expect.arrayContaining([5])
      );
    });
  });

  describe('getByCategory()', () => {
    it('should return plugins by category slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, category_slug: 'ai' }] });

      const result = await Plugin.getByCategory('ai');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('c.slug = $1'),
        ['ai', 'published', 50, 0]
      );
    });
  });

  describe('getByDeveloper()', () => {
    it('should return plugins by developer', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, developer_id: 5 }] });

      const result = await Plugin.getByDeveloper(5);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('developer_id = $1'),
        [5]
      );
    });
  });

  describe('incrementDownloads()', () => {
    it('should increment download count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ downloads: 101 }] });

      const result = await Plugin.incrementDownloads(1);

      expect(result).toBe(101);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('downloads + 1'),
        [1]
      );
    });

    it('should return 0 if plugin not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Plugin.incrementDownloads(999);

      expect(result).toBe(0);
    });
  });

  describe('updateRating()', () => {
    it('should update rating from reviews', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ rating: 4.5, review_count: 10 }] });

      const result = await Plugin.updateRating(1);

      expect(result.rating).toBe(4.5);
      expect(result.review_count).toBe(10);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Plugin.updateRating(999);

      expect(result).toBeNull();
    });
  });

  describe('getCategories()', () => {
    it('should return all categories with plugin counts', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'AI', plugin_count: 5 },
          { id: 2, name: 'Analytics', plugin_count: 3 }
        ]
      });

      const result = await Plugin.getCategories();

      expect(result).toHaveLength(2);
      expect(result[0].plugin_count).toBe(5);
    });
  });

  describe('getFeatured()', () => {
    it('should return featured plugins', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, rating: 5.0 },
          { id: 2, rating: 4.8 }
        ]
      });

      const result = await Plugin.getFeatured(2);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [2]
      );
    });

    it('should use default limit of 6', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Plugin.getFeatured();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [6]
      );
    });
  });
});
