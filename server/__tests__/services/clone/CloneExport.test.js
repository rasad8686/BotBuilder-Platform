/**
 * CloneExport Service Tests
 */

const CloneExport = require('../../../services/clone/CloneExport');

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

const db = require('../../../db');

describe('CloneExport Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportClone', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'user-456',
      name: 'Test Clone',
      type: 'personality',
      config: { traits: { openness: 0.8 } },
      status: 'active',
      created_at: new Date('2025-01-01'),
      updated_at: new Date('2025-01-15')
    };

    const mockTrainingData = [
      { id: 'train-1', input: 'Hello', output: 'Hi there!' },
      { id: 'train-2', input: 'How are you?', output: 'I am doing well.' }
    ];

    it('should export clone as JSON without training data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneExport.exportClone('clone-123', 'user-456', {
        format: 'json',
        includeTrainingData: false
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.format).toBe('json');

      const exportData = JSON.parse(result.data);
      expect(exportData.clone.id).toBe('clone-123');
      expect(exportData.clone.name).toBe('Test Clone');
      expect(exportData.trainingData).toBeUndefined();
    });

    it('should export clone with training data when requested', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: mockTrainingData });

      const result = await CloneExport.exportClone('clone-123', 'user-456', {
        format: 'json',
        includeTrainingData: true
      });

      expect(result.success).toBe(true);

      const exportData = JSON.parse(result.data);
      expect(exportData.trainingData).toBeDefined();
      expect(exportData.trainingData).toHaveLength(2);
    });

    it('should return error for non-existent clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneExport.exportClone('invalid-id', 'user-456', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for unauthorized user', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockClone, user_id: 'other-user' }] });

      const result = await CloneExport.exportClone('clone-123', 'user-456', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await CloneExport.exportClone('clone-123', 'user-456', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('exportMultiple', () => {
    const mockClones = [
      { id: 'clone-1', user_id: 'user-456', name: 'Clone 1', type: 'voice', config: {} },
      { id: 'clone-2', user_id: 'user-456', name: 'Clone 2', type: 'style', config: {} }
    ];

    it('should export multiple clones', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClones[0]] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockClones[1]] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneExport.exportMultiple(
        ['clone-1', 'clone-2'],
        'user-456',
        { format: 'json' }
      );

      expect(result.success).toBe(true);
      expect(result.exports).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClones[0]] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // Clone not found

      const result = await CloneExport.exportMultiple(
        ['clone-1', 'clone-2'],
        'user-456',
        { format: 'json' }
      );

      expect(result.success).toBe(true);
      expect(result.exports).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('getExportHistory', () => {
    it('should return export history for user', async () => {
      const mockHistory = [
        { id: 'export-1', clone_id: 'clone-123', format: 'json', created_at: new Date() },
        { id: 'export-2', clone_id: 'clone-456', format: 'zip', created_at: new Date() }
      ];

      db.query.mockResolvedValueOnce({ rows: mockHistory });

      const result = await CloneExport.getExportHistory('user-456');

      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(2);
    });

    it('should handle empty history', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneExport.getExportHistory('user-456');

      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(0);
    });
  });
});
