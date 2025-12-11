/**
 * Knowledge Routes Tests
 * Tests for server/routes/knowledge.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../models/KnowledgeBase', () => ({
  findByTenant: jest.fn(),
  findByIdAndTenant: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateCounts: jest.fn()
}));

jest.mock('../../models/Document', () => ({
  create: jest.fn(),
  findByKnowledgeBase: jest.fn(),
  findById: jest.fn(),
  findByIdAndKnowledgeBase: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../knowledge/VectorStore', () => ({
  getAgentsByKnowledgeBase: jest.fn(),
  removeAllAgentsFromKnowledgeBase: jest.fn(),
  assignToAgent: jest.fn(),
  similaritySearch: jest.fn()
}));

jest.mock('../../knowledge/DocumentProcessor', () => ({
  processDocument: jest.fn()
}));

jest.mock('../../knowledge/EmbeddingService', () => ({
  getEmbedding: jest.fn()
}));

jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      // Simulate file upload
      if (req.headers['x-test-file']) {
        req.file = {
          originalname: 'test.txt',
          path: '/tmp/test.txt',
          size: 1024
        };
      }
      next();
    })
  }));
  multerMock.diskStorage = jest.fn();
  return multerMock;
});

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const KnowledgeBase = require('../../models/KnowledgeBase');
const Document = require('../../models/Document');
const VectorStore = require('../../knowledge/VectorStore');
const DocumentProcessor = require('../../knowledge/DocumentProcessor');
const EmbeddingService = require('../../knowledge/EmbeddingService');
const knowledgeRouter = require('../../routes/knowledge');

const app = express();
app.use(express.json());
app.use('/api/knowledge', knowledgeRouter);

describe('Knowledge Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/knowledge', () => {
    it('should return all knowledge bases for tenant', async () => {
      KnowledgeBase.findByTenant.mockResolvedValueOnce([
        { id: 1, name: 'KB 1' },
        { id: 2, name: 'KB 2' }
      ]);

      const response = await request(app).get('/api/knowledge');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(KnowledgeBase.findByTenant).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      KnowledgeBase.findByTenant.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/knowledge');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed');
    });
  });

  describe('POST /api/knowledge', () => {
    it('should create knowledge base', async () => {
      KnowledgeBase.create.mockResolvedValueOnce({
        id: 1,
        name: 'Test KB',
        embedding_model: 'text-embedding-3-small'
      });

      const response = await request(app)
        .post('/api/knowledge')
        .send({
          name: 'Test KB',
          description: 'A test knowledge base'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test KB');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/knowledge')
        .send({ description: 'No name' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/knowledge')
        .send({ name: '   ' });

      expect(response.status).toBe(400);
    });

    it('should use default embedding settings', async () => {
      KnowledgeBase.create.mockResolvedValueOnce({ id: 1 });

      await request(app)
        .post('/api/knowledge')
        .send({ name: 'Test' });

      expect(KnowledgeBase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          embedding_model: 'text-embedding-3-small',
          chunk_size: 1000,
          chunk_overlap: 200
        })
      );
    });
  });

  describe('GET /api/knowledge/:id', () => {
    it('should return single knowledge base', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({
        id: 1,
        name: 'Test KB'
      });

      const response = await request(app).get('/api/knowledge/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test KB');
    });

    it('should return 404 if not found', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/knowledge/999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/knowledge/:id', () => {
    it('should update knowledge base', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      KnowledgeBase.update.mockResolvedValueOnce({
        id: 1,
        name: 'Updated KB'
      });

      const response = await request(app)
        .put('/api/knowledge/1')
        .send({ name: 'Updated KB' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated KB');
    });

    it('should return 404 if not found', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/knowledge/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/knowledge/:id', () => {
    it('should delete knowledge base', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      KnowledgeBase.delete.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/knowledge/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if not found', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/knowledge/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/knowledge/:id/documents', () => {
    it('should return 404 if knowledge base not found', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/knowledge/999/documents')
        .send({ url: 'http://example.com' });

      expect(response.status).toBe(404);
    });

    it('should upload URL document', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      Document.create.mockResolvedValueOnce({
        id: 1,
        name: 'http://example.com',
        type: 'url'
      });
      DocumentProcessor.processDocument.mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/knowledge/1/documents')
        .send({
          url: 'http://example.com',
          name: 'Example Site'
        });

      expect(response.status).toBe(201);
      expect(Document.create).toHaveBeenCalled();
    });

    it('should reject request without file or URL', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

      const response = await request(app)
        .post('/api/knowledge/1/documents')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('GET /api/knowledge/:id/documents', () => {
    it('should return documents for knowledge base', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      Document.findByKnowledgeBase.mockResolvedValueOnce([
        { id: 1, name: 'doc1.txt' },
        { id: 2, name: 'doc2.pdf' }
      ]);

      const response = await request(app).get('/api/knowledge/1/documents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return 404 if knowledge base not found', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/knowledge/999/documents');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/knowledge/:id/documents/:docId', () => {
    it('should delete document', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      Document.findByIdAndKnowledgeBase.mockResolvedValueOnce({
        id: 1,
        file_path: '/tmp/test.txt'
      });
      Document.delete.mockResolvedValueOnce(true);
      KnowledgeBase.updateCounts.mockResolvedValueOnce({});

      const response = await request(app).delete('/api/knowledge/1/documents/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if document not found', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      Document.findByIdAndKnowledgeBase.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/knowledge/1/documents/999');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/knowledge/:id/agents', () => {
    it('should return agents assigned to knowledge base', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([
        { id: 1, name: 'Agent 1' }
      ]);

      const response = await request(app).get('/api/knowledge/1/agents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('PUT /api/knowledge/:id/agents', () => {
    it('should update agent assignments', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      VectorStore.removeAllAgentsFromKnowledgeBase.mockResolvedValueOnce({});
      VectorStore.assignToAgent.mockResolvedValue({});
      VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([
        { id: 1 }, { id: 2 }
      ]);

      const response = await request(app)
        .put('/api/knowledge/1/agents')
        .send({ agent_ids: [1, 2] });

      expect(response.status).toBe(200);
      expect(VectorStore.assignToAgent).toHaveBeenCalledTimes(2);
    });

    it('should reject non-array agent_ids', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

      const response = await request(app)
        .put('/api/knowledge/1/agents')
        .send({ agent_ids: 'not-an-array' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/knowledge/:id/search', () => {
    it('should perform semantic search', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      VectorStore.similaritySearch.mockResolvedValueOnce([
        { content: 'Result 1', similarity: 0.9 },
        { content: 'Result 2', similarity: 0.8 }
      ]);

      const response = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'test query' });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.query).toBe('test query');
    });

    it('should reject empty query', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

      const response = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should use default limit and threshold', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      VectorStore.similaritySearch.mockResolvedValueOnce([]);

      await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'test' });

      expect(VectorStore.similaritySearch).toHaveBeenCalledWith(
        1,
        expect.any(Array),
        { limit: 5, threshold: 0.7 }
      );
    });
  });
});
