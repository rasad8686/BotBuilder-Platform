/**
 * Comprehensive Knowledge Routes Tests
 * Tests for server/routes/knowledge.js
 *
 * Coverage:
 * - GET /api/knowledge - list knowledge bases
 * - POST /api/knowledge - create knowledge base
 * - GET /api/knowledge/:id - get knowledge base details
 * - PUT /api/knowledge/:id - update knowledge base
 * - DELETE /api/knowledge/:id - delete knowledge base
 * - POST /api/knowledge/:id/documents - add document
 * - GET /api/knowledge/:id/documents - list documents
 * - DELETE /api/knowledge/:id/documents/:docId - delete document
 * - GET /api/knowledge/:id/agents - get assigned agents
 * - PUT /api/knowledge/:id/agents - update agent assignments
 * - POST /api/knowledge/:id/search - semantic search
 * - File upload handling
 * - URL document handling
 * - Error handling and validation
 * - Authorization checks
 */

const path = require('path');
const fs = require('fs').promises;

jest.mock('../../models/KnowledgeBase', () => ({
  findByTenant: jest.fn(),
  findByIdAndTenant: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateCounts: jest.fn()
}));

jest.mock('../../models/Document', () => ({
  findByKnowledgeBase: jest.fn(),
  findByIdAndKnowledgeBase: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../knowledge/VectorStore', () => ({
  similaritySearch: jest.fn(),
  getAgentsByKnowledgeBase: jest.fn(),
  assignToAgent: jest.fn(),
  removeAllAgentsFromKnowledgeBase: jest.fn()
}));

jest.mock('../../knowledge/DocumentProcessor', () => ({
  processDocument: jest.fn()
}));

jest.mock('../../knowledge/EmbeddingService', () => ({
  getEmbedding: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    unlink: jest.fn()
  }
}));

jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      // Simulate file upload based on test headers
      if (req.headers['x-test-file']) {
        const filename = req.headers['x-test-filename'] || 'test.txt';
        const ext = path.extname(filename);
        req.file = {
          originalname: filename,
          path: `/uploads/documents/${filename}`,
          size: parseInt(req.headers['x-test-filesize'] || '1024'),
          mimetype: req.headers['x-test-mimetype'] || 'text/plain'
        };
      }
      next();
    })
  }));
  multerMock.diskStorage = jest.fn();
  return multerMock;
});

const express = require('express');
const request = require('supertest');
const KnowledgeBase = require('../../models/KnowledgeBase');
const Document = require('../../models/Document');
const VectorStore = require('../../knowledge/VectorStore');
const DocumentProcessor = require('../../knowledge/DocumentProcessor');
const EmbeddingService = require('../../knowledge/EmbeddingService');
const log = require('../../utils/logger');
const knowledgeRouter = require('../../routes/knowledge');

const app = express();
app.use(express.json());
app.use('/api/knowledge', knowledgeRouter);

