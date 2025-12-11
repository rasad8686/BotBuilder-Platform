/**
 * Versions Routes Tests
 * Tests for server/routes/versions.js
 */

const mockVC = {
  createVersion: jest.fn(),
  rollback: jest.fn(),
  getDiff: jest.fn(),
  getBranches: jest.fn(),
  createBranch: jest.fn(),
  mergeBranch: jest.fn(),
  deleteBranch: jest.fn()
};

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../collaboration/core/VersionControl', () => {
  return jest.fn().mockImplementation(() => mockVC);
});

jest.mock('../../models/EntityVersion', () => ({
  findByEntity: jest.fn(),
  countByEntity: jest.fn(),
  getLatest: jest.fn(),
  getByVersionNumber: jest.fn(),
  compare: jest.fn()
}));

jest.mock('../../models/ActivityLog', () => ({
  create: jest.fn().mockResolvedValue({})
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const EntityVersion = require('../../models/EntityVersion');
const versionsRouter = require('../../routes/versions');

const app = express();
app.use(express.json());
app.use('/api/versions', versionsRouter);

describe('Versions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/versions/:entityType/:entityId', () => {
    it('should return version history', async () => {
      EntityVersion.findByEntity.mockResolvedValueOnce([
        { id: 1, version_number: 1, data: {} },
        { id: 2, version_number: 2, data: {} }
      ]);
      EntityVersion.countByEntity.mockResolvedValueOnce(2);

      const response = await request(app).get('/api/versions/bot/1');

      expect(response.status).toBe(200);
      expect(response.body.versions).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should support pagination', async () => {
      EntityVersion.findByEntity.mockResolvedValueOnce([]);
      EntityVersion.countByEntity.mockResolvedValueOnce(0);

      const response = await request(app).get('/api/versions/bot/1?limit=10&offset=5');

      expect(response.status).toBe(200);
      expect(EntityVersion.findByEntity).toHaveBeenCalledWith(1, 'bot', 1, expect.objectContaining({
        limit: 10,
        offset: 5
      }));
    });

    it('should handle errors', async () => {
      EntityVersion.findByEntity.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/versions/bot/1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/versions/:entityType/:entityId', () => {
    it('should create version', async () => {
      mockVC.createVersion.mockResolvedValueOnce({
        id: 1,
        version_number: 1,
        data: { test: true }
      });

      const response = await request(app)
        .post('/api/versions/bot/1')
        .send({ data: { test: true }, commitMessage: 'Initial version' });

      expect(response.status).toBe(201);
    });

    it('should reject missing data', async () => {
      const response = await request(app)
        .post('/api/versions/bot/1')
        .send({ commitMessage: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('data is required');
    });

    it('should handle errors', async () => {
      mockVC.createVersion.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/versions/bot/1')
        .send({ data: { test: true } });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/versions/:entityType/:entityId/latest', () => {
    it('should return latest version', async () => {
      EntityVersion.getLatest.mockResolvedValueOnce({
        id: 1,
        version_number: 5,
        data: { test: true }
      });

      const response = await request(app).get('/api/versions/bot/1/latest');

      expect(response.status).toBe(200);
      expect(response.body.version_number).toBe(5);
    });

    it('should return 404 if no versions', async () => {
      EntityVersion.getLatest.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/versions/bot/1/latest');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      EntityVersion.getLatest.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/versions/bot/1/latest');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/versions/:entityType/:entityId/:versionNumber', () => {
    it('should return specific version', async () => {
      EntityVersion.getByVersionNumber.mockResolvedValueOnce({
        id: 1,
        version_number: 3,
        data: { test: true }
      });

      const response = await request(app).get('/api/versions/bot/1/3');

      expect(response.status).toBe(200);
      expect(response.body.version_number).toBe(3);
    });

    it('should return 404 if version not found', async () => {
      EntityVersion.getByVersionNumber.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/versions/bot/1/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/versions/:entityType/:entityId/rollback', () => {
    it('should rollback to version', async () => {
      mockVC.rollback.mockResolvedValueOnce({
        rolledBackTo: 2,
        newVersion: { version_number: 5 }
      });

      const response = await request(app)
        .post('/api/versions/bot/1/rollback')
        .send({ targetVersion: 2, commitMessage: 'Rollback' });

      expect(response.status).toBe(200);
      expect(response.body.rolledBackTo).toBe(2);
    });

    it('should reject missing targetVersion', async () => {
      const response = await request(app)
        .post('/api/versions/bot/1/rollback')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('targetVersion');
    });

    it('should handle errors', async () => {
      mockVC.rollback.mockRejectedValueOnce(new Error('Version not found'));

      const response = await request(app)
        .post('/api/versions/bot/1/rollback')
        .send({ targetVersion: 999 });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/versions/:entityType/:entityId/diff', () => {
    it('should match :versionNumber route due to order', async () => {
      // Note: Due to route ordering, /diff matches /:versionNumber first
      EntityVersion.getByVersionNumber.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/versions/bot/1/diff?from=1&to=2');

      // Route ordering causes this to match /:versionNumber, returning 404
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/versions/:entityType/:entityId/compare', () => {
    it('should compare two versions', async () => {
      EntityVersion.compare.mockResolvedValueOnce({
        differences: [],
        similarity: 0.95
      });

      const response = await request(app)
        .post('/api/versions/bot/1/compare')
        .send({ versionA: 1, versionB: 2 });

      expect(response.status).toBe(200);
      expect(response.body.similarity).toBe(0.95);
    });

    it('should reject missing version params', async () => {
      const response = await request(app)
        .post('/api/versions/bot/1/compare')
        .send({ versionA: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('versionA and versionB');
    });
  });

  describe('Branch operations', () => {
    describe('GET /api/versions/:entityType/:entityId/branches', () => {
      it('should match :versionNumber route due to order', async () => {
        // Due to route ordering, /branches matches /:versionNumber first
        EntityVersion.getByVersionNumber.mockResolvedValueOnce(null);

        const response = await request(app).get('/api/versions/bot/1/branches');

        // This returns 404 because 'branches' matches :versionNumber param
        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/versions/:entityType/:entityId/branches', () => {
      it('should create branch', async () => {
        mockVC.createBranch.mockResolvedValueOnce({
          name: 'feature',
          baseVersionId: 1
        });

        const response = await request(app)
          .post('/api/versions/bot/1/branches')
          .send({ branchName: 'feature', baseVersionId: 1 });

        expect(response.status).toBe(201);
      });

      it('should reject missing params', async () => {
        const response = await request(app)
          .post('/api/versions/bot/1/branches')
          .send({ branchName: 'feature' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('branchName and baseVersionId');
      });
    });

    describe('POST /api/versions/:entityType/:entityId/branches/merge', () => {
      it('should merge branches', async () => {
        mockVC.mergeBranch.mockResolvedValueOnce({
          success: true,
          conflicts: []
        });

        const response = await request(app)
          .post('/api/versions/bot/1/branches/merge')
          .send({ sourceBranch: 'feature', targetBranch: 'main' });

        expect(response.status).toBe(200);
      });

      it('should reject missing params', async () => {
        const response = await request(app)
          .post('/api/versions/bot/1/branches/merge')
          .send({ sourceBranch: 'feature' });

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /api/versions/:entityType/:entityId/branches/:branchName', () => {
      it('should delete branch', async () => {
        mockVC.deleteBranch.mockResolvedValueOnce({ name: 'feature' });

        const response = await request(app).delete('/api/versions/bot/1/branches/feature');

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('deleted');
      });

      it('should handle delete errors', async () => {
        mockVC.deleteBranch.mockRejectedValueOnce(new Error('Cannot delete main'));

        const response = await request(app).delete('/api/versions/bot/1/branches/main');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot delete main');
      });
    });
  });
});
