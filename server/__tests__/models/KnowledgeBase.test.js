/**
 * KnowledgeBase Model Tests
 * Tests for server/models/KnowledgeBase.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const KnowledgeBase = require('../../models/KnowledgeBase');

describe('KnowledgeBase Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByTenant()', () => {
    it('should return all knowledge bases for tenant', async () => {
      const mockKBs = [
        { id: 1, name: 'KB 1', tenant_id: 1 },
        { id: 2, name: 'KB 2', tenant_id: 1 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockKBs });

      const result = await KnowledgeBase.findByTenant(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        [1]
      );
    });

    it('should return empty array if no knowledge bases', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await KnowledgeBase.findByTenant(999);

      expect(result).toEqual([]);
    });
  });

  describe('findById()', () => {
    it('should return knowledge base if found', async () => {
      const mockKB = { id: 1, name: 'Test KB' };
      db.query.mockResolvedValueOnce({ rows: [mockKB] });

      const result = await KnowledgeBase.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test KB');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await KnowledgeBase.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndTenant()', () => {
    it('should return knowledge base if found for tenant', async () => {
      const mockKB = { id: 1, tenant_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [mockKB] });

      const result = await KnowledgeBase.findByIdAndTenant(1, 1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        [1, 1]
      );
    });

    it('should return null if not found for tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await KnowledgeBase.findByIdAndTenant(1, 999);

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create knowledge base with all fields', async () => {
      const mockKB = { id: 1, name: 'New KB', embedding_model: 'text-embedding-3-small' };
      db.query.mockResolvedValueOnce({ rows: [mockKB] });

      const result = await KnowledgeBase.create({
        tenant_id: 1,
        name: 'New KB',
        description: 'Test description'
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO knowledge_bases'),
        expect.arrayContaining([1, 'New KB', 'Test description'])
      );
    });

    it('should use default values for optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await KnowledgeBase.create({
        tenant_id: 1,
        name: 'KB'
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('text-embedding-3-small'); // default embedding_model
      expect(insertValues).toContain(1000); // default chunk_size
      expect(insertValues).toContain(200); // default chunk_overlap
    });

    it('should allow custom embedding settings', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await KnowledgeBase.create({
        tenant_id: 1,
        name: 'KB',
        embedding_model: 'text-embedding-ada-002',
        chunk_size: 500,
        chunk_overlap: 100
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('text-embedding-ada-002');
      expect(insertValues).toContain(500);
      expect(insertValues).toContain(100);
    });
  });

  describe('update()', () => {
    it('should update knowledge base name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });

      const result = await KnowledgeBase.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await KnowledgeBase.update(1, {
        name: 'Updated',
        description: 'New desc',
        embedding_model: 'new-model'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('description = $2');
      expect(updateQuery).toContain('embedding_model = $3');
    });

    it('should update status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'processing' }] });

      await KnowledgeBase.update(1, { status: 'processing' });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('status = $1');
    });

    it('should return current KB if no updates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await KnowledgeBase.update(1, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });
  });

  describe('delete()', () => {
    it('should delete knowledge base', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await KnowledgeBase.delete(1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        [1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await KnowledgeBase.delete(999);

      expect(result).toBeNull();
    });
  });

  describe('updateCounts()', () => {
    it('should update document and chunk counts', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, document_count: 5, total_chunks: 100 }] });

      const result = await KnowledgeBase.updateCounts(1);

      expect(result.document_count).toBe(5);
      expect(result.total_chunks).toBe(100);
      expect(db.query.mock.calls[0][0]).toContain('document_count');
      expect(db.query.mock.calls[0][0]).toContain('total_chunks');
    });

    it('should return null if KB not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await KnowledgeBase.updateCounts(999);

      expect(result).toBeNull();
    });
  });

  describe('findByAgent()', () => {
    it('should return knowledge bases for agent', async () => {
      const mockKBs = [
        { id: 1, name: 'KB 1', priority: 1 },
        { id: 2, name: 'KB 2', priority: 2 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockKBs });

      const result = await KnowledgeBase.findByAgent(5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_id = $1'),
        [5]
      );
    });

    it('should return empty array if no KBs for agent', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await KnowledgeBase.findByAgent(999);

      expect(result).toEqual([]);
    });
  });

  describe('existsForTenant()', () => {
    it('should return true if KB exists for tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const result = await KnowledgeBase.existsForTenant(1, 1);

      expect(result).toBe(true);
    });

    it('should return false if KB does not exist for tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await KnowledgeBase.existsForTenant(999, 1);

      expect(result).toBe(false);
    });
  });
});