describe('Knowledge Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/knowledge - List Knowledge Bases', () => {
    describe('Successful Retrieval', () => {
      it('should return all knowledge bases for tenant', async () => {
        const mockKnowledgeBases = [
          {
            id: 1,
            tenant_id: 1,
            name: 'KB 1',
            description: 'First knowledge base',
            embedding_model: 'text-embedding-3-small',
            chunk_size: 1000,
            chunk_overlap: 200,
            document_count: 5,
            status: 'ready'
          },
          {
            id: 2,
            tenant_id: 1,
            name: 'KB 2',
            description: 'Second knowledge base',
            embedding_model: 'text-embedding-3-large',
            chunk_size: 1500,
            chunk_overlap: 300,
            document_count: 10,
            status: 'ready'
          }
        ];

        KnowledgeBase.findByTenant.mockResolvedValueOnce(mockKnowledgeBases);

        const response = await request(app).get('/api/knowledge');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0].name).toBe('KB 1');
        expect(response.body[1].name).toBe('KB 2');
        expect(KnowledgeBase.findByTenant).toHaveBeenCalledWith(1);
        expect(log.debug).toHaveBeenCalledWith('Fetching knowledge bases', { tenantId: 1 });
      });

      it('should return empty array when no knowledge bases exist', async () => {
        KnowledgeBase.findByTenant.mockResolvedValueOnce([]);

        const response = await request(app).get('/api/knowledge');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(KnowledgeBase.findByTenant).toHaveBeenCalledWith(1);
      });

      it('should use user id as tenant when organization_id is not set', async () => {
        const appNoOrg = express();
        appNoOrg.use(express.json());
        appNoOrg.use(require('../../middleware/auth'));
        appNoOrg.use('/api/knowledge', knowledgeRouter);

        require('../../middleware/auth').mockImplementationOnce((req, res, next) => {
          req.user = { id: 5, email: 'solo@example.com' };
          next();
        });

        KnowledgeBase.findByTenant.mockResolvedValueOnce([]);

        const response = await request(appNoOrg).get('/api/knowledge');

        expect(response.status).toBe(200);
        expect(KnowledgeBase.findByTenant).toHaveBeenCalledWith(5);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByTenant.mockRejectedValueOnce(new Error('Database connection failed'));

        const response = await request(app).get('/api/knowledge');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to fetch knowledge bases');
        expect(log.error).toHaveBeenCalledWith('Error fetching knowledge bases', { error: 'Database connection failed' });
      });

      it('should handle model method errors', async () => {
        KnowledgeBase.findByTenant.mockRejectedValueOnce(new Error('Invalid tenant'));

        const response = await request(app).get('/api/knowledge');

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('POST /api/knowledge - Create Knowledge Base', () => {
    describe('Successful Creation', () => {
      it('should create knowledge base with all fields', async () => {
        const mockKB = {
          id: 1,
          tenant_id: 1,
          name: 'New KB',
          description: 'Test description',
          embedding_model: 'text-embedding-3-small',
          chunk_size: 1000,
          chunk_overlap: 200,
          status: 'ready'
        };

        KnowledgeBase.create.mockResolvedValueOnce(mockKB);

        const response = await request(app)
          .post('/api/knowledge')
          .send({
            name: 'New KB',
            description: 'Test description',
            embedding_model: 'text-embedding-3-small',
            chunk_size: 1000,
            chunk_overlap: 200
          });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('New KB');
        expect(response.body.description).toBe('Test description');
        expect(KnowledgeBase.create).toHaveBeenCalledWith({
          tenant_id: 1,
          name: 'New KB',
          description: 'Test description',
          embedding_model: 'text-embedding-3-small',
          chunk_size: 1000,
          chunk_overlap: 200
        });
      });

      it('should create knowledge base with minimal fields', async () => {
        const mockKB = {
          id: 1,
          tenant_id: 1,
          name: 'Simple KB',
          description: undefined,
          embedding_model: 'text-embedding-3-small',
          chunk_size: 1000,
          chunk_overlap: 200
        };

        KnowledgeBase.create.mockResolvedValueOnce(mockKB);

        const response = await request(app)
          .post('/api/knowledge')
          .send({ name: 'Simple KB' });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Simple KB');
        expect(KnowledgeBase.create).toHaveBeenCalledWith({
          tenant_id: 1,
          name: 'Simple KB',
          description: undefined,
          embedding_model: 'text-embedding-3-small',
          chunk_size: 1000,
          chunk_overlap: 200
        });
      });

      it('should trim whitespace from name and description', async () => {
        const mockKB = {
          id: 1,
          tenant_id: 1,
          name: 'Trimmed KB',
          description: 'Trimmed description'
        };

        KnowledgeBase.create.mockResolvedValueOnce(mockKB);

        const response = await request(app)
          .post('/api/knowledge')
          .send({
            name: '  Trimmed KB  ',
            description: '  Trimmed description  '
          });

        expect(response.status).toBe(201);
        expect(KnowledgeBase.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Trimmed KB',
            description: 'Trimmed description'
          })
        );
      });

      it('should use default values for optional parameters', async () => {
        const mockKB = { id: 1, name: 'Default KB' };
        KnowledgeBase.create.mockResolvedValueOnce(mockKB);

        const response = await request(app)
          .post('/api/knowledge')
          .send({ name: 'Default KB' });

        expect(response.status).toBe(201);
        expect(KnowledgeBase.create).toHaveBeenCalledWith(
          expect.objectContaining({
            embedding_model: 'text-embedding-3-small',
            chunk_size: 1000,
            chunk_overlap: 200
          })
        );
      });

      it('should accept custom embedding model', async () => {
        const mockKB = { id: 1, name: 'Custom Model KB' };
        KnowledgeBase.create.mockResolvedValueOnce(mockKB);

        const response = await request(app)
          .post('/api/knowledge')
          .send({
            name: 'Custom Model KB',
            embedding_model: 'text-embedding-3-large'
          });

        expect(response.status).toBe(201);
        expect(KnowledgeBase.create).toHaveBeenCalledWith(
          expect.objectContaining({
            embedding_model: 'text-embedding-3-large'
          })
        );
      });

      it('should accept custom chunk settings', async () => {
        const mockKB = { id: 1, name: 'Custom Chunk KB' };
        KnowledgeBase.create.mockResolvedValueOnce(mockKB);

        const response = await request(app)
          .post('/api/knowledge')
          .send({
            name: 'Custom Chunk KB',
            chunk_size: 2000,
            chunk_overlap: 400
          });

        expect(response.status).toBe(201);
        expect(KnowledgeBase.create).toHaveBeenCalledWith(
          expect.objectContaining({
            chunk_size: 2000,
            chunk_overlap: 400
          })
        );
      });
    });

    describe('Validation', () => {
      it('should reject request without name', async () => {
        const response = await request(app)
          .post('/api/knowledge')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name is required');
        expect(KnowledgeBase.create).not.toHaveBeenCalled();
      });

      it('should reject request with empty name', async () => {
        const response = await request(app)
          .post('/api/knowledge')
          .send({ name: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name is required');
        expect(KnowledgeBase.create).not.toHaveBeenCalled();
      });

      it('should reject request with whitespace-only name', async () => {
        const response = await request(app)
          .post('/api/knowledge')
          .send({ name: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name is required');
        expect(KnowledgeBase.create).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.create.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .post('/api/knowledge')
          .send({ name: 'Test KB' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to create knowledge base');
        expect(log.error).toHaveBeenCalled();
      });

      it('should handle constraint violations', async () => {
        KnowledgeBase.create.mockRejectedValueOnce(new Error('Duplicate name'));

        const response = await request(app)
          .post('/api/knowledge')
          .send({ name: 'Duplicate KB' });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('GET /api/knowledge/:id - Get Knowledge Base Details', () => {
    describe('Successful Retrieval', () => {
      it('should return knowledge base by id', async () => {
        const mockKB = {
          id: 1,
          tenant_id: 1,
          name: 'Test KB',
          description: 'Description',
          embedding_model: 'text-embedding-3-small',
          document_count: 5,
          chunk_count: 50
        };

        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(mockKB);

        const response = await request(app).get('/api/knowledge/1');

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Test KB');
        expect(response.body.id).toBe(1);
        expect(KnowledgeBase.findByIdAndTenant).toHaveBeenCalledWith('1', 1);
      });

      it('should include all knowledge base fields', async () => {
        const mockKB = {
          id: 2,
          tenant_id: 1,
          name: 'Complete KB',
          description: 'Full details',
          embedding_model: 'text-embedding-3-large',
          chunk_size: 1500,
          chunk_overlap: 300,
          document_count: 10,
          chunk_count: 150,
          status: 'ready',
          created_at: new Date(),
          updated_at: new Date()
        };

        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(mockKB);

        const response = await request(app).get('/api/knowledge/2');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: 2,
          name: 'Complete KB',
          description: 'Full details',
          embedding_model: 'text-embedding-3-large',
          chunk_size: 1500,
          chunk_overlap: 300,
          document_count: 10,
          chunk_count: 150,
          status: 'ready'
        });
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app).get('/api/knowledge/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });

      it('should return 404 when accessing another tenant\'s knowledge base', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app).get('/api/knowledge/1');

        expect(response.status).toBe(404);
        expect(KnowledgeBase.findByIdAndTenant).toHaveBeenCalledWith('1', 1);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app).get('/api/knowledge/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to fetch knowledge base');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('PUT /api/knowledge/:id - Update Knowledge Base', () => {
    describe('Successful Updates', () => {
      it('should update knowledge base name', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1, name: 'Old Name' });
        KnowledgeBase.update.mockResolvedValueOnce({ id: 1, name: 'New Name' });

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('New Name');
        expect(KnowledgeBase.update).toHaveBeenCalledWith('1', expect.objectContaining({
          name: 'New Name'
        }));
      });

      it('should update knowledge base description', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.update.mockResolvedValueOnce({ id: 1, description: 'Updated desc' });

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ description: 'Updated desc' });

        expect(response.status).toBe(200);
        expect(KnowledgeBase.update).toHaveBeenCalledWith('1', expect.objectContaining({
          description: 'Updated desc'
        }));
      });

      it('should update multiple fields at once', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.update.mockResolvedValueOnce({
          id: 1,
          name: 'Updated Name',
          description: 'Updated Description',
          chunk_size: 1500,
          chunk_overlap: 300
        });

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({
            name: 'Updated Name',
            description: 'Updated Description',
            chunk_size: 1500,
            chunk_overlap: 300
          });

        expect(response.status).toBe(200);
        expect(KnowledgeBase.update).toHaveBeenCalledWith('1', {
          name: 'Updated Name',
          description: 'Updated Description',
          embedding_model: undefined,
          chunk_size: 1500,
          chunk_overlap: 300,
          status: undefined
        });
      });

      it('should trim whitespace from updated fields', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.update.mockResolvedValueOnce({ id: 1, name: 'Trimmed' });

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ name: '  Trimmed  ' });

        expect(response.status).toBe(200);
        expect(KnowledgeBase.update).toHaveBeenCalledWith('1', expect.objectContaining({
          name: 'Trimmed'
        }));
      });

      it('should update status', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.update.mockResolvedValueOnce({ id: 1, status: 'training' });

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ status: 'training' });

        expect(response.status).toBe(200);
        expect(KnowledgeBase.update).toHaveBeenCalledWith('1', expect.objectContaining({
          status: 'training'
        }));
      });

      it('should update embedding model', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.update.mockResolvedValueOnce({ id: 1, embedding_model: 'text-embedding-3-large' });

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ embedding_model: 'text-embedding-3-large' });

        expect(response.status).toBe(200);
        expect(KnowledgeBase.update).toHaveBeenCalledWith('1', expect.objectContaining({
          embedding_model: 'text-embedding-3-large'
        }));
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app)
          .put('/api/knowledge/999')
          .send({ name: 'Updated' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
        expect(KnowledgeBase.update).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors during update', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.update.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ name: 'Updated' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to update knowledge base');
      });

      it('should handle errors during authorization check', async () => {
        KnowledgeBase.findByIdAndTenant.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .put('/api/knowledge/1')
          .send({ name: 'Updated' });

        expect(response.status).toBe(500);
      });
    });
  });

  describe('DELETE /api/knowledge/:id - Delete Knowledge Base', () => {
    describe('Successful Deletion', () => {
      it('should delete knowledge base', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1, name: 'To Delete' });
        KnowledgeBase.delete.mockResolvedValueOnce(true);

        const response = await request(app).delete('/api/knowledge/1');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Knowledge base deleted successfully');
        expect(KnowledgeBase.delete).toHaveBeenCalledWith('1');
      });

      it('should verify tenant before deletion', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.delete.mockResolvedValueOnce(true);

        await request(app).delete('/api/knowledge/1');

        expect(KnowledgeBase.findByIdAndTenant).toHaveBeenCalledWith('1', 1);
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app).delete('/api/knowledge/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
        expect(KnowledgeBase.delete).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        KnowledgeBase.delete.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app).delete('/api/knowledge/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to delete knowledge base');
      });
    });
  });

  describe('POST /api/knowledge/:id/documents - Add Document', () => {
    describe('File Upload', () => {
      it('should upload a PDF document', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          knowledge_base_id: 1,
          name: 'test.pdf',
          type: 'pdf',
          file_path: '/uploads/documents/test.pdf',
          file_size: 1024,
          status: 'processing'
        });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .set('x-test-file', 'true')
          .set('x-test-filename', 'test.pdf')
          .send({ name: 'test.pdf' });

        expect(response.status).toBe(201);
        expect(Document.create).toHaveBeenCalled();
      });

      it('should handle async document processing by default', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          knowledge_base_id: 1,
          name: 'async.txt',
          type: 'txt',
          status: 'processing'
        });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .set('x-test-file', 'true')
          .set('x-test-filename', 'async.txt')
          .send({ name: 'async.txt' });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Document uploaded and processing started');
      });

      it('should handle sync document processing when async=false', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          knowledge_base_id: 1,
          name: 'sync.txt',
          type: 'txt',
          status: 'processing'
        });
        Document.findById.mockResolvedValueOnce({
          id: 1,
          name: 'sync.txt',
          status: 'ready'
        });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .set('x-test-file', 'true')
          .set('x-test-filename', 'sync.txt')
          .send({ async: 'false' });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('ready');
        expect(DocumentProcessor.processDocument).toHaveBeenCalledWith(1);
      });

      it('should handle processing errors in sync mode', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          name: 'error.txt',
          status: 'processing'
        });
        DocumentProcessor.processDocument.mockRejectedValueOnce(new Error('Processing failed'));

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .set('x-test-file', 'true')
          .set('x-test-filename', 'error.txt')
          .send({ async: 'false' });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('failed');
        expect(response.body.error).toBe('Processing failed');
      });

      it('should use original filename when name not provided', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          name: 'document.pdf'
        });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        await request(app)
          .post('/api/knowledge/1/documents')
          .set('x-test-file', 'true')
          .set('x-test-filename', 'document.pdf')
          .send({});

        expect(Document.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'document.pdf'
          })
        );
      });

      it('should parse metadata JSON', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({ id: 1 });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        await request(app)
          .post('/api/knowledge/1/documents')
          .set('x-test-file', 'true')
          .set('x-test-filename', 'test.txt')
          .send({ metadata: JSON.stringify({ author: 'John', tags: ['test'] }) });

        expect(Document.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: { author: 'John', tags: ['test'] }
          })
        );
      });
    });

    describe('URL Document', () => {
      it('should create document from URL', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          knowledge_base_id: 1,
          name: 'https://example.com/doc',
          type: 'url',
          source_url: 'https://example.com/doc',
          status: 'processing'
        });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .send({ url: 'https://example.com/doc' });

        expect(response.status).toBe(201);
        expect(response.body.type).toBe('url');
        expect(response.body.source_url).toBe('https://example.com/doc');
        expect(Document.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'url',
            source_url: 'https://example.com/doc'
          })
        );
      });

      it('should use custom name for URL document', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({
          id: 1,
          name: 'Custom Name',
          type: 'url'
        });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        await request(app)
          .post('/api/knowledge/1/documents')
          .send({
            url: 'https://example.com/doc',
            name: 'Custom Name'
          });

        expect(Document.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Custom Name'
          })
        );
      });

      it('should handle metadata with URL documents', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockResolvedValueOnce({ id: 1 });
        DocumentProcessor.processDocument.mockResolvedValueOnce();

        await request(app)
          .post('/api/knowledge/1/documents')
          .send({
            url: 'https://example.com/doc',
            metadata: JSON.stringify({ source: 'web' })
          });

        expect(Document.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: { source: 'web' }
          })
        );
      });
    });

    describe('Validation', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/api/knowledge/999/documents')
          .send({ url: 'https://example.com' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });

      it('should require either file or URL', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Either file or URL is required');
      });
    });

    describe('Error Handling', () => {
      it('should handle document creation errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.create.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .post('/api/knowledge/1/documents')
          .send({ url: 'https://example.com' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to upload document');
      });
    });
  });

  describe('GET /api/knowledge/:id/documents - List Documents', () => {
    describe('Successful Retrieval', () => {
      it('should return all documents for knowledge base', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByKnowledgeBase.mockResolvedValueOnce([
          {
            id: 1,
            knowledge_base_id: 1,
            name: 'doc1.pdf',
            type: 'pdf',
            status: 'ready',
            chunk_count: 10
          },
          {
            id: 2,
            knowledge_base_id: 1,
            name: 'doc2.txt',
            type: 'txt',
            status: 'ready',
            chunk_count: 5
          }
        ]);

        const response = await request(app).get('/api/knowledge/1/documents');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0].name).toBe('doc1.pdf');
        expect(Document.findByKnowledgeBase).toHaveBeenCalledWith('1');
      });

      it('should return empty array when no documents exist', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByKnowledgeBase.mockResolvedValueOnce([]);

        const response = await request(app).get('/api/knowledge/1/documents');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app).get('/api/knowledge/999/documents');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByKnowledgeBase.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app).get('/api/knowledge/1/documents');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to fetch documents');
      });
    });
  });

  describe('DELETE /api/knowledge/:id/documents/:docId - Delete Document', () => {
    describe('Successful Deletion', () => {
      it('should delete document with file', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByIdAndKnowledgeBase.mockResolvedValueOnce({
          id: 1,
          knowledge_base_id: 1,
          file_path: '/path/to/file.pdf'
        });
        Document.delete.mockResolvedValueOnce(true);
        KnowledgeBase.updateCounts.mockResolvedValueOnce();
        fs.unlink.mockResolvedValueOnce();

        const response = await request(app).delete('/api/knowledge/1/documents/1');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Document deleted successfully');
        expect(fs.unlink).toHaveBeenCalledWith('/path/to/file.pdf');
        expect(Document.delete).toHaveBeenCalledWith('1');
        expect(KnowledgeBase.updateCounts).toHaveBeenCalledWith('1');
      });

      it('should delete document without file', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByIdAndKnowledgeBase.mockResolvedValueOnce({
          id: 2,
          knowledge_base_id: 1,
          type: 'url',
          file_path: null
        });
        Document.delete.mockResolvedValueOnce(true);
        KnowledgeBase.updateCounts.mockResolvedValueOnce();

        const response = await request(app).delete('/api/knowledge/1/documents/2');

        expect(response.status).toBe(200);
        expect(fs.unlink).not.toHaveBeenCalled();
        expect(Document.delete).toHaveBeenCalledWith('2');
      });

      it('should continue deletion even if file deletion fails', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByIdAndKnowledgeBase.mockResolvedValueOnce({
          id: 1,
          file_path: '/nonexistent/file.pdf'
        });
        fs.unlink.mockRejectedValueOnce(new Error('File not found'));
        Document.delete.mockResolvedValueOnce(true);
        KnowledgeBase.updateCounts.mockResolvedValueOnce();

        const response = await request(app).delete('/api/knowledge/1/documents/1');

        expect(response.status).toBe(200);
        expect(log.warn).toHaveBeenCalledWith('Could not delete file', { error: 'File not found' });
        expect(Document.delete).toHaveBeenCalled();
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app).delete('/api/knowledge/999/documents/1');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });

      it('should return 404 when document not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByIdAndKnowledgeBase.mockResolvedValueOnce(null);

        const response = await request(app).delete('/api/knowledge/1/documents/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Document not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        Document.findByIdAndKnowledgeBase.mockResolvedValueOnce({ id: 1 });
        Document.delete.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app).delete('/api/knowledge/1/documents/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to delete document');
      });
    });
  });

  describe('GET /api/knowledge/:id/agents - Get Assigned Agents', () => {
    describe('Successful Retrieval', () => {
      it('should return agents assigned to knowledge base', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([
          { id: 1, name: 'Agent 1', role: 'assistant' },
          { id: 2, name: 'Agent 2', role: 'support' }
        ]);

        const response = await request(app).get('/api/knowledge/1/agents');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(VectorStore.getAgentsByKnowledgeBase).toHaveBeenCalledWith('1');
      });

      it('should return empty array when no agents assigned', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([]);

        const response = await request(app).get('/api/knowledge/1/agents');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app).get('/api/knowledge/999/agents');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.getAgentsByKnowledgeBase.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app).get('/api/knowledge/1/agents');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to fetch assigned agents');
      });
    });
  });

  describe('PUT /api/knowledge/:id/agents - Update Agent Assignments', () => {
    describe('Successful Updates', () => {
      it('should assign agents to knowledge base', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.removeAllAgentsFromKnowledgeBase.mockResolvedValueOnce();
        VectorStore.assignToAgent.mockResolvedValue();
        VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([
          { id: 1, name: 'Agent 1' },
          { id: 2, name: 'Agent 2' }
        ]);

        const response = await request(app)
          .put('/api/knowledge/1/agents')
          .send({ agent_ids: [1, 2] });

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(VectorStore.removeAllAgentsFromKnowledgeBase).toHaveBeenCalledWith('1');
        expect(VectorStore.assignToAgent).toHaveBeenCalledWith(1, 1);
        expect(VectorStore.assignToAgent).toHaveBeenCalledWith(2, 1);
      });

      it('should remove all agents when empty array provided', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.removeAllAgentsFromKnowledgeBase.mockResolvedValueOnce();
        VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([]);

        const response = await request(app)
          .put('/api/knowledge/1/agents')
          .send({ agent_ids: [] });

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(VectorStore.removeAllAgentsFromKnowledgeBase).toHaveBeenCalled();
        expect(VectorStore.assignToAgent).not.toHaveBeenCalled();
      });

      it('should skip null/undefined agent IDs', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.removeAllAgentsFromKnowledgeBase.mockResolvedValueOnce();
        VectorStore.assignToAgent.mockResolvedValue();
        VectorStore.getAgentsByKnowledgeBase.mockResolvedValueOnce([{ id: 1 }]);

        const response = await request(app)
          .put('/api/knowledge/1/agents')
          .send({ agent_ids: [1, null, undefined] });

        expect(response.status).toBe(200);
        expect(VectorStore.assignToAgent).toHaveBeenCalledTimes(1);
        expect(VectorStore.assignToAgent).toHaveBeenCalledWith(1, 1);
      });
    });

    describe('Validation', () => {
      it('should require agent_ids to be an array', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

        const response = await request(app)
          .put('/api/knowledge/1/agents')
          .send({ agent_ids: 'not-an-array' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('agent_ids must be an array');
      });

      it('should require agent_ids field', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

        const response = await request(app)
          .put('/api/knowledge/1/agents')
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app)
          .put('/api/knowledge/999/agents')
          .send({ agent_ids: [1] });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        VectorStore.removeAllAgentsFromKnowledgeBase.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .put('/api/knowledge/1/agents')
          .send({ agent_ids: [1] });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to update agent assignments');
      });
    });
  });

  describe('POST /api/knowledge/:id/search - Semantic Search', () => {
    describe('Successful Search', () => {
      it('should perform semantic search', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        VectorStore.similaritySearch.mockResolvedValueOnce([
          {
            chunk_id: 1,
            content: 'Relevant content 1',
            similarity: 0.95,
            document_name: 'doc1.pdf'
          },
          {
            chunk_id: 2,
            content: 'Relevant content 2',
            similarity: 0.85,
            document_name: 'doc2.pdf'
          }
        ]);

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: 'test query' });

        expect(response.status).toBe(200);
        expect(response.body.query).toBe('test query');
        expect(response.body.results).toHaveLength(2);
        expect(response.body.count).toBe(2);
        expect(EmbeddingService.getEmbedding).toHaveBeenCalledWith('test query');
        expect(VectorStore.similaritySearch).toHaveBeenCalledWith(
          1,
          [0.1, 0.2, 0.3],
          { limit: 5, threshold: 0.7 }
        );
      });

      it('should use custom limit parameter', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        VectorStore.similaritySearch.mockResolvedValueOnce([]);

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: 'test', limit: 10 });

        expect(response.status).toBe(200);
        expect(VectorStore.similaritySearch).toHaveBeenCalledWith(
          1,
          expect.any(Array),
          { limit: 10, threshold: 0.7 }
        );
      });

      it('should use custom threshold parameter', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        VectorStore.similaritySearch.mockResolvedValueOnce([]);

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: 'test', threshold: 0.9 });

        expect(response.status).toBe(200);
        expect(VectorStore.similaritySearch).toHaveBeenCalledWith(
          1,
          expect.any(Array),
          { limit: 5, threshold: 0.9 }
        );
      });

      it('should trim whitespace from query', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        VectorStore.similaritySearch.mockResolvedValueOnce([]);

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: '  trimmed query  ' });

        expect(response.status).toBe(200);
        expect(response.body.query).toBe('trimmed query');
        expect(EmbeddingService.getEmbedding).toHaveBeenCalledWith('trimmed query');
      });

      it('should return empty results when no matches found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        VectorStore.similaritySearch.mockResolvedValueOnce([]);

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: 'no matches' });

        expect(response.status).toBe(200);
        expect(response.body.results).toEqual([]);
        expect(response.body.count).toBe(0);
      });
    });

    describe('Validation', () => {
      it('should require query parameter', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Query is required');
      });

      it('should reject empty query', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Query is required');
      });

      it('should reject whitespace-only query', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Query is required');
      });
    });

    describe('Not Found', () => {
      it('should return 404 when knowledge base not found', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/api/knowledge/999/search')
          .send({ query: 'test' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Knowledge base not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle embedding service errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockRejectedValueOnce(new Error('API error'));

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: 'test' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to perform search');
      });

      it('should handle vector store errors', async () => {
        KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
        EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        VectorStore.similaritySearch.mockRejectedValueOnce(new Error('Search failed'));

        const response = await request(app)
          .post('/api/knowledge/1/search')
          .send({ query: 'test' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to perform search');
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      const authMock = require('../../middleware/auth');

      await request(app).get('/api/knowledge');
      expect(authMock).toHaveBeenCalled();

      await request(app).post('/api/knowledge').send({ name: 'Test' });
      expect(authMock).toHaveBeenCalled();

      await request(app).get('/api/knowledge/1');
      expect(authMock).toHaveBeenCalled();
    });

    it('should verify tenant access for all operations', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/knowledge/1');

      expect(response.status).toBe(404);
      expect(KnowledgeBase.findByIdAndTenant).toHaveBeenCalledWith('1', 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large knowledge base lists', async () => {
      const largeList = Array(1000).fill(null).map((_, i) => ({
        id: i + 1,
        name: `KB ${i + 1}`,
        tenant_id: 1
      }));

      KnowledgeBase.findByTenant.mockResolvedValueOnce(largeList);

      const response = await request(app).get('/api/knowledge');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1000);
    });

    it('should handle concurrent document uploads', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValue({ id: 1 });
      Document.create.mockResolvedValue({ id: 1, name: 'doc' });
      DocumentProcessor.processDocument.mockResolvedValue();

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/knowledge/1/documents')
          .send({ url: 'https://example.com' })
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect(res.status).toBe(201);
      });
    });

    it('should handle special characters in names', async () => {
      const specialName = 'KB with "quotes" & <brackets>';
      const mockKB = { id: 1, name: specialName };

      KnowledgeBase.create.mockResolvedValueOnce(mockKB);

      const response = await request(app)
        .post('/api/knowledge')
        .send({ name: specialName });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(specialName);
    });

    it('should handle Unicode characters in names', async () => {
      const unicodeName = 'Knowledge Base';
      const mockKB = { id: 1, name: unicodeName };

      KnowledgeBase.create.mockResolvedValueOnce(mockKB);

      const response = await request(app)
        .post('/api/knowledge')
        .send({ name: unicodeName });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(unicodeName);
    });

    it('should handle zero as valid limit in search', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      VectorStore.similaritySearch.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'test', limit: 0 });

      expect(response.status).toBe(200);
      expect(VectorStore.similaritySearch).toHaveBeenCalledWith(
        1,
        expect.any(Array),
        { limit: 0, threshold: 0.7 }
      );
    });

    it('should handle negative threshold in search', async () => {
      KnowledgeBase.findByIdAndTenant.mockResolvedValueOnce({ id: 1 });
      EmbeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      VectorStore.similaritySearch.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'test', threshold: -0.5 });

      expect(response.status).toBe(200);
      expect(VectorStore.similaritySearch).toHaveBeenCalledWith(
        1,
        expect.any(Array),
        { limit: 5, threshold: -0.5 }
      );
    });
  });
});
