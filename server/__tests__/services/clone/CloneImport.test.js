/**
 * CloneImport Service Tests
 */

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const CloneImport = require('../../../services/clone/CloneImport');

describe('CloneImport Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  describe('previewImport', () => {
    const validExportData = {
      version: '1.0',
      exportedAt: '2025-01-15T00:00:00.000Z',
      clone: {
        id: 'clone-123',
        name: 'Test Clone',
        type: 'personality',
        config: { traits: { openness: 0.8 } }
      },
      trainingData: [
        { input: 'Hello', output: 'Hi!' }
      ]
    };

    it('should preview valid import data', async () => {
      const result = await CloneImport.previewImport(JSON.stringify(validExportData));

      expect(result.success).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.preview.name).toBe('Test Clone');
      expect(result.preview.type).toBe('personality');
      expect(result.preview.trainingDataCount).toBe(1);
      expect(result.preview.isValid).toBe(true);
    });

    it('should reject invalid JSON', async () => {
      const result = await CloneImport.previewImport('invalid json{');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should reject missing required fields', async () => {
      const invalidData = { version: '1.0' };
      const result = await CloneImport.previewImport(JSON.stringify(invalidData));

      expect(result.success).toBe(false);
      // Error message is "Clone name is required"
      expect(result.error).toContain('required');
    });

    it('should reject unsupported version', async () => {
      // The service validates version in _validateImportData and rejects unsupported versions
      const futureVersion = { ...validExportData, version: '99.0' };
      const result = await CloneImport.previewImport(JSON.stringify(futureVersion));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('importClone', () => {
    const validExportData = {
      version: '1.0',
      exportedAt: '2025-01-15T00:00:00.000Z',
      clone: {
        id: 'clone-123',
        name: 'Test Clone',
        type: 'personality',
        config: { traits: { openness: 0.8 } }
      }
    };

    it('should import clone successfully', async () => {
      const newCloneId = 'new-clone-789';
      db.query.mockResolvedValueOnce({
        rows: [{ id: newCloneId, name: 'Test Clone', type: 'personality' }]
      });

      const result = await CloneImport.importClone(
        JSON.stringify(validExportData),
        'user-456',
        {}
      );

      expect(result.success).toBe(true);
      expect(result.cloneId).toBe(newCloneId);
    });

    it('should import with custom name', async () => {
      const newCloneId = 'new-clone-789';
      db.query.mockResolvedValueOnce({
        rows: [{ id: newCloneId, name: 'Custom Name', type: 'personality' }]
      });

      const result = await CloneImport.importClone(
        JSON.stringify(validExportData),
        'user-456',
        { name: 'Custom Name' }
      );

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Custom Name'])
      );
    });

    it('should import with training data', async () => {
      const dataWithTraining = {
        ...validExportData,
        trainingData: [
          { input: 'Hello', output: 'Hi!' },
          { input: 'Bye', output: 'Goodbye!' }
        ]
      };

      const newCloneId = 'new-clone-789';
      db.query
        .mockResolvedValueOnce({ rows: [{ id: newCloneId }] })
        .mockResolvedValueOnce({ rows: [] }) // Training data insert
        .mockResolvedValueOnce({ rows: [] }); // Training data insert

      const result = await CloneImport.importClone(
        JSON.stringify(dataWithTraining),
        'user-456',
        { importTrainingData: true }
      );

      expect(result.success).toBe(true);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Insert failed'));

      const result = await CloneImport.importClone(
        JSON.stringify(validExportData),
        'user-456',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });

  describe('mergeClone', () => {
    const existingClone = {
      id: 'existing-123',
      user_id: 'user-456',
      name: 'Existing Clone',
      type: 'personality',
      config: { traits: { openness: 0.5 } }
    };

    const importData = {
      version: '1.0',
      clone: {
        name: 'Import Clone',
        type: 'personality',
        config: { traits: { openness: 0.8, extraversion: 0.7 } }
      }
    };

    it('should merge config into existing clone', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [existingClone] })
        .mockResolvedValueOnce({ rows: [{ ...existingClone, config: { traits: { openness: 0.8, extraversion: 0.7 } } }] });

      const result = await CloneImport.mergeClone(
        'existing-123',
        JSON.stringify(importData),
        'user-456',
        { mergeStrategy: 'replace' }
      );

      expect(result.success).toBe(true);
    });

    it('should reject merge for non-existent clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneImport.mergeClone(
        'invalid-id',
        JSON.stringify(importData),
        'user-456',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject merge for different clone types', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...existingClone, type: 'voice' }] });

      const result = await CloneImport.mergeClone(
        'existing-123',
        JSON.stringify(importData),
        'user-456',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('type mismatch');
    });
  });
});
