/**
 * Document Model Tests
 * Tests for server/models/Document.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Document = require('../../models/Document');

describe('Document Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByKnowledgeBase()', () => {
    it('should return all documents for knowledge base', async () => {
      const mockDocs = [
        { id: 1, name: 'Doc 1', knowledge_base_id: 1 },
        { id: 2, name: 'Doc 2', knowledge_base_id: 1 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockDocs });

      const result = await Document.findByKnowledgeBase(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('knowledge_base_id = $1'),
        [1]
      );
    });

    it('should return empty array if no documents', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Document.findByKnowledgeBase(999);

      expect(result).toEqual([]);
    });
  });

  describe('findById()', () => {
    it('should return document if found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Doc' }] });

      const result = await Document.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Document.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndKnowledgeBase()', () => {
    it('should return document if found in knowledge base', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 1 }] });

      const result = await Document.findByIdAndKnowledgeBase(1, 1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('knowledge_base_id = $2'),
        [1, 1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Document.findByIdAndKnowledgeBase(1, 999);

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create document with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Doc' }] });

      const result = await Document.create({
        knowledge_base_id: 1,
        name: 'New Doc',
        type: 'pdf',
        source_url: 'http://example.com/doc.pdf',
        file_size: 1024
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documents'),
        expect.any(Array)
      );
    });

    it('should handle optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Document.create({
        knowledge_base_id: 1,
        name: 'Doc',
        type: 'txt'
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain(null); // source_url
      expect(insertValues).toContain(null); // file_path
    });

    it('should stringify metadata', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Document.create({
        knowledge_base_id: 1,
        name: 'Doc',
        type: 'pdf',
        metadata: { author: 'Test' }
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('{"author":"Test"}');
    });
  });

  describe('updateStatus()', () => {
    it('should update status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'processed' }] });

      const result = await Document.updateStatus(1, 'processed');

      expect(result.status).toBe('processed');
    });

    it('should update status with chunk count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'processed', chunk_count: 10 }] });

      const result = await Document.updateStatus(1, 'processed', 10);

      expect(result.chunk_count).toBe(10);
      expect(db.query.mock.calls[0][0]).toContain('chunk_count = $2');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Document.updateStatus(999, 'processed');

      expect(result).toBeNull();
    });
  });

  describe('update()', () => {
    it('should update allowed fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });

      const result = await Document.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Document.update(1, {
        name: 'Updated',
        type: 'docx',
        status: 'processed'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('type = $2');
      expect(updateQuery).toContain('status = $3');
    });

    it('should stringify metadata', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Document.update(1, { metadata: { key: 'value' } });

      expect(db.query.mock.calls[0][1]).toContain('{"key":"value"}');
    });

    it('should return current doc if no updates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Document.update(1, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });
  });

  describe('delete()', () => {
    it('should delete document', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await Document.delete(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Document.delete(999);

      expect(result).toBeNull();
    });
  });

  describe('findByContentHash()', () => {
    it('should find document by content hash', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content_hash: 'abc123' }] });

      const result = await Document.findByContentHash(1, 'abc123');

      expect(result.content_hash).toBe('abc123');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Document.findByContentHash(1, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByStatus()', () => {
    it('should find documents by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] });

      const result = await Document.findByStatus(1, 'pending');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        [1, 'pending']
      );
    });
  });

  describe('countByKnowledgeBase()', () => {
    it('should count documents', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await Document.countByKnowledgeBase(1);

      expect(result).toBe(5);
    });
  });
});
